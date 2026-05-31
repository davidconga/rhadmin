<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\VacationBalance;
use App\Models\VacationRequest;
use App\Services\VacationService;
use App\Support\Audit;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VacationController extends Controller
{
    public function __construct(protected VacationService $svc) {}

    // ---- Pedidos ----

    public function index(Request $request): JsonResponse
    {
        $query = VacationRequest::with('employee:id,full_name,department', 'approver:id,name')
            ->orderByDesc('created_at');

        foreach (['status', 'employee_id'] as $f) {
            if ($request->filled($f)) $query->where($f, $request->query($f));
        }
        if ($request->filled('year')) {
            $query->whereYear('start_date', $request->query('year'));
        }

        return response()->json($query->paginate((int) $request->query('per_page', 20)));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'employee_id' => ['required', 'exists:employees,id'],
            'start_date'  => ['required', 'date'],
            'end_date'    => ['required', 'date', 'after_or_equal:start_date'],
            'reason'      => ['nullable', 'string', 'max:500'],
        ]);

        $from = $data['start_date'];
        $to   = $data['end_date'];
        $year = (int) Carbon::parse($from)->format('Y');

        if ($this->svc->hasOverlap($data['employee_id'], $from, $to)) {
            return response()->json(['message' => 'Período sobrepõe-se com outro pedido existente.'], 422);
        }

        $workingDays = $this->svc->countWorkingDays($from, $to);
        if ($workingDays === 0) {
            return response()->json(['message' => 'O período não contém dias úteis.'], 422);
        }

        $emp = Employee::findOrFail($data['employee_id']);
        if ($err = $this->svc->checkBalance($emp, $workingDays, $year)) {
            return response()->json(['message' => $err], 422);
        }

        $req = VacationRequest::create([
            'employee_id'  => $data['employee_id'],
            'start_date'   => $from,
            'end_date'     => $to,
            'working_days' => $workingDays,
            'reason'       => $data['reason'] ?? null,
            'status'       => 'pending',
        ]);

        Audit::log('vacation_requested', $req);

        return response()->json($req->load('employee:id,full_name'), 201);
    }

    public function show(VacationRequest $vacation): JsonResponse
    {
        return response()->json($vacation->load('employee', 'approver:id,name'));
    }

    public function approve(Request $request, VacationRequest $vacation): JsonResponse
    {
        abort_unless($vacation->status === 'pending', 422, 'Apenas pedidos pendentes podem ser aprovados.');

        $vacation->update([
            'status'      => 'approved',
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
        ]);

        $this->svc->markInSchedules($vacation);
        $this->svc->recalcUsed($vacation->employee, (int) $vacation->start_date->format('Y'));

        Audit::log('vacation_approved', $vacation);

        return response()->json($vacation->fresh()->load('approver:id,name'));
    }

    public function reject(Request $request, VacationRequest $vacation): JsonResponse
    {
        abort_unless($vacation->status === 'pending', 422, 'Apenas pedidos pendentes podem ser rejeitados.');

        $data = $request->validate(['reason' => ['required', 'string', 'max:500']]);

        $vacation->update([
            'status'           => 'rejected',
            'approved_by'      => $request->user()->id,
            'approved_at'      => now(),
            'rejection_reason' => $data['reason'],
        ]);

        Audit::log('vacation_rejected', $vacation);

        return response()->json($vacation->fresh());
    }

    public function cancel(Request $request, VacationRequest $vacation): JsonResponse
    {
        abort_if($vacation->status === 'rejected', 422, 'Pedido já rejeitado.');

        $wasApproved = $vacation->status === 'approved';
        $vacation->update(['status' => 'cancelled']);

        if ($wasApproved) {
            $this->svc->removeFromSchedules($vacation);
            $this->svc->recalcUsed($vacation->employee, (int) $vacation->start_date->format('Y'));
        }

        Audit::log('vacation_cancelled', $vacation);

        return response()->json($vacation->fresh());
    }

    // ---- Saldos ----

    public function balances(Request $request): JsonResponse
    {
        $year = (int) ($request->query('year', now()->year));

        $employees = Employee::where('active', true)->orderBy('full_name')->get();
        $balances  = VacationBalance::where('year', $year)
            ->get()->keyBy('employee_id');

        $result = $employees->map(function ($emp) use ($year, $balances) {
            $bal = $balances[$emp->id] ?? $this->svc->balance($emp, $year);
            return [
                'employee_id'   => $emp->id,
                'full_name'     => $emp->full_name,
                'department'    => $emp->department,
                'year'          => $year,
                'entitled_days' => $bal->entitled_days,
                'carried_over'  => $bal->carried_over,
                'extra_days'    => $bal->extra_days,
                'total_days'    => $bal->totalDays(),
                'used_days'     => $bal->used_days,
                'remaining'     => $bal->remainingDays(),
            ];
        });

        return response()->json($result);
    }

    public function updateBalance(Request $request, Employee $employee): JsonResponse
    {
        $data = $request->validate([
            'year'          => ['required', 'integer'],
            'entitled_days' => ['required', 'integer', 'min:0', 'max:365'],
            'carried_over'  => ['nullable', 'integer', 'min:0'],
            'extra_days'    => ['nullable', 'integer', 'min:0'],
        ]);

        $balance = VacationBalance::updateOrCreate(
            ['employee_id' => $employee->id, 'year' => $data['year']],
            [
                'entitled_days' => $data['entitled_days'],
                'carried_over'  => $data['carried_over'] ?? 0,
                'extra_days'    => $data['extra_days'] ?? 0,
            ]
        );

        return response()->json($balance);
    }

    // ---- Calendário ----

    /**
     * Devolve todos os pedidos aprovados num intervalo de datas, para o calendário.
     */
    public function calendar(Request $request): JsonResponse
    {
        $data = $request->validate([
            'from' => ['required', 'date'],
            'to'   => ['required', 'date', 'after_or_equal:from'],
        ]);

        $requests = VacationRequest::with('employee:id,full_name,department')
            ->where('status', 'approved')
            ->where('start_date', '<=', $data['to'])
            ->where('end_date', '>=', $data['from'])
            ->get();

        return response()->json($requests);
    }

    /**
     * Calcula os dias úteis de um período (helper para o frontend).
     */
    public function workingDays(Request $request): JsonResponse
    {
        $data = $request->validate([
            'from' => ['required', 'date'],
            'to'   => ['required', 'date', 'after_or_equal:from'],
        ]);

        return response()->json([
            'working_days' => $this->svc->countWorkingDays($data['from'], $data['to']),
        ]);
    }
}
