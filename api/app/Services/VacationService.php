<?php

namespace App\Services;

use App\Models\Attendance;
use App\Models\Employee;
use App\Models\Setting;
use App\Models\Shift;
use App\Models\ShiftSchedule;
use App\Models\VacationBalance;
use App\Models\VacationRequest;
use Carbon\Carbon;
use Carbon\CarbonPeriod;

class VacationService
{
    /**
     * Conta os dias úteis (seg–sex) entre duas datas, excluindo feriados
     * configurados em settings 'vacation_holidays' (array de 'YYYY-MM-DD').
     */
    public function countWorkingDays(string $from, string $to): int
    {
        $holidays = collect(Setting::get('vacation_holidays', []))->flip();
        $days = 0;
        foreach (CarbonPeriod::create($from, $to) as $d) {
            if (! $d->isWeekend() && ! isset($holidays[$d->toDateString()])) {
                $days++;
            }
        }
        return $days;
    }

    /**
     * Devolve (ou cria) o saldo do funcionário para o ano.
     */
    public function balance(Employee $employee, int $year): VacationBalance
    {
        return VacationBalance::firstOrCreate(
            ['employee_id' => $employee->id, 'year' => $year],
            [
                'entitled_days' => (int) Setting::get('vacation_days_per_year', 22),
                'carried_over' => 0,
                'used_days' => 0,
                'extra_days' => 0,
            ]
        );
    }

    /**
     * Recalcula used_days a partir dos pedidos aprovados do funcionário/ano.
     */
    public function recalcUsed(Employee $employee, int $year): void
    {
        $used = VacationRequest::where('employee_id', $employee->id)
            ->where('status', 'approved')
            ->whereYear('start_date', $year)
            ->sum('working_days');

        $balance = $this->balance($employee, $year);
        $balance->update(['used_days' => $used]);
    }

    /**
     * Verifica se o funcionário tem saldo suficiente para o pedido.
     * Devolve null se OK, ou uma mensagem de erro.
     */
    public function checkBalance(Employee $employee, int $workingDays, int $year, ?int $excludeRequestId = null): ?string
    {
        $balance = $this->balance($employee, $year);
        $already = VacationRequest::where('employee_id', $employee->id)
            ->where('status', 'approved')
            ->whereYear('start_date', $year)
            ->when($excludeRequestId, fn ($q) => $q->where('id', '!=', $excludeRequestId))
            ->sum('working_days');

        $available = $balance->totalDays() - $already;
        if ($workingDays > $available) {
            return "Saldo insuficiente. Disponíveis: {$available} dias, pedido: {$workingDays} dias.";
        }
        return null;
    }

    /**
     * Ao aprovar um pedido, marca automaticamente os dias na escala (turno Férias)
     * e na assiduidade (status = vacation).
     */
    public function markInSchedules(VacationRequest $request): void
    {
        $vacationShift = Shift::where('type', 'holiday')
            ->where(fn ($q) => $q->where('code', 'FÉ')->orWhere('code', 'FE')->orWhere('name', 'like', '%érias%'))
            ->first();

        $period = CarbonPeriod::create($request->start_date, $request->end_date);

        foreach ($period as $day) {
            if ($day->isWeekend()) {
                continue;
            }
            $date = $day->toDateString();

            // Escala
            if ($vacationShift) {
                ShiftSchedule::updateOrCreate(
                    ['employee_id' => $request->employee_id, 'date' => $date],
                    ['shift_id' => $vacationShift->id, 'notes' => 'Férias aprovadas #'.$request->id]
                );
            }

            // Assiduidade
            Attendance::updateOrCreate(
                ['employee_id' => $request->employee_id, 'date' => $date],
                ['status' => 'vacation', 'check_in' => null, 'check_out' => null, 'worked_hours' => null,
                 'notes' => 'Férias aprovadas #'.$request->id]
            );
        }
    }

    /**
     * Ao cancelar/rejeitar um pedido previamente aprovado, remove os marcadores.
     */
    public function removeFromSchedules(VacationRequest $request): void
    {
        $vacationShift = Shift::where('type', 'holiday')
            ->where(fn ($q) => $q->where('code', 'FÉ')->orWhere('code', 'FE')->orWhere('name', 'like', '%érias%'))
            ->first();

        $period = CarbonPeriod::create($request->start_date, $request->end_date);
        foreach ($period as $day) {
            if ($day->isWeekend()) continue;
            $date = $day->toDateString();
            if ($vacationShift) {
                ShiftSchedule::where('employee_id', $request->employee_id)
                    ->whereDate('date', $date)
                    ->where('shift_id', $vacationShift->id)
                    ->delete();
            }
            Attendance::where('employee_id', $request->employee_id)
                ->whereDate('date', $date)
                ->where('status', 'vacation')
                ->delete();
        }
    }

    /**
     * Verifica sobreposição com outros pedidos aprovados ou pendentes do funcionário.
     */
    public function hasOverlap(int $employeeId, string $from, string $to, ?int $excludeId = null): bool
    {
        return VacationRequest::where('employee_id', $employeeId)
            ->whereIn('status', ['approved', 'pending'])
            ->when($excludeId, fn ($q) => $q->where('id', '!=', $excludeId))
            ->where(fn ($q) => $q->whereBetween('start_date', [$from, $to])
                ->orWhereBetween('end_date', [$from, $to])
                ->orWhere(fn ($q2) => $q2->where('start_date', '<=', $from)->where('end_date', '>=', $to))
            )->exists();
    }
}
