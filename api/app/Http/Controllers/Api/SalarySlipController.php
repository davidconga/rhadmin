<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\SalarySlip;
use App\Services\Documents\SalarySlipDocumentService;
use App\Services\PayrollService;
use App\Services\SmsService;
use App\Models\Setting;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SalarySlipController extends Controller
{
    public function __construct(
        protected PayrollService $payroll,
        protected SalarySlipDocumentService $docs,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = SalarySlip::query()->with('employee:id,full_name,position,department');

        if ($companyId = $request->attributes->get('company_id')) {
            $query->whereHas('employee', fn ($q) => $q->where('company_id', $companyId));
        }

        if ($request->filled('employee_id')) {
            $query->where('employee_id', (int) $request->query('employee_id'));
        }
        if ($request->filled('month')) {
            $query->where('month', (int) $request->query('month'));
        }
        if ($request->filled('year')) {
            $query->where('year', (int) $request->query('year'));
        }
        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }
        if ($search = $request->query('search')) {
            $query->whereHas('employee', fn ($q) => $q->where('full_name', 'like', "%{$search}%"));
        }

        $query->orderByDesc('year')->orderByDesc('month')->orderByDesc('id');

        return response()->json($query->paginate((int) $request->query('per_page', 15)));
    }

    /**
     * Gera (ou recalcula) recibos para TODOS os funcionários ativos de um mês/ano.
     */
    public function generateBatch(Request $request): JsonResponse
    {
        $data = $request->validate([
            'month' => ['required', 'integer', 'between:1,12'],
            'year' => ['required', 'integer', 'between:2000,2100'],
        ]);

        $empQuery = Employee::where('active', true);
        if ($companyId = $request->attributes->get('company_id')) {
            $empQuery->where('company_id', $companyId);
        }
        $employees = $empQuery->get();
        $created = [];

        foreach ($employees as $employee) {
            $created[] = $this->payroll->generateFor($employee, $data['month'], $data['year']);
        }

        Audit::log("batch_generated:{$data['month']}/{$data['year']}");

        return response()->json([
            'generated' => count($created),
            'month' => $data['month'],
            'year' => $data['year'],
        ], 201);
    }

    public function show(SalarySlip $salarySlip): JsonResponse
    {
        return response()->json($salarySlip->load('employee', 'documents'));
    }

    public function receiptSignature(SalarySlip $salarySlip): StreamedResponse
    {
        abort_if(
            ! $salarySlip->receipt_signature_path ||
            ! Storage::disk('local')->exists($salarySlip->receipt_signature_path),
            404
        );

        return Storage::disk('local')->response($salarySlip->receipt_signature_path);
    }

    public function update(Request $request, SalarySlip $salarySlip): JsonResponse
    {
        $data = $request->validate([
            'overtime' => ['nullable', 'numeric', 'min:0'],
            'other_income' => ['nullable', 'numeric', 'min:0'],
            'other_deductions' => ['nullable', 'numeric', 'min:0'],
            'base_salary' => ['nullable', 'numeric', 'min:0'],
            'food_allowance' => ['nullable', 'numeric', 'min:0'],
            'transport_allowance' => ['nullable', 'numeric', 'min:0'],
        ]);

        // Recalcula com os overrides introduzidos.
        $recomputed = $this->payroll->compute(
            $salarySlip->employee,
            $salarySlip->month,
            $salarySlip->year,
            $data,
        );

        $old = $salarySlip->getOriginal();
        $salarySlip->update($recomputed);
        Audit::log('updated', $salarySlip, $old);

        return response()->json($salarySlip->fresh('employee'));
    }

    public function issue(Request $request, SalarySlip $salarySlip): JsonResponse
    {
        $salarySlip->update(['status' => 'issued', 'issued_at' => now()]);

        try {
            $salarySlip->update(['issued_by_name' => $request->user()->name]);
        } catch (\Throwable) {
            // coluna ainda não migrada
        }
        Audit::log('issued', $salarySlip);

        // Notificação SMS ao funcionário
        if (Setting::get('sms_notify_slip') && $salarySlip->employee?->phone ?? false) {
            app(SmsService::class)->sendTemplate(
                $salarySlip->employee->phone,
                'slip',
                ['name' => $salarySlip->employee->full_name, 'month' => $salarySlip->month, 'year' => $salarySlip->year],
                'slip_issued'
            );
        }

        return response()->json($salarySlip);
    }

    public function generateDocx(SalarySlip $salarySlip): JsonResponse
    {
        $doc = $this->docs->generateDocx($salarySlip);

        return response()->json($doc);
    }

    public function generatePdf(SalarySlip $salarySlip): JsonResponse
    {
        $doc = $this->docs->generatePdf($salarySlip);

        return response()->json($doc);
    }

    /**
     * Descarrega num ZIP os PDFs de todos os recibos de um mês/ano.
     */
    public function downloadZip(Request $request): StreamedResponse
    {
        $data = $request->validate([
            'month' => ['required', 'integer', 'between:1,12'],
            'year' => ['required', 'integer', 'between:2000,2100'],
        ]);

        $slips = SalarySlip::with('employee')
            ->where('month', $data['month'])
            ->where('year', $data['year'])
            ->get();

        $zip = new \ZipArchive();
        $tmp = tempnam(sys_get_temp_dir(), 'recibos');
        $zip->open($tmp, \ZipArchive::OVERWRITE);

        foreach ($slips as $slip) {
            $doc = $this->docs->generatePdf($slip);
            $abs = Storage::disk('local')->path($doc->path);
            if (file_exists($abs)) {
                $zip->addFile($abs, $doc->filename);
            }
        }
        $zip->close();

        $name = "recibos-{$data['month']}-{$data['year']}.zip";

        return response()->streamDownload(function () use ($tmp) {
            readfile($tmp);
            @unlink($tmp);
        }, $name, ['Content-Type' => 'application/zip']);
    }
}
