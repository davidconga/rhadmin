<?php

namespace App\Services;

use App\Models\Attendance;
use App\Models\Employee;
use App\Models\Setting;
use Carbon\Carbon;
use Illuminate\Http\UploadedFile;

/**
 * Converte "picagens" (punches) de terminais biométricos em registos de
 * assiduidade. Vendor-neutral: aceita uma lista de picagens vinda de
 * importação de ficheiro ou de um agente que faz push para a API.
 */
class BiometricImportService
{
    /**
     * @param  array<int, array{biometric_id?: string, employee_id?: int, timestamp: string}>  $punches
     * @return array{punches:int, matched:int, attendances:int, unmatched:array<int,string>, days:int}
     */
    public function processPunches(array $punches): array
    {
        $entryLimit = (string) Setting::get('attendance_entry_limit', '08:15');

        // Lookup de funcionários por biometric_id.
        $byBio = Employee::whereNotNull('biometric_id')->get()->keyBy('biometric_id');

        // Agrupa timestamps por funcionário + dia.
        $groups = [];      // [employeeId][date] => [Carbon, ...]
        $unmatched = [];
        $valid = 0;

        foreach ($punches as $p) {
            $ts = $this->parseTimestamp($p['timestamp'] ?? null);
            if (! $ts) {
                continue;
            }

            $employeeId = $p['employee_id'] ?? null;
            if (! $employeeId) {
                $bio = (string) ($p['biometric_id'] ?? '');
                $emp = $byBio->get($bio);
                if (! $emp) {
                    $unmatched[$bio] = true;
                    continue;
                }
                $employeeId = $emp->id;
            }

            $valid++;
            $groups[$employeeId][$ts->toDateString()][] = $ts;
        }

        $attendanceCount = 0;
        $days = 0;
        foreach ($groups as $employeeId => $dates) {
            foreach ($dates as $date => $times) {
                sort($times);
                $checkIn = $times[0];
                $checkOut = count($times) > 1 ? end($times) : null;

                $in = $checkIn->format('H:i');
                $out = $checkOut?->format('H:i');
                $status = $this->isLate($in, $entryLimit) ? 'late' : 'present';

                Attendance::updateOrCreate(
                    ['employee_id' => $employeeId, 'date' => $date],
                    [
                        'status' => $status,
                        'check_in' => $in,
                        'check_out' => $out,
                        'worked_hours' => Attendance::computeHours($in, $out),
                    ],
                );
                $attendanceCount++;
                $days++;
            }
        }

        return [
            'punches' => $valid,
            'matched' => count($groups),
            'attendances' => $attendanceCount,
            'days' => $days,
            'unmatched' => array_values(array_keys($unmatched)),
        ];
    }

    /**
     * Lê um ficheiro CSV/TXT exportado do terminal. Espera, por linha:
     * biometric_id, data_hora [, ...]. Aceita ',' ';' ou TAB como separador.
     *
     * @return array<int, array{biometric_id:string, timestamp:string}>
     */
    public function parseFile(UploadedFile $file): array
    {
        $punches = [];
        $handle = fopen($file->getRealPath(), 'r');

        while (($line = fgets($handle)) !== false) {
            $line = trim($line);
            if ($line === '') {
                continue;
            }
            // separador: TAB, ; ou ,
            $cols = preg_split('/\t|;|,/', $line);
            if (count($cols) < 2) {
                continue;
            }
            $bio = trim($cols[0]);
            $datetime = trim($cols[1]);

            // ignora linha de cabeçalho (segunda coluna não é data)
            if (! $this->parseTimestamp($datetime)) {
                continue;
            }
            $punches[] = ['biometric_id' => $bio, 'timestamp' => $datetime];
        }
        fclose($handle);

        return $punches;
    }

    protected function parseTimestamp(?string $value): ?Carbon
    {
        if (! $value) {
            return null;
        }
        try {
            return Carbon::parse($value);
        } catch (\Throwable) {
            return null;
        }
    }

    protected function isLate(string $checkIn, string $limit): bool
    {
        return strlen($checkIn) >= 5 && strlen($limit) >= 5 && $checkIn > $limit;
    }
}
