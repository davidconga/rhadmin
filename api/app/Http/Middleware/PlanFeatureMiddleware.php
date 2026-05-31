<?php

namespace App\Http\Middleware;

use App\Services\PlanLimitService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class PlanFeatureMiddleware
{
    public function handle(Request $request, Closure $next, string $feature): Response
    {
        $tenant = $request->attributes->get('tenant');

        if ($err = app(PlanLimitService::class)->requireFeature($tenant, $feature)) {
            return $err;
        }

        return $next($request);
    }
}
