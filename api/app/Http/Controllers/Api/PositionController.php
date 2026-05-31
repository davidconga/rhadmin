<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Position;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PositionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Position::query();

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('code', 'like', "%{$search}%")
                  ->orWhere('department', 'like', "%{$search}%");
            });
        }

        if ($request->filled('active')) {
            $query->where('active', filter_var($request->query('active'), FILTER_VALIDATE_BOOLEAN));
        }

        if ($request->filled('department')) {
            $query->where('department', $request->query('department'));
        }

        $query->orderBy($request->query('sort', 'name'), $request->query('direction', 'asc'));

        return response()->json(
            $query->paginate((int) $request->query('per_page', 50))
        );
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'        => ['required', 'string', 'max:255', Rule::unique('positions', 'name')],
            'code'        => ['nullable', 'string', 'max:20', Rule::unique('positions', 'code')],
            'department'  => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'active'      => ['boolean'],
        ]);

        $position = Position::create($data);
        Audit::log('created', $position);

        return response()->json($position, 201);
    }

    public function show(Position $position): JsonResponse
    {
        return response()->json($position);
    }

    public function update(Request $request, Position $position): JsonResponse
    {
        $data = $request->validate([
            'name'        => ['sometimes', 'required', 'string', 'max:255', Rule::unique('positions', 'name')->ignore($position->id)],
            'code'        => ['nullable', 'string', 'max:20', Rule::unique('positions', 'code')->ignore($position->id)],
            'department'  => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'active'      => ['boolean'],
        ]);

        $old = $position->getOriginal();
        $position->update($data);
        Audit::log('updated', $position, $old);

        return response()->json($position);
    }

    public function destroy(Position $position): JsonResponse
    {
        Audit::log('deleted', $position);
        $position->delete();

        return response()->json(null, 204);
    }
}
