<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DepartmentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Department::query();

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%");
            });
        }

        if ($request->filled('active')) {
            $query->where('active', filter_var($request->query('active'), FILTER_VALIDATE_BOOLEAN));
        }

        $query->orderBy($request->query('sort', 'name'), $request->query('direction', 'asc'));

        return response()->json(
            $query->paginate((int) $request->query('per_page', 50))
        );
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'        => ['required', 'string', 'max:255', Rule::unique('departments', 'name')],
            'code'        => ['nullable', 'string', 'max:20', Rule::unique('departments', 'code')],
            'description' => ['nullable', 'string'],
            'active'      => ['boolean'],
        ]);

        $department = Department::create($data);
        Audit::log('created', $department);

        return response()->json($department, 201);
    }

    public function show(Department $department): JsonResponse
    {
        return response()->json($department);
    }

    public function update(Request $request, Department $department): JsonResponse
    {
        $data = $request->validate([
            'name'        => ['sometimes', 'required', 'string', 'max:255', Rule::unique('departments', 'name')->ignore($department->id)],
            'code'        => ['nullable', 'string', 'max:20', Rule::unique('departments', 'code')->ignore($department->id)],
            'description' => ['nullable', 'string'],
            'active'      => ['boolean'],
        ]);

        $old = $department->getOriginal();
        $department->update($data);
        Audit::log('updated', $department, $old);

        return response()->json($department);
    }

    public function destroy(Department $department): JsonResponse
    {
        Audit::log('deleted', $department);
        $department->delete();

        return response()->json(null, 204);
    }
}
