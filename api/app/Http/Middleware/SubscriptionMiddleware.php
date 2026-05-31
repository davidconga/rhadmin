<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SubscriptionMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $tenant = $request->attributes->get('tenant');

        if (! $tenant) return $next($request);

        $status = $tenant->subscription_status;

        if ($status === 'suspended' || $status === 'cancelled') {
            return response()->json([
                'subscription_error' => true,
                'status'             => $status,
                'message'            => 'A subscrição está ' . ($status === 'suspended' ? 'suspensa' : 'cancelada') . '. Contacte o suporte ou actualize o plano.',
            ], 402);
        }

        if ($status === 'trial' && $tenant->trial_ends_at && now()->gt($tenant->trial_ends_at)) {
            return response()->json([
                'subscription_error' => true,
                'status'             => 'trial_expired',
                'message'            => 'O período de trial terminou. Seleccione um plano para continuar.',
            ], 402);
        }

        return $next($request);
    }
}
