<?php

namespace App\Http\Middleware;

use App\Models\Admin;
use App\Models\AdminToken;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Symfony\Component\HttpFoundation\Response;

class AdminMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $bearer = $request->bearerToken();

        if (! $bearer || ! str_starts_with($bearer, 'sadm_')) {
            return response()->json(['message' => 'Autenticação de super admin necessária.'], 401);
        }

        $tokenRecord = AdminToken::with('admin')
            ->whereHas('admin', fn ($q) => $q->where('active', true))
            ->get()
            ->first(fn ($t) => Hash::check($bearer, $t->token_hash));

        if (! $tokenRecord) {
            return response()->json(['message' => 'Token inválido ou expirado.'], 401);
        }

        $request->attributes->set('admin', $tokenRecord->admin);
        $request->attributes->set('admin_token', $tokenRecord);

        return $next($request);
    }
}
