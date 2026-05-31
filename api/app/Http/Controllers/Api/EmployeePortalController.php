<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Models\PortalToken;
use App\Models\SalarySlip;
use App\Models\ShiftSchedule;
use App\Models\VacationBalance;
use App\Models\VacationRequest;
use App\Models\Contract;
use App\Services\Documents\ContractDocumentService;
use App\Services\Documents\SalarySlipDocumentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

class EmployeePortalController extends Controller
{
    private function employee(Request $request)
    {
        return $request->user()->employee;
    }

    public function me(Request $request): JsonResponse
    {
        $employee = $this->employee($request);
        if (!$employee) return response()->json(['message' => 'Sem perfil de funcionário.'], 404);
        return response()->json($employee->load('contracts','familyMembers'));
    }

    public function downloadPdf(Request $request, int $slipId)
    {
        $employee = $this->employee($request);
        if (!$employee) abort(403);

        $slip = SalarySlip::where('id', $slipId)
            ->where('employee_id', $employee->id)
            ->firstOrFail();

        // usa PDF já gerado ou gera um novo
        $doc = Document::where('documentable_type', SalarySlip::class)
            ->where('documentable_id', $slip->id)
            ->where('type', 'pdf')
            ->latest()
            ->first();

        if (! $doc || ! Storage::disk('local')->exists($doc->path)) {
            $doc = app(SalarySlipDocumentService::class)->generatePdf($slip);
        }

        return Storage::disk('local')->response($doc->path, $doc->filename, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$doc->filename.'"',
        ]);
    }

    public function receiptSignature(Request $request, int $slipId)
    {
        $employee = $this->employee($request);
        if (!$employee) abort(403);

        $slip = SalarySlip::where('id', $slipId)
            ->where('employee_id', $employee->id)
            ->firstOrFail();

        abort_if(
            ! $slip->receipt_signature_path ||
            ! Storage::disk('local')->exists($slip->receipt_signature_path),
            404
        );

        return Storage::disk('local')->response($slip->receipt_signature_path);
    }

    public function salarySlips(Request $request): JsonResponse
    {
        $employee = $this->employee($request);
        if (!$employee) return response()->json(['data' => []]);
        return response()->json(
            SalarySlip::where('employee_id', $employee->id)
                ->orderByDesc('year')->orderByDesc('month')
                ->paginate(24)
        );
    }

    public function contracts(Request $request): JsonResponse
    {
        $employee = $this->employee($request);
        if (!$employee) return response()->json([]);

        return response()->json(
            Contract::where('employee_id', $employee->id)
                ->orderByDesc('start_date')
                ->get(['id','type','title','position','department','base_salary',
                       'food_allowance','transport_allowance','start_date','end_date','status'])
        );
    }

    public function signContract(Request $request, int $id): JsonResponse
    {
        $employee = $this->employee($request);
        if (!$employee) abort(403);

        $contract = Contract::where('id', $id)
            ->where('employee_id', $employee->id)
            ->firstOrFail();

        if ($contract->signed_at) {
            return response()->json(['message' => 'Contrato já assinado.'], 422);
        }

        $request->validate(['signature' => ['required', 'string']]);

        $base64 = preg_replace('#^data:image/\w+;base64,#i', '', $request->input('signature'));
        $path   = "contracts/{$contract->id}/employee_signature.png";
        Storage::disk('local')->put($path, base64_decode($base64));

        $contract->update([
            'employee_signature_path' => $path,
            'signed_at'               => now(),
        ]);

        // regenera o PDF com a assinatura incluída
        app(ContractDocumentService::class)->generatePdf($contract);

        return response()->json(['message' => 'Contrato assinado com sucesso.', 'signed_at' => $contract->signed_at]);
    }

    public function contractPdf(Request $request, int $id)
    {
        $employee = $this->employee($request);
        if (!$employee) abort(403);

        $contract = Contract::where('id', $id)
            ->where('employee_id', $employee->id)
            ->firstOrFail();

        $path = $contract->document_path && Storage::disk('local')->exists($contract->document_path)
            ? $contract->document_path
            : app(ContractDocumentService::class)->generatePdf($contract);

        $filename = basename($path);

        return Storage::disk('local')->response($path, $filename, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$filename.'"',
        ]);
    }

    public function confirmReceipt(Request $request, int $slipId): JsonResponse
    {
        $employee = $this->employee($request);
        if (!$employee) return response()->json(['message' => 'Sem perfil.'], 403);

        $request->validate(['password' => ['required', 'string']]);

        if (! Hash::check($request->input('password'), $request->user()->password)) {
            return response()->json(['message' => 'Senha incorrecta.'], 422);
        }

        $slip = SalarySlip::where('id', $slipId)
            ->where('employee_id', $employee->id)
            ->firstOrFail();

        if ($slip->receipt_confirmed_at) {
            return response()->json(['message' => 'Recibo já confirmado.'], 422);
        }

        $slip->update(['receipt_confirmed_at' => now()]);

        // copia a assinatura se a coluna já existir na BD
        try {
            $signaturePath = null;
            if ($employee->signature_path && Storage::disk('local')->exists($employee->signature_path)) {
                $dest = "salary-slips/{$slip->id}/receipt_signature.png";
                Storage::disk('local')->copy($employee->signature_path, $dest);
                $signaturePath = $dest;
            }
            $slip->update(['receipt_signature_path' => $signaturePath]);
        } catch (\Throwable) {
            // coluna ainda não migrada — confirmação continua sem assinatura
        }

        return response()->json(['message' => 'Recibo confirmado.']);
    }

    public function signature(Request $request): JsonResponse
    {
        $employee = $this->employee($request);
        if (!$employee) return response()->json(['message' => 'Sem perfil.'], 403);

        $request->validate(['signature' => ['required','string']]);

        $base64 = preg_replace('#^data:image/\w+;base64,#i', '', $request->input('signature'));
        $binary = base64_decode($base64);
        $path = "signatures/{$employee->id}.png";
        Storage::disk('local')->put($path, $binary);
        $employee->update(['signature_path' => $path]);

        return response()->json(['message' => 'Assinatura guardada.']);
    }

    public function getSignature(Request $request)
    {
        $employee = $this->employee($request);
        if (!$employee || !$employee->signature_path) abort(404);
        return Storage::disk('local')->response($employee->signature_path);
    }

    /** Troca um token de acesso único por uma sessão Sanctum. */
    public function loginWithToken(Request $request): JsonResponse
    {
        $request->validate(['token' => ['required', 'string']]);

        $record = PortalToken::with('user')
            ->where('token', $request->input('token'))
            ->first();

        if (!$record || !$record->isValid()) {
            return response()->json(['message' => 'Link inválido ou expirado.'], 401);
        }

        $record->update(['used_at' => now()]);

        $user  = $record->user;
        $token = $user->createToken('portal-sms')->plainTextToken;

        return response()->json([
            'token'          => $token,
            'user'           => $user->only(['id', 'name', 'email', 'role']),
            'must_set_password' => true,
        ]);
    }

    /** Férias: saldo + pedidos do funcionário. */
    public function vacations(Request $request): JsonResponse
    {
        $employee = $this->employee($request);
        if (!$employee) return response()->json(['message' => 'Sem perfil.'], 403);

        $year    = (int) ($request->query('year') ?? now()->year);
        $balance = VacationBalance::where('employee_id', $employee->id)
            ->where('year', $year)->first();

        $requests = VacationRequest::where('employee_id', $employee->id)
            ->orderByDesc('start_date')
            ->limit(24)
            ->get();

        return response()->json([
            'balance'  => $balance ? [
                'year'           => $balance->year,
                'entitled_days'  => $balance->entitled_days,
                'carried_over'   => $balance->carried_over,
                'extra_days'     => $balance->extra_days,
                'used_days'      => $balance->used_days,
                'total'          => $balance->totalDays(),
                'remaining'      => $balance->remainingDays(),
            ] : null,
            'requests' => $requests,
        ]);
    }

    /** Submeter pedido de férias. */
    public function requestVacation(Request $request): JsonResponse
    {
        $employee = $this->employee($request);
        if (!$employee) return response()->json(['message' => 'Sem perfil.'], 403);

        $data = $request->validate([
            'start_date'   => ['required', 'date', 'after_or_equal:today'],
            'end_date'     => ['required', 'date', 'after_or_equal:start_date'],
            'reason'       => ['nullable', 'string', 'max:500'],
        ]);

        // calcular dias úteis (simples: exclui sábado e domingo)
        $start = \Carbon\Carbon::parse($data['start_date']);
        $end   = \Carbon\Carbon::parse($data['end_date']);
        $workingDays = 0;
        for ($d = $start->copy(); $d->lte($end); $d->addDay()) {
            if (!$d->isWeekend()) $workingDays++;
        }

        $vr = VacationRequest::create([
            'employee_id'  => $employee->id,
            'start_date'   => $data['start_date'],
            'end_date'     => $data['end_date'],
            'working_days' => $workingDays,
            'reason'       => $data['reason'] ?? null,
            'status'       => 'pending',
        ]);

        return response()->json($vr, 201);
    }

    /** Escala do funcionário para um mês. */
    public function schedule(Request $request): JsonResponse
    {
        $employee = $this->employee($request);
        if (!$employee) return response()->json(['message' => 'Sem perfil.'], 403);

        $month = (int) ($request->query('month') ?? now()->month);
        $year  = (int) ($request->query('year')  ?? now()->year);

        $schedules = ShiftSchedule::with('shift')
            ->where('employee_id', $employee->id)
            ->whereYear('date', $year)
            ->whereMonth('date', $month)
            ->orderBy('date')
            ->get();

        return response()->json($schedules);
    }

    /** Avaliações concluídas do funcionário. */
    public function reviews(Request $request): \Illuminate\Http\JsonResponse
    {
        $employee = $this->employee($request);
        if (!$employee) return response()->json([]);

        $reviews = \App\Models\PerformanceReview::with(['reviewer:id,name', 'scores.criterion'])
            ->where('employee_id', $employee->id)
            ->where('status', 'completed')
            ->orderByDesc('conducted_at')
            ->get();

        return response()->json($reviews);
    }

    /** Permite ao funcionário definir a sua própria password após o primeiro login. */
    public function setPassword(Request $request): JsonResponse
    {
        $request->validate([
            'password'              => ['required', 'string', 'min:6', 'confirmed'],
            'password_confirmation' => ['required', 'string'],
        ]);

        $request->user()->update(['password' => Hash::make($request->input('password'))]);

        return response()->json(['message' => 'Password definida com sucesso.']);
    }
}
