<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\EmployeeRequest;
use App\Models\Employee;
use App\Models\FamilyMember;
use App\Services\PlanLimitService;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

class EmployeeController extends Controller
{
    /** Lista valores únicos de função e departamento para autocomplete. */
    public function options(Request $request): JsonResponse
    {
        $q = Employee::query();
        if ($cid = $request->attributes->get('company_id')) $q->where('company_id', $cid);

        return response()->json([
            'positions'   => $q->clone()->whereNotNull('position')->distinct()->orderBy('position')->pluck('position'),
            'departments' => $q->clone()->whereNotNull('department')->distinct()->orderBy('department')->pluck('department'),
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $query = Employee::query();

        if ($companyId = $request->attributes->get('company_id')) {
            $query->where('company_id', $companyId);
        }

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('full_name', 'like', "%{$search}%")
                    ->orWhere('position', 'like', "%{$search}%")
                    ->orWhere('department', 'like', "%{$search}%");
            });
        }

        if ($request->filled('active')) {
            $query->where('active', filter_var($request->query('active'), FILTER_VALIDATE_BOOLEAN));
        }

        $query->orderBy($request->query('sort', 'full_name'), $request->query('direction', 'asc'));

        return response()->json(
            $query->paginate((int) $request->query('per_page', 15))
        );
    }

    public function store(EmployeeRequest $request): JsonResponse
    {
        if ($err = app(PlanLimitService::class)->checkEmployees($request->attributes->get('tenant'))) {
            return $err;
        }

        $data = $request->validated();
        if ($companyId = $request->attributes->get('company_id')) {
            $data['company_id'] = $companyId;
        }

        $familyMembers = $request->input('family_members', []);
        unset($data['family_members']);

        $employee = Employee::create($data);

        foreach ($familyMembers as $m) {
            if (empty($m['full_name']) || empty($m['relationship'])) continue;
            $employee->familyMembers()->create([
                'full_name'     => $m['full_name'],
                'relationship'  => $m['relationship'],
                'bi_nif'        => $m['bi_nif'] ?? null,
                'date_of_birth' => $m['date_of_birth'] ?? null,
            ]);
        }

        Audit::log('created', $employee);

        return response()->json($employee->load('familyMembers'), 201);
    }

    public function show(Employee $employee): JsonResponse
    {
        return response()->json($employee->load('familyMembers'));
    }

    // ── Agregado familiar ────────────────────────────────────────────────────

    public function familyIndex(Employee $employee): JsonResponse
    {
        return response()->json($employee->familyMembers()->orderBy('full_name')->get());
    }

    public function familyStore(Request $request, Employee $employee): JsonResponse
    {
        $data = $request->validate([
            'full_name'     => ['required', 'string', 'max:255'],
            'relationship'  => ['required', 'string', 'max:100'],
            'bi_nif'        => ['nullable', 'string', 'max:100'],
            'date_of_birth' => ['nullable', 'date'],
        ]);
        $member = $employee->familyMembers()->create($data);
        return response()->json($member, 201);
    }

    public function familyUpdate(Request $request, Employee $employee, FamilyMember $member): JsonResponse
    {
        abort_if($member->employee_id !== $employee->id, 404);
        $data = $request->validate([
            'full_name'     => ['sometimes', 'required', 'string', 'max:255'],
            'relationship'  => ['sometimes', 'required', 'string', 'max:100'],
            'bi_nif'        => ['nullable', 'string', 'max:100'],
            'date_of_birth' => ['nullable', 'date'],
        ]);
        $member->update($data);
        return response()->json($member);
    }

    public function familyDestroy(Employee $employee, FamilyMember $member): JsonResponse
    {
        abort_if($member->employee_id !== $employee->id, 404);
        $member->delete();
        return response()->json(null, 204);
    }

    public function update(EmployeeRequest $request, Employee $employee): JsonResponse
    {
        $old = $employee->getOriginal();
        $employee->update($request->validated());
        Audit::log('updated', $employee, $old);

        return response()->json($employee);
    }

    public function destroy(Employee $employee): JsonResponse
    {
        Audit::log('deleted', $employee);
        $employee->delete();

        return response()->json(null, 204);
    }

    public function destroyBulk(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ids'   => ['required', 'array', 'min:1'],
            'ids.*' => ['integer'],
        ]);

        $query = Employee::whereIn('id', $data['ids']);

        if ($companyId = $request->attributes->get('company_id')) {
            $query->where('company_id', $companyId);
        }

        $employees = $query->get();
        foreach ($employees as $emp) {
            Audit::log('deleted', $emp);
        }

        $deleted = $query->delete();

        return response()->json(['deleted' => $deleted]);
    }

    public function uploadPhoto(Request $request, Employee $employee): JsonResponse
    {
        $request->validate([
            'photo' => ['required', 'image', 'mimes:png,jpg,jpeg,webp', 'max:2048'],
        ]);

        $tenant = $request->attributes->get('tenant');
        $path = $request->file('photo')->store("tenant/{$tenant->slug}/employees/{$employee->id}", 'local');

        if ($employee->photo_path && Storage::disk('local')->exists($employee->photo_path)) {
            Storage::disk('local')->delete($employee->photo_path);
        }

        $employee->update(['photo_path' => $path]);

        return response()->json(['photo_path' => $path]);
    }

    public function photo(Employee $employee)
    {
        abort_if(! $employee->photo_path || ! Storage::disk('local')->exists($employee->photo_path), 404);

        return Storage::disk('local')->response($employee->photo_path);
    }

    /**
     * Importação simples via CSV. Cabeçalho esperado:
     * full_name,bi_nif,position,department,bank_name,account_number,iban,base_salary,food_allowance,transport_allowance
     */
    public function importCsv(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt'],
        ]);

        $handle = fopen($request->file('file')->getRealPath(), 'r');
        $header = fgetcsv($handle);
        $imported = 0;

        while (($row = fgetcsv($handle)) !== false) {
            if (count(array_filter($row)) === 0) {
                continue;
            }
            $data = array_combine($header, $row);
            Employee::create([
                'full_name' => $data['full_name'] ?? 'Sem nome',
                'bi_nif' => $data['bi_nif'] ?? null,
                'position' => $data['position'] ?? null,
                'department' => $data['department'] ?? null,
                'bank_name' => $data['bank_name'] ?? null,
                'account_number' => $data['account_number'] ?? null,
                'iban' => $data['iban'] ?? null,
                'base_salary' => (float) ($data['base_salary'] ?? 0),
                'food_allowance' => (float) ($data['food_allowance'] ?? 0),
                'transport_allowance' => (float) ($data['transport_allowance'] ?? 0),
            ]);
            $imported++;
        }
        fclose($handle);

        return response()->json(['imported' => $imported]);
    }

    public function uploadSignature(Request $request, Employee $employee): JsonResponse
    {
        $request->validate(['signature' => ['required', 'string']]);
        $base64 = preg_replace('#^data:image/\w+;base64,#i', '', $request->input('signature'));
        $path = "signatures/{$employee->id}.png";
        Storage::disk('local')->put($path, base64_decode($base64));
        $employee->update(['signature_path' => $path]);
        return response()->json(['message' => 'Assinatura guardada.']);
    }

    public function getSignature(Employee $employee)
    {
        abort_if(!$employee->signature_path || !Storage::disk('local')->exists($employee->signature_path), 404);
        return Storage::disk('local')->response($employee->signature_path);
    }

    public function createPortalAccount(Request $request, Employee $employee): JsonResponse
    {
        if ($employee->user_id) {
            return response()->json(['message' => 'Este funcionário já tem uma conta de portal.'], 422);
        }

        $data = $request->validate([
            'email'    => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:6'],
            'name'     => ['nullable', 'string', 'max:255'],
        ]);

        $user = \App\Models\User::create([
            'employee_id' => $employee->id,
            'name'        => $data['name'] ?? $employee->full_name,
            'email'       => $data['email'],
            'password'    => Hash::make($data['password']),
            'role'        => 'employee',
            'active'      => true,
        ]);

        $employee->update(['user_id' => $user->id]);

        Audit::log('created_portal_account', $employee);

        return response()->json([
            'message' => 'Conta de portal criada com sucesso.',
            'user'    => $user->only(['id', 'name', 'email', 'role', 'active']),
        ], 201);
    }

    public function linkUser(Request $request, Employee $employee): JsonResponse
    {
        $data = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
        ]);

        $user = \App\Models\User::findOrFail($data['user_id']);

        // desliga o funcionário anterior se existir
        if ($user->employee_id && $user->employee_id !== $employee->id) {
            Employee::where('id', $user->employee_id)->update(['user_id' => null]);
        }

        // desliga o utilizador anterior do funcionário actual se existir
        if ($employee->user_id && $employee->user_id !== $user->id) {
            \App\Models\User::where('id', $employee->user_id)->update(['employee_id' => null]);
        }

        $user->update(['employee_id' => $employee->id]);
        $employee->update(['user_id' => $user->id]);

        Audit::log('linked_user', $employee);

        return response()->json([
            'message' => 'Utilizador associado com sucesso.',
            'user'    => $user->only(['id', 'name', 'email', 'role', 'active']),
        ]);
    }

    public function resetPortalPassword(Request $request, Employee $employee): JsonResponse
    {
        if (! $employee->user_id) {
            return response()->json(['message' => 'Este funcionário não tem acesso ao portal.'], 422);
        }

        $data = $request->validate([
            'password' => ['required', 'string', 'min:6'],
        ]);

        $employee->user->update([
            'password' => Hash::make($data['password']),
        ]);

        Audit::log('reset_portal_password', $employee);

        return response()->json(['message' => 'Senha do portal redefinida com sucesso.']);
    }
}
