<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Autentica o utilizador no tenant atual (resolvido pelo TenantMiddleware)
     * e devolve um token Sanctum (Bearer).
     */
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = \App\Models\User::where('email', $credentials['email'])->first();

        if (! $user || ! Hash::check($credentials['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['As credenciais fornecidas estão incorretas.'],
            ]);
        }

        if (! $user->active) {
            throw ValidationException::withMessages([
                'email' => ['Esta conta está desativada.'],
            ]);
        }

        $user->forceFill(['last_login_at' => now()])->save();

        $token = $user->createToken('spa')->plainTextToken;

        $setupRequired = ! \App\Models\Company::whereNotNull('nif')->exists();

        return response()->json([
            'token'         => $token,
            'user'          => $user->only(['id', 'name', 'email', 'role']),
            'setup_required' => $setupRequired,
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $setupRequired = ! \App\Models\Company::whereNotNull('nif')->exists();

        return response()->json(array_merge(
            $request->user()->only(['id', 'name', 'email', 'role', 'last_login_at']),
            ['setup_required' => $setupRequired],
        ));
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Sessão terminada.']);
    }
}
