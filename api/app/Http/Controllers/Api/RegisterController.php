<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Plan;
use App\Models\Tenant;
use App\Models\User;
use App\Services\PlatformSmsService;
use App\Services\TenantService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class RegisterController extends Controller
{
    public function __construct(protected TenantService $tenants) {}

    public function __invoke(Request $request): JsonResponse
    {
        $data = $request->validate([
            'company_name' => ['required', 'string', 'max:255'],
            'name'         => ['required', 'string', 'max:255'],
            'email'        => ['required', 'email', 'max:255'],
            'password'     => ['required', 'string', 'min:8', 'confirmed'],
            'plan_slug'    => ['nullable', 'string', Rule::exists('central.plans', 'slug')],
        ]);

        $slug = Str::slug($data['company_name']);

        // Garantir slug único
        $base = $slug;
        $i = 1;
        while (Tenant::where('slug', $slug)->exists()) {
            $slug = "{$base}-{$i}";
            $i++;
        }

        // Criar tenant + BD + migrações
        $tenant = $this->tenants->create($data['company_name'], $slug);

        // Associar plano (trial)
        $plan = Plan::where('slug', $data['plan_slug'] ?? 'profissional')->first()
               ?? Plan::orderBy('sort_order')->first();

        if ($plan) {
            $trialDays = (int) (DB::connection('central')
                ->table('platform_settings')
                ->where('key', 'trial_days')
                ->value('value') ?? 7);

            $tenant->update([
                'plan_id'             => $plan->id,
                'subscription_status' => 'trial',
                'trial_ends_at'       => now()->addDays($trialDays),
            ]);
        }

        // Mudar para o tenant recém-criado e criar utilizador admin
        $this->tenants->makeCurrent($tenant);

        $user = User::create([
            'name'     => $data['name'],
            'email'    => $data['email'],
            'password' => Hash::make($data['password']),
            'role'     => 'admin',
            'active'   => true,
        ]);

        // Correr seeder de dados demo (bancos, departamentos)
        (new \Database\Seeders\DemoDataSeeder())->run();

        // Notifica o administrador da plataforma via SMS
        try {
            $phone = env('PAYMENT_NOTIFY_PHONE');
            if ($phone) {
                app(PlatformSmsService::class)->send(
                    $phone,
                    "RHadmin: Nova conta registada!\nEmpresa: {$tenant->name} ({$slug})\nAdmin: {$data['name']}\nEmail: {$data['email']}\nPlano: " . ($plan?->name ?? 'N/D')
                );
            }
        } catch (\Throwable) {}

        $token = $user->createToken('spa')->plainTextToken;

        return response()->json([
            'token'  => $token,
            'user'   => $user->only(['id', 'name', 'email', 'role']),
            'tenant' => ['slug' => $tenant->slug, 'name' => $tenant->name],
        ], 201);
    }
}
