<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\Shift;
use App\Models\ShiftSchedule;
use App\Services\ShiftRulesService;
use App\Support\Audit;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ShiftController extends Controller
{
    public function __construct(protected ShiftRulesService $rules) {}

    // ---- Definições de turnos ----

    public function indexShifts(): JsonResponse
    {
        return response()->json(Shift::orderBy('sort_order')->orderBy('name')->get());
    }

    public function storeShift(Request $request): JsonResponse
    {
        $shift = Shift::create($this->validateShift($request));
        Audit::log('created', $shift);

        return response()->json($shift, 201);
    }

    public function updateShift(Request $request, Shift $shift): JsonResponse
    {
        $shift->update($this->validateShift($request));

        return response()->json($shift);
    }

    public function destroyShift(Shift $shift): JsonResponse
    {
        $shift->delete();

        return response()->json(null, 204);
    }

    // ---- Escala mensal ----

    /**
     * Devolve funcionários ativos + todos os registos da escala do mês,
     * mais os turnos ativos para montar a grelha no frontend.
     */
    public function month(Request $request): JsonResponse
    {
        $data = $request->validate([
            'month' => ['required', 'integer', 'between:1,12'],
            'year' => ['required', 'integer', 'between:2000,2100'],
            'department' => ['nullable', 'string'],
        ]);

        $start = Carbon::create($data['year'], $data['month'], 1)->startOfMonth();
        $end = (clone $start)->endOfMonth();

        $empQuery = Employee::where('active', true)->orderBy('department')->orderBy('full_name');
        if (! empty($data['department'])) {
            $empQuery->where('department', $data['department']);
        }
        $employees = $empQuery->get(['id', 'full_name', 'department']);

        $schedules = ShiftSchedule::with('shift:id,name,code,color,type,duration_hours,counts_as_worked,crosses_midnight')
            ->whereBetween('date', [$start->toDateString(), $end->toDateString()])
            ->get(['id', 'employee_id', 'shift_id', 'date', 'notes']);

        $shifts = Shift::active()->orderBy('sort_order')->orderBy('name')->get();

        $departments = Employee::where('active', true)->distinct()->pluck('department')->filter()->sort()->values();

        return response()->json([
            'year' => (int) $data['year'],
            'month' => (int) $data['month'],
            'days_in_month' => $start->daysInMonth,
            'employees' => $employees,
            'schedules' => $schedules,
            'shifts' => $shifts,
            'departments' => $departments,
        ]);
    }

    /** Escala resumo (horas, piquetes, folgas) */
    public function summary(Request $request): JsonResponse
    {
        $data = $request->validate([
            'month' => ['required', 'integer', 'between:1,12'],
            'year' => ['required', 'integer', 'between:2000,2100'],
        ]);

        return response()->json([
            'summary' => $this->rules->summaryForMonth($data['month'], $data['year']),
            'violations' => $this->rules->violationsForMonth($data['month'], $data['year']),
        ]);
    }

    /** Atribui ou remove o turno de um funcionário num dia. */
    public function assign(Request $request): JsonResponse
    {
        $data = $request->validate([
            'employee_id' => ['required', 'exists:employees,id'],
            'shift_id' => ['nullable', 'exists:shifts,id'],
            'date' => ['required', 'date'],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        if (! $data['shift_id']) {
            ShiftSchedule::where('employee_id', $data['employee_id'])
                ->whereDate('date', $data['date'])
                ->delete();

            return response()->json(['removed' => true]);
        }

        $schedule = ShiftSchedule::updateOrCreate(
            ['employee_id' => $data['employee_id'], 'date' => $data['date']],
            ['shift_id' => $data['shift_id'], 'notes' => $data['notes'] ?? null],
        );

        return response()->json($schedule->load('shift'));
    }

    /**
     * Atribui o mesmo turno a vários funcionários num intervalo de datas,
     * opcionalmente só nos dias de semana ou fim-de-semana.
     */
    public function bulkAssign(Request $request): JsonResponse
    {
        $data = $request->validate([
            'employee_ids' => ['required', 'array', 'min:1'],
            'employee_ids.*' => ['integer', 'exists:employees,id'],
            'shift_id' => ['required', 'exists:shifts,id'],
            'date_from' => ['required', 'date'],
            'date_to' => ['required', 'date', 'after_or_equal:date_from'],
            'weekdays_only' => ['boolean'],
            'weekends_only' => ['boolean'],
            'overwrite' => ['boolean'],
        ]);

        $from = Carbon::parse($data['date_from']);
        $to = Carbon::parse($data['date_to']);
        $count = 0;

        for ($d = $from->copy(); $d->lte($to); $d->addDay()) {
            if (($data['weekdays_only'] ?? false) && $d->isWeekend()) {
                continue;
            }
            if (($data['weekends_only'] ?? false) && ! $d->isWeekend()) {
                continue;
            }
            foreach ($data['employee_ids'] as $empId) {
                $exists = ShiftSchedule::where('employee_id', $empId)->whereDate('date', $d)->exists();
                if ($exists && ! ($data['overwrite'] ?? false)) {
                    continue;
                }
                ShiftSchedule::updateOrCreate(
                    ['employee_id' => $empId, 'date' => $d->toDateString()],
                    ['shift_id' => $data['shift_id']],
                );
                $count++;
            }
        }

        Audit::log("shifts_bulk_assign:{$count}");

        return response()->json(['assigned' => $count]);
    }

    /**
     * Preenche automaticamente o dia seguinte a um turno noturno como "Folga"
     * para todos os funcionários com essa situação no mês.
     */
    public function autoRest(Request $request): JsonResponse
    {
        $data = $request->validate([
            'month' => ['required', 'integer', 'between:1,12'],
            'year' => ['required', 'integer', 'between:2000,2100'],
        ]);

        $restShift = Shift::where('type', 'rest')->orderBy('sort_order')->first();
        if (! $restShift) {
            return response()->json(['error' => 'Nenhum turno do tipo "Folga" definido.'], 422);
        }

        // Inclui piquetes (oncall) e turnos noturnos regulares (passa meia-noite ou início ≥ 20:00).
        $nightIds = Shift::where(fn ($q) =>
            $q->where('type', 'oncall')
              ->orWhere(fn ($q2) =>
                  $q2->where('type', 'regular')
                     ->where(fn ($q3) => $q3->where('crosses_midnight', true)->orWhere('start_time', '>=', '20:00'))
              )
        )->pluck('id');

        $start = Carbon::create($data['year'], $data['month'], 1);
        $end = (clone $start)->endOfMonth();

        $nights = ShiftSchedule::whereIn('shift_id', $nightIds)
            ->whereBetween('date', [$start->toDateString(), $end->copy()->subDay()->toDateString()])
            ->get();

        $applied = 0;
        foreach ($nights as $entry) {
            $nextDay = Carbon::parse($entry->date)->addDay()->toDateString();
            $exists = ShiftSchedule::where('employee_id', $entry->employee_id)->whereDate('date', $nextDay)->exists();
            if (! $exists) {
                ShiftSchedule::create([
                    'employee_id' => $entry->employee_id,
                    'shift_id' => $restShift->id,
                    'date' => $nextDay,
                    'notes' => 'Folga automática (pós-noite)',
                ]);
                $applied++;
            }
        }

        return response()->json(['rest_days_applied' => $applied]);
    }

    // ---- helpers ----

    private function validateShift(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'code' => ['required', 'string', 'max:10'],
            'type' => ['required', Rule::in(['regular', 'oncall', 'rest', 'holiday'])],
            'start_time' => ['nullable', 'string', 'max:5'],
            'end_time' => ['nullable', 'string', 'max:5'],
            'duration_hours' => ['nullable', 'integer', 'min:0', 'max:24'],
            'crosses_midnight' => ['boolean'],
            'color' => ['nullable', 'string', 'max:7'],
            'counts_as_worked' => ['boolean'],
            'active' => ['boolean'],
            'sort_order' => ['integer'],
        ]);
    }
}
