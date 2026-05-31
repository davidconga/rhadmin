<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Admin;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email'    => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $admin = Admin::where('email', $data['email'])->where('active', true)->first();

        if (! $admin || ! Hash::check($data['password'], $admin->password)) {
            return response()->json(['message' => 'Credenciais inválidas.'], 401);
        }

        $admin->forceFill(['last_login_at' => now()])->save();
        $token = $admin->createToken();

        return response()->json([
            'token' => $token,
            'admin' => $admin->only(['id', 'name', 'email']),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json($request->attributes->get('admin'));
    }

    public function logout(Request $request): JsonResponse
    {
        $request->attributes->get('admin_token')?->delete();
        return response()->json(['message' => 'Sessão terminada.']);
    }
}
