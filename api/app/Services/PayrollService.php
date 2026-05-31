<?php

namespace App\Services;

use App\Models\Attendance;
use App\Models\Employee;
use App\Models\SalarySlip;
use App\Models\Setting;
use Carbon\Carbon;

/**
 * Monta os valores de um recibo de salário a partir de um funcionário.
 *
 * Premissas (simplificadas, documentadas para fácil ajuste):
 *  - Segurança Social (INSS): aplica a taxa do funcionário (default 3%) ao
 *    salário base.
 *  - Base de IRT (matéria coletável) = rendimentos tributáveis − INSS, em que
 *    os subsídios de alimentação e transporte são tratados como ISENTOS.
 *  - Salário bruto = soma de todos os rendimentos.
 *  - Líquido = bruto − (IRT + INSS + outros descontos).
 *  - Assiduidade (opcional, setting 'payroll_use_attendance'): faltas
 *    injustificadas descontam a taxa diária; horas extra (acima do horário
 *    padrão) acrescem ao recibo. Overrides manuais têm sempre prioridade.
 */
class PayrollService
{
    public function __construct(protected IrtCalculatorService $irt) {}

    /**
     * Calcula os campos do recibo. Aceita overrides (ex.: horas extra,
     * outros rendimentos/descontos) introduzidos manualmente.
     *
     * @param  array<string, float>  $overrides
     * @return array<string, float|int>
     */
    public function compute(Employee $employee, int $month, int $year, array $overrides = []): array
    {
        $baseSalary = (float) ($overrides['base_salary'] ?? $employee->base_salary);
        $food = (float) ($overrides['food_allowance'] ?? $employee->food_allowance);
        $transport = (float) ($overrides['transport_allowance'] ?? $employee->transport_allowance);
        $otherIncome = (float) ($overrides['other_income'] ?? 0);

        // Taxa de INSS do funcionário (% global definida em Configurações → INSS).
        $ssRate = (float) Setting::get('inss_employee_rate', $employee->social_security_rate);
        $exemptAllowances = (bool) Setting::get('irt_exempt_allowances', true);

        // Ajustes de assiduidade (faltas e horas extra), se ativado.
        $adj = $this->attendanceAdjustments($employee, $month, $year, $baseSalary);

        $overtime = (float) ($overrides['overtime'] ?? $adj['overtime_pay']);
        $otherDeductions = (float) ($overrides['other_deductions'] ?? $adj['absence_deduction']);

        $grossSalary = $baseSalary + $food + $transport + $overtime + $otherIncome;

        $socialSecurity = round($baseSalary * ($ssRate / 100), 2);

        // Base de IRT: subsídios alimentação/transporte isentos conforme definição.
        $irtBase = $exemptAllowances
            ? ($baseSalary + $overtime + $otherIncome) - $socialSecurity
            : $grossSalary - $socialSecurity;
        $irtTax = $this->irt->calculate(max($irtBase, 0));

        $totalDeductions = round($irtTax + $socialSecurity + $otherDeductions, 2);
        $netSalary = round($grossSalary - $totalDeductions, 2);

        return [
            'employee_id' => $employee->id,
            'month' => $month,
            'year' => $year,
            'base_salary' => round($baseSalary, 2),
            'food_allowance' => round($food, 2),
            'transport_allowance' => round($transport, 2),
            'overtime' => round($overtime, 2),
            'other_income' => round($otherIncome, 2),
            'irt_tax' => $irtTax,
            'social_security' => $socialSecurity,
            'other_deductions' => round($otherDeductions, 2),
            'absence_days' => $adj['absence_days'],
            'overtime_hours' => $adj['overtime_hours'],
            'gross_salary' => round($grossSalary, 2),
            'total_deductions' => $totalDeductions,
            'net_salary' => $netSalary,
        ];
    }

    /**
     * A partir da assiduidade do mês, calcula faltas injustificadas (desconto)
     * e horas extra (pagamento). Devolve zeros se a integração estiver desligada.
     *
     * @return array{absence_days:int, absence_deduction:float, overtime_hours:float, overtime_pay:float}
     */
    public function attendanceAdjustments(Employee $employee, int $month, int $year, float $baseSalary): array
    {
        $zero = ['absence_days' => 0, 'absence_deduction' => 0.0, 'overtime_hours' => 0.0, 'overtime_pay' => 0.0];

        if (! Setting::get('payroll_use_attendance', false)) {
            return $zero;
        }

        $stdDays = max((float) Setting::get('standard_working_days', 22), 1);
        $stdHours = max((float) Setting::get('standard_daily_hours', 8), 1);
        $multiplier = (float) Setting::get('overtime_multiplier', 1.5);

        $start = Carbon::create($year, $month, 1)->startOfMonth();
        $end = (clone $start)->endOfMonth();

        $records = Attendance::where('employee_id', $employee->id)
            ->whereBetween('date', [$start->toDateString(), $end->toDateString()])
            ->get();

        if ($records->isEmpty()) {
            return $zero;
        }

        $absenceDays = $records->where('status', 'absent')->count();
        $overtimeHours = $records
            ->whereIn('status', Attendance::PRESENT_STATUSES)
            ->sum(fn ($r) => max(0, (float) $r->worked_hours - $stdHours));
        $overtimeHours = round($overtimeHours, 2);

        $dailyRate = $baseSalary / $stdDays;
        $hourlyRate = $baseSalary / ($stdDays * $stdHours);

        return [
            'absence_days' => $absenceDays,
            'absence_deduction' => round($dailyRate * $absenceDays, 2),
            'overtime_hours' => $overtimeHours,
            'overtime_pay' => round($hourlyRate * $multiplier * $overtimeHours, 2),
        ];
    }

    /**
     * Cria ou atualiza (recalcula) o recibo de um funcionário para o mês/ano.
     */
    public function generateFor(Employee $employee, int $month, int $year, array $overrides = []): SalarySlip
    {
        $data = $this->compute($employee, $month, $year, $overrides);

        return SalarySlip::updateOrCreate(
            ['employee_id' => $employee->id, 'month' => $month, 'year' => $year],
            $data + ['status' => 'draft'],
        );
    }
}
