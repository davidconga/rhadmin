<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Plan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlanController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(Plan::withCount('tenants')->orderBy('sort_order')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'slug'          => ['required', 'string', 'max:50', 'unique:central.plans,slug'],
            'name'          => ['required', 'string', 'max:255'],
            'description'   => ['nullable', 'string'],
            'price_aoa'     => ['required', 'integer', 'min:0'],
            'max_companies' => ['required', 'integer', 'min:1'],
            'max_employees' => ['required', 'integer', 'min:1'],
            'max_users'     => ['required', 'integer', 'min:1'],
            'features'       => ['nullable', 'array'],
            'features.*'     => ['string'],
            'feature_keys'   => ['nullable', 'array'],
            'feature_keys.*' => ['string'],
            'active'         => ['boolean'],
            'sort_order'     => ['integer', 'min:0'],
        ]);

        return response()->json(Plan::create($data + ['active' => true, 'sort_order' => 99]), 201);
    }

    public function update(Request $request, Plan $plan): JsonResponse
    {
        $data = $request->validate([
            'name'           => ['sometimes', 'string', 'max:255'],
            'description'    => ['nullable', 'string'],
            'price_aoa'      => ['sometimes', 'integer', 'min:0'],
            'max_companies'  => ['sometimes', 'integer', 'min:1'],
            'max_employees'  => ['sometimes', 'integer', 'min:1'],
            'max_users'      => ['sometimes', 'integer', 'min:1'],
            'features'       => ['nullable', 'array'],
            'features.*'     => ['string'],
            'feature_keys'   => ['nullable', 'array'],
            'feature_keys.*' => ['string'],
            'active'         => ['boolean'],
            'sort_order'     => ['integer', 'min:0'],
        ]);

        $plan->update($data);

        return response()->json($plan->fresh());
    }

    public function destroy(Plan $plan): JsonResponse
    {
        if ($plan->tenants()->exists()) {
            return response()->json(['message' => 'Não é possível eliminar um plano com tenants associados.'], 422);
        }

        $plan->delete();

        return response()->json(null, 204);
    }
}
