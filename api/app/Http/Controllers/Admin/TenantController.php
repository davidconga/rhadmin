<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Plan;
use App\Models\Tenant;
use App\Services\TenantService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TenantController extends Controller
{
    public function __construct(protected TenantService $tenants) {}

    public function index(Request $request): JsonResponse
    {
        $query = Tenant::with('plan')->latest();

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('slug', 'like', "%{$search}%");
            });
        }

        if ($request->filled('status')) {
            $query->where('subscription_status', $request->query('status'));
        }

        return response()->json($query->paginate(20));
    }

    public function show(Tenant $tenant): JsonResponse
    {
        $tenant->load('plan');

        // Ligar temporariamente ao tenant para obter contagens
        $stats = [];
        try {
            $this->tenants->makeCurrent($tenant);
            $stats = [
                'employees' => \App\Models\Employee::count(),
                'users'     => \App\Models\User::count(),
                'companies' => \App\Models\Company::count(),
            ];
        } catch (\Throwable) {
            $stats = ['employees' => '—', 'users' => '—', 'companies' => '—'];
        } finally {
            \Illuminate\Support\Facades\DB::setDefaultConnection('central');
        }

        return response()->json([
            'tenant' => $tenant,
            'stats'  => $stats,
        ]);
    }

    public function update(Request $request, Tenant $tenant): JsonResponse
    {
        $data = $request->validate([
            'name'                 => ['sometimes', 'string', 'max:255'],
            'active'               => ['boolean'],
            'subscription_status'  => ['sometimes', 'in:trial,active,suspended,cancelled'],
            'plan_slug'            => ['nullable', 'string', 'exists:central.plans,slug'],
            'trial_ends_at'        => ['nullable', 'date'],
        ]);

        if (isset($data['plan_slug'])) {
            $plan = Plan::where('slug', $data['plan_slug'])->firstOrFail();
            $data['plan_id'] = $plan->id;
            unset($data['plan_slug']);
        }

        $tenant->update($data);

        return response()->json($tenant->fresh('plan'));
    }

    public function destroy(Tenant $tenant): JsonResponse
    {
        // Remove o ficheiro SQLite
        if (file_exists($tenant->database_path)) {
            @unlink($tenant->database_path);
        }

        $tenant->delete();

        return response()->json(null, 204);
    }

    public function impersonate(Tenant $tenant): JsonResponse
    {
        // Devolve um token de admin válido para o tenant (para suporte técnico)
        $this->tenants->makeCurrent($tenant);
        $user = \App\Models\User::where('role', 'admin')->first();

        if (! $user) {
            return response()->json(['message' => 'Nenhum admin encontrado neste tenant.'], 404);
        }

        $token = $user->createToken('impersonate')->plainTextToken;

        return response()->json([
            'token'  => $token,
            'tenant' => $tenant->slug,
            'user'   => $user->only(['id', 'name', 'email', 'role']),
        ]);
    }
}
