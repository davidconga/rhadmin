<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\PaymentOrder;
use App\Models\SalarySlip;
use App\Services\Documents\PaymentOrderDocumentService;
use App\Services\Documents\PaymentOrderExcelService;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PaymentOrderController extends Controller
{
    public function __construct(
        protected PaymentOrderDocumentService $docs,
        protected PaymentOrderExcelService $excel,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = PaymentOrder::query()->with('bank:id,name')->withCount('items');

        foreach (['month', 'year', 'status'] as $f) {
            if ($request->filled($f)) {
                $query->where($f, $request->query($f));
            }
        }
        if ($search = $request->query('search')) {
            $query->where('reference_number', 'like', "%{$search}%");
        }

        $query->orderByDesc('year')->orderByDesc('month')->orderByDesc('id');

        return response()->json($query->paginate((int) $request->query('per_page', 15)));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'month' => ['required', 'integer', 'between:1,12'],
            'year' => ['required', 'integer', 'between:2000,2100'],
            'bank_id' => ['nullable', 'exists:banks,id'],
            'debit_account' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string'],
            'items' => ['array'],
            'items.*.employee_id' => ['nullable', 'exists:employees,id'],
            'items.*.beneficiary' => ['required_with:items', 'string', 'max:255'],
            'items.*.iban' => ['nullable', 'string', 'max:64'],
            'items.*.bank' => ['nullable', 'string', 'max:255'],
            'items.*.amount' => ['required_with:items', 'numeric', 'min:0'],
        ]);

        $order = DB::transaction(function () use ($data) {
            $order = PaymentOrder::create([
                'reference_number' => $this->nextReference($data['year']),
                'month' => $data['month'],
                'year' => $data['year'],
                'bank_id' => $data['bank_id'] ?? null,
                'debit_account' => $data['debit_account'] ?? null,
                'notes' => $data['notes'] ?? null,
                'status' => 'draft',
            ]);
            $this->syncItems($order, $data['items'] ?? []);
            $order->recalculateTotal();

            return $order;
        });

        Audit::log('created', $order);

        return response()->json($order->load('items', 'bank'), 201);
    }

    public function show(PaymentOrder $paymentOrder): JsonResponse
    {
        return response()->json(
            $paymentOrder->load('items.employee:id,full_name', 'bank', 'approver:id,name', 'documents')
        );
    }

    public function update(Request $request, PaymentOrder $paymentOrder): JsonResponse
    {
        abort_if($paymentOrder->status === 'sent', 422, 'Ordem já enviada ao banco; não pode ser editada.');

        $data = $request->validate([
            'bank_id' => ['nullable', 'exists:banks,id'],
            'debit_account' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string'],
            'items' => ['array'],
            'items.*.employee_id' => ['nullable', 'exists:employees,id'],
            'items.*.beneficiary' => ['required_with:items', 'string', 'max:255'],
            'items.*.iban' => ['nullable', 'string', 'max:64'],
            'items.*.bank' => ['nullable', 'string', 'max:255'],
            'items.*.amount' => ['required_with:items', 'numeric', 'min:0'],
        ]);

        DB::transaction(function () use ($paymentOrder, $data, $request) {
            $paymentOrder->update([
                'bank_id' => $data['bank_id'] ?? $paymentOrder->bank_id,
                'debit_account' => $data['debit_account'] ?? $paymentOrder->debit_account,
                'notes' => $data['notes'] ?? $paymentOrder->notes,
            ]);
            if ($request->has('items')) {
                $paymentOrder->items()->delete();
                $this->syncItems($paymentOrder, $data['items'] ?? []);
            }
            $paymentOrder->recalculateTotal();
        });

        return response()->json($paymentOrder->fresh()->load('items', 'bank'));
    }

    public function destroy(PaymentOrder $paymentOrder): JsonResponse
    {
        Audit::log('deleted', $paymentOrder);
        $paymentOrder->delete();

        return response()->json(null, 204);
    }

    /**
     * Importa os funcionários ativos como beneficiários. Usa o salário líquido
     * do recibo do mês/ano se existir; caso contrário, o salário base.
     */
    public function addEmployees(PaymentOrder $paymentOrder): JsonResponse
    {
        abort_if($paymentOrder->status === 'sent', 422, 'Ordem já enviada ao banco.');

        $employees = Employee::where('active', true)->get();
        $existing = $paymentOrder->items()->pluck('employee_id')->filter()->all();

        foreach ($employees as $emp) {
            if (in_array($emp->id, $existing, true)) {
                continue;
            }
            $slip = SalarySlip::where('employee_id', $emp->id)
                ->where('month', $paymentOrder->month)
                ->where('year', $paymentOrder->year)
                ->first();

            $paymentOrder->items()->create([
                'employee_id' => $emp->id,
                'beneficiary' => $emp->full_name,
                'iban' => $emp->iban,
                'bank' => $emp->bank_name,
                'amount' => $slip ? $slip->net_salary : $emp->base_salary,
            ]);
        }
        $paymentOrder->recalculateTotal();

        return response()->json($paymentOrder->fresh()->load('items'));
    }

    public function approve(Request $request, PaymentOrder $paymentOrder): JsonResponse
    {
        abort_unless($paymentOrder->status === 'draft', 422, 'Apenas rascunhos podem ser aprovados.');
        abort_if($paymentOrder->items()->count() === 0, 422, 'A ordem não tem beneficiários.');

        $paymentOrder->update([
            'status' => 'approved',
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
        ]);
        Audit::log('approved', $paymentOrder);

        return response()->json($paymentOrder->fresh()->load('approver:id,name'));
    }

    public function send(PaymentOrder $paymentOrder): JsonResponse
    {
        abort_unless($paymentOrder->status === 'approved', 422, 'Apenas ordens aprovadas podem ser enviadas.');

        $paymentOrder->update(['status' => 'sent', 'sent_at' => now()]);
        Audit::log('sent', $paymentOrder);

        return response()->json($paymentOrder->fresh());
    }

    public function generateDocx(PaymentOrder $paymentOrder): JsonResponse
    {
        return response()->json($this->docs->generateDocx($paymentOrder));
    }

    public function generatePdf(PaymentOrder $paymentOrder): JsonResponse
    {
        return response()->json($this->docs->generatePdf($paymentOrder));
    }

    public function generateExcel(PaymentOrder $paymentOrder): StreamedResponse
    {
        return $this->excel->download($paymentOrder);
    }

    // ---- helpers ----

    private function nextReference(int $year): string
    {
        $count = PaymentOrder::where('year', $year)->count() + 1;

        return sprintf('OP-%d-%04d', $year, $count);
    }

    private function syncItems(PaymentOrder $order, array $items): void
    {
        foreach ($items as $item) {
            $order->items()->create([
                'employee_id' => $item['employee_id'] ?? null,
                'beneficiary' => $item['beneficiary'],
                'iban' => $item['iban'] ?? null,
                'bank' => $item['bank'] ?? null,
                'amount' => $item['amount'],
            ]);
        }
    }
}
