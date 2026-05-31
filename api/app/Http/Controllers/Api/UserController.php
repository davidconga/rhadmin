<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Models\User;
use App\Services\PlanLimitService;
use App\Services\SmsService;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = User::query()->whereIn('role', ['admin', 'manager', 'viewer']);

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        if ($request->filled('role')) {
            $query->where('role', $request->query('role'));
        }

        $query->orderBy('name');

        return response()->json($query->get(['id', 'name', 'email', 'role', 'active', 'last_login_at', 'created_at']));
    }

    public function store(Request $request): JsonResponse
    {
        if ($err = app(PlanLimitService::class)->checkUsers($request->attributes->get('tenant'))) {
            return $err;
        }

        $data = $request->validate([
            'name'     => ['required', 'string', 'max:255'],
            'email'    => ['required', 'email', 'max:255', Rule::unique('users', 'email')],
            'password' => ['required', 'string', 'min:8'],
            'role'     => ['required', Rule::in(['admin', 'manager', 'viewer'])],
            'active'   => ['boolean'],
        ]);

        $user = User::create([
            'name'     => $data['name'],
            'email'    => $data['email'],
            'password' => Hash::make($data['password']),
            'role'     => $data['role'],
            'active'   => $data['active'] ?? true,
        ]);

        Audit::log('created', $user);

        // SMS de boas-vindas se o email tiver formato de número (campo reutilizado) ou futuramente phone
        if (Setting::get('sms_notify_welcome') && isset($data['phone'])) {
            app(SmsService::class)->sendTemplate($data['phone'], 'welcome', ['name' => $user->name], 'welcome');
        }

        return response()->json($user->only(['id', 'name', 'email', 'role', 'active', 'created_at']), 201);
    }

    public function show(User $user): JsonResponse
    {
        return response()->json($user->only(['id', 'name', 'email', 'role', 'active', 'last_login_at', 'created_at']));
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $authUser = $request->user();

        $data = $request->validate([
            'name'   => ['sometimes', 'required', 'string', 'max:255'],
            'email'  => ['sometimes', 'required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'role'   => ['sometimes', Rule::in(['admin', 'manager', 'viewer'])],
            'active' => ['boolean'],
        ]);

        // admin não pode retirar o próprio papel
        if (isset($data['role']) && $authUser->id === $user->id) {
            unset($data['role']);
        }

        $old = $user->getOriginal();
        $user->update($data);
        Audit::log('updated', $user, $old);

        return response()->json($user->only(['id', 'name', 'email', 'role', 'active', 'last_login_at']));
    }

    public function resetPassword(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'password' => ['required', 'string', 'min:8'],
        ]);

        $user->update(['password' => Hash::make($data['password'])]);
        Audit::log('reset_password', $user);

        return response()->json(['message' => 'Password redefinida com sucesso.']);
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        if ($request->user()->id === $user->id) {
            return response()->json(['message' => 'Não pode eliminar a sua própria conta.'], 422);
        }

        Audit::log('deleted', $user);
        $user->delete();

        return response()->json(null, 204);
    }
}
