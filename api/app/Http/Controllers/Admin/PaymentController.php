<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\PaymentRequest;
use App\Services\Documents\FacturaReciboService;
use App\Services\PlatformSmsService;
use App\Services\SmsService;
use App\Services\TenantService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class PaymentController extends Controller
{
    public function __construct(protected TenantService $tenants) {}
    public function index(Request $request): JsonResponse
    {
        $query = PaymentRequest::with(['tenant', 'plan'])->orderByDesc('created_at');

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        return response()->json($query->paginate(20));
    }

    public function proof(PaymentRequest $payment)
    {
        abort_if(! $payment->proof_path || ! Storage::disk('local')->exists($payment->proof_path), 404);
        return Storage::disk('local')->response($payment->proof_path);
    }

    public function approve(PaymentRequest $payment): JsonResponse
    {
        if ($payment->status !== 'pending') {
            return response()->json(['message' => 'Pedido já processado.'], 422);
        }

        $payment->update([
            'status'      => 'paid',
            'reviewed_at' => now(),
        ]);

        $tenant = $payment->tenant;

        // Activa o tenant com o plano pago
        $tenant->update([
            'plan_id'             => $payment->plan_id,
            'subscription_status' => 'active',
            'subscribed_at'       => now(),
        ]);

        // Gera a Factura-Recibo
        try {
            app(FacturaReciboService::class)->generate($payment);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('FR generation failed: ' . $e->getMessage());
        }

        // Envia SMS ao admin do tenant
        if ($payment->contact_phone) {
            try {
                app(PlatformSmsService::class)->send(
                    $payment->contact_phone,
                    "RHadmin: O seu plano {$payment->plan->name} foi activado! Ja pode aceder à plataforma. Ref: {$payment->reference}."
                );
            } catch (\Throwable) {}
        }

        return response()->json(['message' => 'Pagamento aprovado e plano activado.']);
    }

    public function downloadFr(PaymentRequest $payment)
    {
        if (! $payment->fr_path) {
            // Gera agora se ainda não existe (retrocompatibilidade)
            try {
                app(FacturaReciboService::class)->generate($payment);
                $payment->refresh();
            } catch (\Throwable $e) {
                abort(404, 'Factura-Recibo não disponível.');
            }
        }

        abort_if(! Storage::disk('local')->exists($payment->fr_path), 404);

        $filename = "FR-{$payment->fr_number}-{$payment->tenant->slug}.pdf";
        $filename = str_replace(['/', ' '], ['-', '-'], $filename);

        return Storage::disk('local')->response($payment->fr_path, $filename, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => 'inline; filename="' . $filename . '"',
        ]);
    }

    public function reject(Request $request, PaymentRequest $payment): JsonResponse
    {
        if ($payment->status !== 'pending') {
            return response()->json(['message' => 'Pedido já processado.'], 422);
        }

        $payment->update([
            'status'      => 'rejected',
            'notes'       => $request->input('reason'),
            'reviewed_at' => now(),
        ]);

        return response()->json(['message' => 'Pedido rejeitado.']);
    }
}
