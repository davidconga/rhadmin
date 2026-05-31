<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\Employee;
use App\Models\SalarySlip;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Endpoints para integrações externas autenticados via X-Api-Key.
 */
class ExternalController extends Controller
{
    // ─── Funcionários ────────────────────────────────────────────

    public function employees(Request $request): JsonResponse
    {
        $query = Employee::query()->where('active', true);

        if ($companyId = $request->attributes->get('company_id')) {
            $query->where('company_id', $companyId);
        }

        return response()->json(
            $query->orderBy('full_name')
                ->get(['id', 'full_name', 'bi_nif', 'biometric_id', 'position', 'department', 'company_id', 'active'])
        );
    }

    public function upsertEmployee(Request $request): JsonResponse
    {
        $data = $request->validate([
            'full_name'    => ['required', 'string', 'max:255'],
            'bi_nif'       => ['nullable', 'string'],
            'biometric_id' => ['nullable', 'string'],
            'position'     => ['nullable', 'string'],
            'department'   => ['nullable', 'string'],
            'base_salary'  => ['nullable', 'numeric', 'min:0'],
        ]);

        if ($companyId = $request->attributes->get('company_id')) {
            $data['company_id'] = $companyId;
        }

        $employee = Employee::updateOrCreate(
            ['bi_nif' => $data['bi_nif'] ?? null],
            array_merge($data, ['active' => true, 'food_allowance' => 0, 'transport_allowance' => 0, 'social_security_rate' => 3])
        );

        return response()->json($employee, $employee->wasRecentlyCreated ? 201 : 200);
    }

    // ─── Assiduidade ─────────────────────────────────────────────

    public function pushAttendance(Request $request): JsonResponse
    {
        $records = $request->validate([
            'records'                => ['required', 'array', 'max:500'],
            'records.*.employee_id'  => ['required', 'integer', 'exists:employees,id'],
            'records.*.date'         => ['required', 'date'],
            'records.*.status'       => ['required', 'in:present,late,absent,justified,vacation,sick,holiday'],
            'records.*.check_in'     => ['nullable', 'date_format:H:i'],
            'records.*.check_out'    => ['nullable', 'date_format:H:i'],
        ])['records'];

        $created = 0;
        foreach ($records as $r) {
            Attendance::updateOrCreate(
                ['employee_id' => $r['employee_id'], 'date' => $r['date']],
                ['status' => $r['status'], 'check_in' => $r['check_in'] ?? null, 'check_out' => $r['check_out'] ?? null]
            );
            $created++;
        }

        return response()->json(['synced' => $created]);
    }

    // ─── Recibos ─────────────────────────────────────────────────

    public function salarySlips(Request $request): JsonResponse
    {
        $query = SalarySlip::with('employee:id,full_name,bi_nif');

        if ($request->filled('month')) $query->where('month', (int) $request->query('month'));
        if ($request->filled('year'))  $query->where('year',  (int) $request->query('year'));
        if ($request->filled('status')) $query->where('status', $request->query('status'));

        if ($companyId = $request->attributes->get('company_id')) {
            $query->whereHas('employee', fn ($q) => $q->where('company_id', $companyId));
        }

        return response()->json($query->orderByDesc('year')->orderByDesc('month')->paginate(100));
    }

    // ─── Info da API ─────────────────────────────────────────────

    public function info(): JsonResponse
    {
        return response()->json([
            'version'   => '1.0',
            'endpoints' => [
                'GET  /external/employees'      => 'Listar funcionários activos',
                'POST /external/employees'      => 'Criar ou actualizar funcionário (upsert por bi_nif)',
                'POST /external/attendances'    => 'Enviar registos de assiduidade em lote',
                'GET  /external/salary-slips'   => 'Listar recibos de salário',
            ],
            'auth'      => 'Cabeçalho X-Api-Key + X-Tenant obrigatórios em todos os pedidos.',
        ]);
    }
}
