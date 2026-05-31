<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Plan;
use App\Models\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;

class StatsController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $tenants = Tenant::with('plan')->get();

        $totalTenants    = $tenants->count();
        $activeTenants   = $tenants->where('active', true)->count();
        $trialTenants    = $tenants->where('subscription_status', 'trial')->count();
        $paidTenants     = $tenants->where('subscription_status', 'active')->count();

        // Receita mensal recorrente estimada (MRR)
        $mrr = $tenants
            ->where('subscription_status', 'active')
            ->sum(fn ($t) => $t->plan?->price_aoa ?? 0);

        // Tenants por plano
        $byPlan = $tenants->groupBy(fn ($t) => $t->plan?->name ?? 'Sem plano')
            ->map(fn ($g) => $g->count());

        // Registo por mês (últimos 6 meses)
        $registrations = Tenant::selectRaw("strftime('%Y-%m', created_at) as month, count(*) as total")
            ->where('created_at', '>=', now()->subMonths(6))
            ->groupBy('month')
            ->orderBy('month')
            ->get();

        return response()->json([
            'totals' => [
                'tenants'      => $totalTenants,
                'active'       => $activeTenants,
                'trial'        => $trialTenants,
                'paid'         => $paidTenants,
                'mrr_aoa'      => $mrr,
            ],
            'by_plan'       => $byPlan,
            'registrations' => $registrations,
        ]);
    }
}
