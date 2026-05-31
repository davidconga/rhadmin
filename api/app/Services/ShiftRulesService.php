<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\Setting;
use App\Models\Shift;
use App\Models\ShiftSchedule;
use Carbon\Carbon;
use Illuminate\Support\Collection;

/**
 * Valida regras de escalas para setores regulamentados (ex.: Saúde).
 * Regras configuráveis via Settings → Escalas.
 *
 * Violações devolvidas como array:
 *   [['employee_id', 'date', 'rule', 'message'], ...]
 */
class ShiftRulesService
{
    public function violationsForMonth(int $month, int $year): array
    {
        $restAfterNight = (int) Setting::get('shift_rest_after_night_hours', 11);
        $maxConsecutive = (int) Setting::get('shift_max_consecutive_days', 6);

        $start = Carbon::create($year, $month, 1)->startOfMonth();
        $end = (clone $start)->copy()->endOfMonth();

        // Carrega escala do mês + margem de 7 dias antes (para checar consecutivos).
        $paddedStart = $start->copy()->subDays(7);
        $schedules = ShiftSchedule::with('shift')
            ->whereBetween('date', [$paddedStart->toDateString(), $end->toDateString()])
            ->get()
            ->groupBy('employee_id');

        // Piquetes (oncall) e turnos noturnos regulares exigem descanso no dia seguinte.
        $nightShiftIds = Shift::where(fn ($q) =>
            $q->where('type', 'oncall')
              ->orWhere(fn ($q2) =>
                  $q2->where('type', 'regular')
                     ->where(fn ($q3) => $q3->where('crosses_midnight', true)->orWhere('start_time', '>=', '20:00'))
              )
        )->pluck('id')->flip();

        $violations = [];

        foreach ($schedules as $empId => $entries) {
            $byDate = $entries->keyBy(fn ($e) => $e->date->toDateString());

            // Verifica cada dia DO MÊS (não da margem)
            for ($d = $start->copy(); $d->lte($end); $d->addDay()) {
                $dateStr = $d->toDateString();
                $entry = $byDate[$dateStr] ?? null;

                // 1. Folga obrigatória após turno de noite
                if ($restAfterNight > 0 && $entry) {
                    $prev = $byDate[$d->copy()->subDay()->toDateString()] ?? null;
                    if ($prev && isset($nightShiftIds[$prev->shift_id])) {
                        $shift = $entry->shift;
                        if ($shift->counts_as_worked && $shift->type !== 'rest') {
                            $violations[] = [
                                'employee_id' => $empId,
                                'date' => $dateStr,
                                'rule' => 'rest_after_night',
                                'message' => "Sem descanso ({$restAfterNight}h) após turno noturno de ".
                                    $d->copy()->subDay()->isoFormat('D [de] MMMM'),
                            ];
                        }
                    }
                }

                // 2. Máximo de dias consecutivos trabalhados
                if ($maxConsecutive > 0 && $entry && $entry->shift->counts_as_worked) {
                    $consecutive = 0;
                    $check = $d->copy();
                    while (true) {
                        $e = $byDate[$check->toDateString()] ?? null;
                        if ($e && $e->shift->counts_as_worked) {
                            $consecutive++;
                            $check->subDay();
                        } else {
                            break;
                        }
                        if ($consecutive > $maxConsecutive + 5) {
                            break;  // evita loop infinito em dados inconsistentes
                        }
                    }
                    if ($consecutive > $maxConsecutive) {
                        $violations[] = [
                            'employee_id' => $empId,
                            'date' => $dateStr,
                            'rule' => 'max_consecutive',
                            'message' => "{$consecutive} dias consecutivos trabalhados (máx. {$maxConsecutive})",
                        ];
                    }
                }
            }
        }

        return $violations;
    }

    /**
     * Resumo por funcionário para o mês: horas, turnos, piquetes, folgas.
     */
    public function summaryForMonth(int $month, int $year): Collection
    {
        $start = Carbon::create($year, $month, 1)->startOfMonth();
        $end = (clone $start)->endOfMonth();

        $employees = Employee::where('active', true)->orderBy('full_name')->get(['id', 'full_name', 'department']);
        $schedules = ShiftSchedule::with('shift')
            ->whereBetween('date', [$start->toDateString(), $end->toDateString()])
            ->get()
            ->groupBy('employee_id');

        return $employees->map(function ($emp) use ($schedules) {
            $entries = $schedules[$emp->id] ?? collect();
            $byType = $entries->groupBy(fn ($e) => $e->shift->type);

            $totalHours = $entries->sum(fn ($e) => $e->shift->counts_as_worked ? $e->shift->duration_hours : 0);
            $nights = $entries->filter(fn ($e) => $e->shift->crosses_midnight)->count();

            return [
                'employee_id' => $emp->id,
                'full_name' => $emp->full_name,
                'department' => $emp->department,
                'total_shifts' => $entries->filter(fn ($e) => $e->shift->counts_as_worked)->count(),
                'total_hours' => $totalHours,
                'night_shifts' => $nights,
                'oncall_shifts' => $byType->get('oncall', collect())->count(),
                'rest_days' => $byType->get('rest', collect())->count(),
                'holiday_days' => $byType->get('holiday', collect())->count(),
            ];
        });
    }
}
