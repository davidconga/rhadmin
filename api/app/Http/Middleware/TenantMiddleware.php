<?php

namespace App\Http\Middleware;

use App\Models\Tenant;
use App\Services\TenantService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Resolves the active tenant from the `X-Tenant` header (slug) or from the
 * request subdomain (e.g. empresa.rhadmin.ao), then switches the default
 * database connection to that tenant's isolated SQLite file. Must run BEFORE
 * auth:sanctum so token lookup happens against the correct tenant database.
 */
class TenantMiddleware
{
    public function __construct(protected TenantService $tenants) {}

    public function handle(Request $request, Closure $next): Response
    {
        $slug = $this->resolveSlug($request);

        if (! $slug) {
            return response()->json([
                'message' => 'Tenant não identificado. Forneça o cabeçalho X-Tenant.',
            ], 400);
        }

        $tenant = Tenant::where('slug', $slug)->where('active', true)->first();

        if (! $tenant) {
            return response()->json([
                'message' => "Tenant '{$slug}' não encontrado ou inativo.",
            ], 404);
        }

        $this->tenants->makeCurrent($tenant);

        $request->attributes->set('tenant', $tenant);

        return $next($request);
    }

    protected function resolveSlug(Request $request): ?string
    {
        if ($header = $request->header('X-Tenant')) {
            return trim($header);
        }

        $host = $request->getHost();
        $parts = explode('.', $host);

        // subdomínio.rhadmin.ao  -> 3+ segmentos
        if (count($parts) >= 3 && ! in_array($parts[0], ['www', 'api'], true)) {
            return $parts[0];
        }

        return null;
    }
}
