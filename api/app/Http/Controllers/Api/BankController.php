<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Bank;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BankController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Bank::query();

        if ($search = $request->query('search')) {
            $query->where('name', 'like', "%{$search}%")->orWhere('bic', 'like', "%{$search}%");
        }
        if ($request->boolean('only_active')) {
            $query->where('active', true);
        }

        return response()->json($query->orderBy('name')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validateData($request);
        $bank = Bank::create($data);
        Audit::log('created', $bank);

        return response()->json($bank, 201);
    }

    public function update(Request $request, Bank $bank): JsonResponse
    {
        $data = $this->validateData($request);
        $old = $bank->getOriginal();
        $bank->update($data);
        Audit::log('updated', $bank, $old);

        return response()->json($bank);
    }

    public function destroy(Bank $bank): JsonResponse
    {
        Audit::log('deleted', $bank);
        $bank->delete();

        return response()->json(null, 204);
    }

    private function validateData(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:50'],
            'bic' => ['nullable', 'string', 'max:50'],
            'active' => ['boolean'],
        ]);
    }
}
