<?php

namespace App\Services;

use App\Models\Company;
use App\Models\Employee;
use App\Models\Plan;
use App\Models\User;
use Illuminate\Http\JsonResponse;

class PlanLimitService
{
    /** Devolve o plano actual do tenant ou null. */
    protected function plan($tenant): ?Plan
    {
        return $tenant?->plan ?? Plan::where('slug', 'basic')->first();
    }

    public function checkCompanies($tenant): ?JsonResponse
    {
        $plan = $this->plan($tenant);
        if (! $plan) return null;

        $current = Company::count();
        if ($current >= $plan->max_companies) {
            return response()->json([
                'message' => "O seu plano {$plan->name} permite até {$plan->max_companies} empresa(s). Actualize o plano para adicionar mais.",
                'limit_reached' => true,
                'limit' => $plan->max_companies,
                'current' => $current,
            ], 422);
        }
        return null;
    }

    public function checkEmployees($tenant): ?JsonResponse
    {
        $plan = $this->plan($tenant);
        if (! $plan) return null;

        $current = Employee::count();
        if ($current >= $plan->max_employees) {
            return response()->json([
                'message' => "O seu plano {$plan->name} permite até {$plan->max_employees} funcionário(s). Actualize o plano para adicionar mais.",
                'limit_reached' => true,
                'limit' => $plan->max_employees,
                'current' => $current,
            ], 422);
        }
        return null;
    }

    public function checkUsers($tenant): ?JsonResponse
    {
        $plan = $this->plan($tenant);
        if (! $plan) return null;

        $current = User::where('role', '!=', 'employee')->count();
        if ($current >= $plan->max_users) {
            return response()->json([
                'message' => "O seu plano {$plan->name} permite até {$plan->max_users} utilizador(es). Actualize o plano para adicionar mais.",
                'limit_reached' => true,
                'limit' => $plan->max_users,
                'current' => $current,
            ], 422);
        }
        return null;
    }

    /** Funcionalidades base garantidas mesmo sem plano configurado. */
    protected const BASE_FEATURES = ['employees', 'salary_slips', 'contracts', 'departments', 'positions'];

    protected function featureKeys($tenant): array
    {
        $keys = $tenant?->plan?->feature_keys;
        if (is_array($keys) && ! empty($keys)) return $keys;
        // fallback: lê da BD pelo slug
        $slug = $tenant?->plan?->slug ?? 'basic';
        $plan = \App\Models\Plan::where('slug', $slug)->first();
        return $plan?->feature_keys ?? self::BASE_FEATURES;
    }

    public function hasFeature($tenant, string $feature): bool
    {
        return in_array($feature, $this->featureKeys($tenant), true);
    }

    public function requireFeature($tenant, string $feature): ?\Illuminate\Http\JsonResponse
    {
        if (! $this->hasFeature($tenant, $feature)) {
            $plan = $tenant?->plan?->name ?? 'actual';
            return response()->json([
                'message'        => "Esta funcionalidade não está disponível no plano {$plan}. Faça upgrade para aceder.",
                'feature_locked' => true,
                'feature'        => $feature,
            ], 403);
        }
        return null;
    }

    public function planFeatures($tenant): array
    {
        return $this->featureKeys($tenant);
    }

    /** Devolve as contagens e limites actuais para o dashboard. */
    public function usage($tenant): array
    {
        $plan = $this->plan($tenant);
        return [
            'companies' => [
                'current' => Company::count(),
                'limit'   => $plan?->max_companies ?? '∞',
            ],
            'employees' => [
                'current' => Employee::count(),
                'limit'   => $plan?->max_employees ?? '∞',
            ],
            'users' => [
                'current' => User::where('role', '!=', 'employee')->count(),
                'limit'   => $plan?->max_users ?? '∞',
            ],
        ];
    }
}
