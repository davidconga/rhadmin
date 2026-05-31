<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contract;
use App\Models\Employee;
use App\Services\Documents\ContractDocumentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ContractController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Contract::with('employee:id,full_name,photo_path')
            ->orderByDesc('start_date');

        if ($eid = $request->query('employee_id'))
            $query->where('employee_id', $eid);
        if ($status = $request->query('status'))
            $query->where('status', $status);

        return response()->json($query->paginate((int) $request->query('per_page', 20)));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'employee_id'        => ['required','exists:employees,id'],
            'type'               => ['required','in:indeterminado,prazo_certo,prestacao_servicos'],
            'title'              => ['nullable','string','max:255'],
            'position'           => ['nullable','string','max:255'],
            'department'         => ['nullable','string','max:255'],
            'base_salary'        => ['required','numeric','min:0'],
            'food_allowance'     => ['nullable','numeric','min:0'],
            'transport_allowance'=> ['nullable','numeric','min:0'],
            'start_date'         => ['required','date'],
            'end_date'           => ['nullable','date','after_or_equal:start_date'],
            'status'             => ['nullable','in:active,suspended,terminated,expired'],
            'notes'              => ['nullable','string'],
        ]);

        $contract = Contract::create($data + ['status' => $data['status'] ?? 'active']);
        return response()->json($contract->load('employee:id,full_name'), 201);
    }

    public function show(Contract $contract): JsonResponse
    {
        return response()->json($contract->load('employee:id,full_name,photo_path'));
    }

    public function update(Request $request, Contract $contract): JsonResponse
    {
        $data = $request->validate([
            'type'               => ['sometimes','in:indeterminado,prazo_certo,prestacao_servicos'],
            'title'              => ['nullable','string','max:255'],
            'position'           => ['nullable','string','max:255'],
            'department'         => ['nullable','string','max:255'],
            'base_salary'        => ['sometimes','numeric','min:0'],
            'food_allowance'     => ['nullable','numeric','min:0'],
            'transport_allowance'=> ['nullable','numeric','min:0'],
            'start_date'         => ['sometimes','date'],
            'end_date'           => ['nullable','date'],
            'status'             => ['sometimes','in:active,suspended,terminated,expired'],
            'notes'              => ['nullable','string'],
        ]);
        $contract->update($data);
        return response()->json($contract);
    }

    public function destroy(Contract $contract): JsonResponse
    {
        $contract->delete();
        return response()->json(null, 204);
    }

    public function generatePdf(Contract $contract): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $path = app(ContractDocumentService::class)->generatePdf($contract);
        $filename = basename($path);

        return Storage::disk('local')->response($path, $filename, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$filename.'"',
        ]);
    }
}
