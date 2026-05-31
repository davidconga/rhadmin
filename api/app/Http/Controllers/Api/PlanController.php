<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PaymentRequest;
use App\Models\Plan;
use App\Models\Tenant;
use App\Services\SmsUsageService;
use App\Services\PlanLimitService;
use App\Services\PlatformSmsService;
use App\Services\SmsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class PlanController extends Controller
{
    /** Lista pública de planos disponíveis. */
    public function index(): JsonResponse
    {
        return response()->json(
            Plan::where('active', true)->orderBy('sort_order')->get()
        );
    }

    /** Devolve a subscrição actual do tenant identificado por X-Tenant. */
    public function current(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        if (! $tenant) {
            return response()->json(['message' => 'Tenant não identificado.'], 400);
        }

        $tenant->load('plan');

        $smsUsage = SmsUsageService::pendingCost($tenant->id);

        $limits  = app(PlanLimitService::class);
        $usage    = $limits->usage($tenant);
        $features = $limits->planFeatures($tenant);

        return response()->json([
            'tenant'               => $tenant->only(['id', 'name', 'slug', 'subscription_status', 'trial_ends_at', 'subscribed_at']),
            'plan'                 => $tenant->plan,
            'usage'                => $usage,
            'features'             => $features,
            'trial_days_remaining'        => $tenant->trial_ends_at
                ? max(0, (int) ceil(now()->floatDiffInDays($tenant->trial_ends_at, false)))
                : null,
            'subscription_days_remaining' => $tenant->subscription_status === 'active' && $tenant->subscribed_at
                ? (function () use ($tenant) {
                    $subscribed = \Carbon\Carbon::parse($tenant->subscribed_at);
                    $next = $subscribed->copy()->addMonthsNoOverflow(
                        (int) ceil(now()->floatDiffInMonths($subscribed, false))
                    );
                    if ($next->lte(now())) $next->addMonthNoOverflow();
                    return max(0, (int) ceil(now()->floatDiffInDays($next, false)));
                })()
                : null,
            'sms_usage'            => [
                'count'         => $smsUsage['count'],
                'cost'          => $smsUsage['cost'],
                'price_per_sms' => SmsUsageService::pricePerSms(),
            ],
        ]);
    }

    /** Cria um pedido de pagamento para activar/mudar plano. */
    public function upgrade(Request $request): JsonResponse
    {
        $data = $request->validate([
            'plan_slug' => ['required', 'string', 'exists:central.plans,slug'],
        ]);

        $tenant = $request->attributes->get('tenant');
        $plan   = Plan::where('slug', $data['plan_slug'])->firstOrFail();

        // Cancela pedidos pendentes anteriores para este tenant
        PaymentRequest::where('tenant_id', $tenant->id)
            ->where('status', 'pending')
            ->update(['status' => 'rejected', 'notes' => 'Substituído por novo pedido', 'reviewed_at' => now()]);

        $reference = strtoupper(Str::random(3)) . '-' . now()->format('ymd') . '-' . str_pad($tenant->id, 3, '0', STR_PAD_LEFT);

        // Tenta obter o telefone do admin via o seu funcionário ligado
        $adminPhone = null;
        try {
            $adminUser = \App\Models\User::where('role', 'admin')->first();
            if ($adminUser?->employee_id) {
                $adminPhone = \App\Models\Employee::find($adminUser->employee_id)?->phone;
            }
            if (! $adminPhone) {
                $adminPhone = \App\Models\Employee::whereNotNull('phone')->value('phone');
            }
        } catch (\Throwable) {}

        // Proração: se o tenant tem plano activo com dias restantes,
        // desconta o valor diário do plano anterior × dias restantes
        $discount = 0;
        if ($tenant->subscription_status === 'active' && $tenant->subscribed_at && $tenant->plan) {
            $subscribed = \Carbon\Carbon::parse($tenant->subscribed_at);
            $next = $subscribed->copy()->addMonthsNoOverflow(
                (int) ceil(now()->floatDiffInMonths($subscribed, false))
            );
            if ($next->lte(now())) $next->addMonthNoOverflow();
            $remainingDays = max(0, (int) ceil(now()->floatDiffInDays($next, false)));

            if ($remainingDays > 0) {
                $dailyRate = (int) round($tenant->plan->price_aoa / 30);
                $discount  = min($plan->price_aoa, $dailyRate * $remainingDays);
            }
        }

        $amountToPay = max(0, $plan->price_aoa - $discount);

        $paymentRequest = PaymentRequest::create([
            'tenant_id'     => $tenant->id,
            'plan_id'       => $plan->id,
            'reference'     => $reference,
            'amount'        => $amountToPay,
            'discount'      => $discount,
            'status'        => 'pending',
            'contact_phone' => $adminPhone,
        ]);

        $ps = \Illuminate\Support\Facades\DB::connection('central')
            ->table('platform_settings')
            ->whereIn('key', ['payment_iban','payment_bank','payment_beneficiary'])
            ->pluck('value', 'key');

        return response()->json([
            'reference'       => $reference,
            'amount'          => $amountToPay,
            'original_amount' => $plan->price_aoa,
            'discount'        => $discount,
            'plan'            => $plan->only(['slug', 'name']),
            'iban'            => $ps['payment_iban']        ?? env('PAYMENT_IBAN', '—'),
            'bank'            => $ps['payment_bank']        ?? env('PAYMENT_BANK', '—'),
            'beneficiary'     => $ps['payment_beneficiary'] ?? env('PAYMENT_BENEFICIARY', '—'),
        ], 201);
    }

    /** Upload do comprovativo de pagamento. */
    public function uploadProof(Request $request): JsonResponse
    {
        $request->validate([
            'proof' => ['required', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:5120'],
        ]);

        $tenant  = $request->attributes->get('tenant');
        $payment = PaymentRequest::where('tenant_id', $tenant->id)
            ->where('status', 'pending')
            ->orderByDesc('created_at')
            ->firstOrFail();

        $path = $request->file('proof')->store("payments/{$payment->id}/proof", 'local');
        $payment->update(['proof_path' => $path]);

        // Notifica o administrador da plataforma
        $notifyPhone = env('PAYMENT_NOTIFY_PHONE');
        if ($notifyPhone) {
            try {
                $tenantName = $payment->tenant->name ?? 'Tenant';
                $planName   = $payment->plan->name ?? 'Plano';
                $amount     = number_format($payment->amount, 0, ',', '.');
                app(PlatformSmsService::class)->send(
                    $notifyPhone,
                    "RHadmin: Comprovativo recebido de {$tenantName} para o plano {$planName} ({$amount} AOA). Ref: {$payment->reference}."
                );
            } catch (\Throwable) {}
        }

        return response()->json(['message' => 'Comprovativo enviado com sucesso.']);
    }

    /** Devolve o pedido de pagamento pendente do tenant. */
    public function paymentStatus(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        $pending = PaymentRequest::with('plan')
            ->where('tenant_id', $tenant->id)
            ->orderByDesc('created_at')
            ->first();

        return response()->json($pending);
    }

    /** Histórico de pagamentos do tenant (apenas pagamentos aprovados com FR). */
    public function paymentHistory(Request $request): JsonResponse
    {
        $tenant = $request->attributes->get('tenant');

        $payments = PaymentRequest::with('plan')
            ->where('tenant_id', $tenant->id)
            ->whereIn('status', ['paid', 'rejected'])
            ->orderByDesc('created_at')
            ->get(['id', 'reference', 'amount', 'status', 'fr_number', 'fr_path', 'reviewed_at', 'created_at', 'plan_id']);

        return response()->json($payments);
    }

    /** Download da FR para o tenant. */
    public function downloadFr(Request $request, int $paymentId)
    {
        $tenant  = $request->attributes->get('tenant');
        $payment = PaymentRequest::where('id', $paymentId)
            ->where('tenant_id', $tenant->id)
            ->where('status', 'paid')
            ->firstOrFail();

        if (! $payment->fr_path) {
            try {
                app(\App\Services\Documents\FacturaReciboService::class)->generate($payment);
                $payment->refresh();
            } catch (\Throwable) {
                abort(404, 'Factura-Recibo não disponível.');
            }
        }

        abort_if(! \Illuminate\Support\Facades\Storage::disk('local')->exists($payment->fr_path), 404);

        $filename = 'FR-' . str_replace(['/', ' '], '-', $payment->fr_number ?? $payment->id) . '.pdf';

        return \Illuminate\Support\Facades\Storage::disk('local')->response($payment->fr_path, $filename, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => 'inline; filename="' . $filename . '"',
        ]);
    }
}
