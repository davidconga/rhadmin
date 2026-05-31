<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\Employee;
use App\Support\Audit;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AttendanceController extends Controller
{
    /**
     * Dados para a folha mensal: funcionários ativos + registos do mês.
     */
    public function month(Request $request): JsonResponse
    {
        $data = $request->validate([
            'month' => ['required', 'integer', 'between:1,12'],
            'year' => ['required', 'integer', 'between:2000,2100'],
        ]);

        $start = Carbon::create($data['year'], $data['month'], 1)->startOfMonth();
        $end = (clone $start)->endOfMonth();

        $employees = Employee::where('active', true)
            ->orderBy('full_name')
            ->get(['id', 'full_name', 'department']);

        $attendances = Attendance::whereBetween('date', [$start->toDateString(), $end->toDateString()])
            ->get(['id', 'employee_id', 'date', 'status', 'check_in', 'check_out', 'worked_hours', 'notes']);

        return response()->json([
            'year' => (int) $data['year'],
            'month' => (int) $data['month'],
            'days_in_month' => $start->daysInMonth,
            'employees' => $employees,
            'attendances' => $attendances,
        ]);
    }

    /**
     * Resumo por funcionário (contagens + taxa de presença) para o mês.
     */
    public function summary(Request $request): JsonResponse
    {
        $data = $request->validate([
            'month' => ['required', 'integer', 'between:1,12'],
            'year' => ['required', 'integer', 'between:2000,2100'],
        ]);

        $start = Carbon::create($data['year'], $data['month'], 1)->startOfMonth();
        $end = (clone $start)->endOfMonth();

        $employees = Employee::where('active', true)->orderBy('full_name')->get(['id', 'full_name', 'department']);
        $records = Attendance::whereBetween('date', [$start->toDateString(), $end->toDateString()])->get();

        $rows = $employees->map(function ($emp) use ($records) {
            $own = $records->where('employee_id', $emp->id);
            $count = fn ($s) => $own->where('status', $s)->count();

            $present = $count('present');
            $late = $count('late');
            $absent = $count('absent');
            $justified = $count('justified');
            $sick = $count('sick');
            $expected = $present + $late + $absent + $justified + $sick;

            return [
                'employee_id' => $emp->id,
                'full_name' => $emp->full_name,
                'department' => $emp->department,
                'present' => $present,
                'late' => $late,
                'absent' => $absent,
                'justified' => $justified,
                'vacation' => $count('vacation'),
                'sick' => $sick,
                'holiday' => $count('holiday'),
                'worked_hours' => round((float) $own->sum('worked_hours'), 2),
                'rate' => $expected > 0 ? round((($present + $late) / $expected) * 100, 1) : null,
            ];
        });

        return response()->json($rows);
    }

    /**
     * Cria ou atualiza o registo de um funcionário num dia.
     */
    public function upsert(Request $request): JsonResponse
    {
        $data = $request->validate([
            'employee_id' => ['required', 'exists:employees,id'],
            'date' => ['required', 'date'],
            'status' => ['required', Rule::in(Attendance::STATUSES)],
            'check_in' => ['nullable', 'string', 'max:5'],
            'check_out' => ['nullable', 'string', 'max:5'],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        $data['worked_hours'] = Attendance::computeHours($data['check_in'] ?? null, $data['check_out'] ?? null);

        $attendance = Attendance::updateOrCreate(
            ['employee_id' => $data['employee_id'], 'date' => $data['date']],
            $data,
        );

        return response()->json($attendance);
    }

    /**
     * Marca o mesmo estado para vários funcionários num dia (ou todos os ativos).
     */
    public function bulk(Request $request): JsonResponse
    {
        $data = $request->validate([
            'date' => ['required', 'date'],
            'status' => ['required', Rule::in(Attendance::STATUSES)],
            'employee_ids' => ['array'],
            'employee_ids.*' => ['integer', 'exists:employees,id'],
        ]);

        $ids = $data['employee_ids'] ?? Employee::where('active', true)->pluck('id')->all();

        foreach ($ids as $id) {
            Attendance::updateOrCreate(
                ['employee_id' => $id, 'date' => $data['date']],
                ['status' => $data['status']],
            );
        }
        Audit::log("attendance_bulk:{$data['status']}:{$data['date']}");

        return response()->json(['marked' => count($ids)]);
    }

    public function destroy(Attendance $attendance): JsonResponse
    {
        $attendance->delete();

        return response()->json(null, 204);
    }
}
