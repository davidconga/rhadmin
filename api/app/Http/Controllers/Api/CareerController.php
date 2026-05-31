<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CareerEvent;
use App\Models\Employee;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CareerController extends Controller
{
    public function index(Employee $employee): JsonResponse
    {
        return response()->json(
            $employee->careerEvents()->orderByDesc('effective_date')->get()
        );
    }

    public function store(Request $request, Employee $employee): JsonResponse
    {
        $data = $request->validate([
            'type'             => ['required', Rule::in(['promotion', 'transfer', 'role_change', 'training', 'award', 'warning', 'other'])],
            'title'            => ['nullable', 'string', 'max:255'],
            'from_position'    => ['nullable', 'string', 'max:255'],
            'to_position'      => ['nullable', 'string', 'max:255'],
            'from_department'  => ['nullable', 'string', 'max:255'],
            'to_department'    => ['nullable', 'string', 'max:255'],
            'from_salary'      => ['nullable', 'numeric', 'min:0'],
            'to_salary'        => ['nullable', 'numeric', 'min:0'],
            'effective_date'   => ['required', 'date'],
            'description'      => ['nullable', 'string'],
        ]);

        $event = $employee->careerEvents()->create($data);

        // Se for promoção/mudança de cargo, actualiza o funcionário
        if (in_array($data['type'], ['promotion', 'role_change']) && ! empty($data['to_position'])) {
            $employee->update(['position' => $data['to_position']]);
        }
        if (in_array($data['type'], ['transfer']) && ! empty($data['to_department'])) {
            $employee->update(['department' => $data['to_department']]);
        }

        return response()->json($event, 201);
    }

    public function update(Request $request, Employee $employee, CareerEvent $event): JsonResponse
    {
        abort_if($event->employee_id !== $employee->id, 404);

        $data = $request->validate([
            'type'             => ['sometimes', Rule::in(['promotion', 'transfer', 'role_change', 'training', 'award', 'warning', 'other'])],
            'title'            => ['nullable', 'string', 'max:255'],
            'from_position'    => ['nullable', 'string', 'max:255'],
            'to_position'      => ['nullable', 'string', 'max:255'],
            'from_department'  => ['nullable', 'string', 'max:255'],
            'to_department'    => ['nullable', 'string', 'max:255'],
            'from_salary'      => ['nullable', 'numeric', 'min:0'],
            'to_salary'        => ['nullable', 'numeric', 'min:0'],
            'effective_date'   => ['sometimes', 'date'],
            'description'      => ['nullable', 'string'],
        ]);

        $event->update($data);
        return response()->json($event);
    }

    public function destroy(Employee $employee, CareerEvent $event): JsonResponse
    {
        abort_if($event->employee_id !== $employee->id, 404);
        $event->delete();
        return response()->json(null, 204);
    }
}
