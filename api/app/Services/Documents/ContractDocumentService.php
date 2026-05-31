<?php

namespace App\Services\Documents;

use App\Models\Company;
use App\Models\Contract;
use App\Models\Setting;
use App\Services\IrtCalculatorService;
use App\Services\TenantService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Storage;

class ContractDocumentService
{
    public function __construct(
        protected TenantService $tenants,
        protected IrtCalculatorService $irtCalc,
    ) {}

    public function generatePdf(Contract $contract): string
    {
        $contract->loadMissing('employee');
        $company = Company::first();

        $typeLabels = [
            'indeterminado'       => 'Contrato por Prazo Indeterminado',
            'prazo_certo'         => 'Contrato a Prazo Certo',
            'prestacao_servicos'  => 'Contrato de Prestação de Serviços',
        ];

        $baseSalary   = (float) $contract->base_salary;
        $ssRate       = (float) Setting::get('inss_employee_rate', 3);
        $inssWorker   = round($baseSalary * $ssRate / 100, 2);
        $irtBase      = max($baseSalary - $inssWorker, 0);
        $irt          = $this->irtCalc->calculate($irtBase);
        $totalGross   = $baseSalary + (float)$contract->food_allowance + (float)$contract->transport_allowance;
        $netSalary    = round($totalGross - $inssWorker - $irt, 2);

        $pdf = Pdf::loadView('documents.contract', [
            'contract'           => $contract,
            'employee'           => $contract->employee,
            'company'            => $company,
            'currency'           => $company->currency ?? 'AOA',
            'typeLabel'          => $typeLabels[$contract->type] ?? 'Contrato de Trabalho',
            'startDate'          => $contract->start_date?->format('d/m/Y'),
            'endDate'            => $contract->end_date?->format('d/m/Y'),
            'totalSalary'        => $totalGross,
            'inssWorker'         => $inssWorker,
            'irt'                => $irt,
            'netSalary'          => $netSalary,
            'logoData'           => $this->logoDataUri($company),
            'companySignatureData'   => $this->signatureDataUri($company),
            'employeeSignatureData'  => $this->employeeSignatureDataUri($contract),
            'signedAt'               => $contract->signed_at
                                          ? \Carbon\Carbon::parse($contract->signed_at)->format('d/m/Y H:i')
                                          : null,
            'generatedAt'        => now()->format('d \d\e F \d\e Y'),
            'fmt'                => fn ($v) => number_format((float) $v, 2, ',', '.'),
        ]);

        $pdf->setPaper('A4', 'portrait');

        $slug     = $this->tenants->current()?->slug ?? 'default';
        $name     = \Illuminate\Support\Str::slug($contract->employee->full_name);
        $filename = "contrato-{$name}-{$contract->id}.pdf";
        $relative = "tenant/{$slug}/contracts/{$filename}";
        $absolute = Storage::disk('local')->path($relative);

        $dir = dirname($absolute);
        if (! is_dir($dir)) mkdir($dir, 0755, true);

        file_put_contents($absolute, $pdf->output());

        $contract->update(['document_path' => $relative]);

        return $relative;
    }

    protected function logoDataUri(Company $company): ?string
    {
        if (! $company->logo_path || ! Storage::disk('local')->exists($company->logo_path)) return null;
        $path = Storage::disk('local')->path($company->logo_path);
        $mime = mime_content_type($path) ?: 'image/png';
        return 'data:'.$mime.';base64,'.base64_encode(file_get_contents($path));
    }

    protected function employeeSignatureDataUri(Contract $contract): ?string
    {
        if (! $contract->employee_signature_path) return null;
        if (! Storage::disk('local')->exists($contract->employee_signature_path)) return null;
        $path = Storage::disk('local')->path($contract->employee_signature_path);
        return 'data:image/png;base64,'.base64_encode(file_get_contents($path));
    }

    protected function signatureDataUri(Company $company): ?string
    {
        if (! $company->signature_path || ! Storage::disk('local')->exists($company->signature_path)) return null;
        $path = Storage::disk('local')->path($company->signature_path);
        return 'data:image/png;base64,'.base64_encode(file_get_contents($path));
    }
}
