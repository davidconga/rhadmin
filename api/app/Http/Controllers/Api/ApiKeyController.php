<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ApiKey;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ApiKeyController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(
            ApiKey::orderByDesc('created_at')
                ->get(['id', 'name', 'prefix', 'permissions', 'active', 'last_used_at', 'expires_at', 'created_at'])
        );
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'        => ['required', 'string', 'max:255'],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['string'],
            'expires_at'  => ['nullable', 'date', 'after:now'],
        ]);

        [$model, $plain] = ApiKey::generate(
            $data['name'],
            $data['permissions'] ?? ['*'],
            isset($data['expires_at']) ? new \DateTime($data['expires_at']) : null,
        );

        return response()->json([
            'key'  => $plain,
            'meta' => $model->only(['id', 'name', 'prefix', 'permissions', 'expires_at', 'created_at']),
        ], 201);
    }

    public function update(Request $request, ApiKey $apiKey): JsonResponse
    {
        $data = $request->validate([
            'name'   => ['sometimes', 'required', 'string', 'max:255'],
            'active' => ['boolean'],
        ]);

        $apiKey->update($data);

        return response()->json($apiKey->only(['id', 'name', 'prefix', 'permissions', 'active', 'last_used_at', 'expires_at']));
    }

    public function destroy(ApiKey $apiKey): JsonResponse
    {
        $apiKey->delete();

        return response()->json(null, 204);
    }
}
