<?php

namespace App\Http\Middleware;

use App\Models\ApiKey;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ApiKeyMiddleware
{
    public function handle(Request $request, Closure $next, string $permission = '*'): Response
    {
        $plain = $request->header('X-Api-Key');

        if (! $plain) {
            return response()->json(['message' => 'API key em falta. Envie o cabeçalho X-Api-Key.'], 401);
        }

        $prefix = substr($plain, 0, 12);
        $key    = ApiKey::where('prefix', $prefix)->where('active', true)->first();

        if (! $key || ! $key->verify($plain) || $key->isExpired()) {
            return response()->json(['message' => 'API key inválida ou expirada.'], 401);
        }

        if ($permission !== '*' && ! $key->hasPermission($permission)) {
            return response()->json(['message' => "Esta key não tem permissão '{$permission}'."], 403);
        }

        $key->forceFill(['last_used_at' => now()])->save();

        $request->attributes->set('api_key', $key);

        return $next($request);
    }
}
