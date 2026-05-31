<?php

namespace App\Services\Documents;

use App\Models\Company;
use App\Models\Document;
use App\Models\SalarySlip;
use App\Services\TenantService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Storage;
use PhpOffice\PhpWord\PhpWord;
use PhpOffice\PhpWord\Shared\Converter;

/**
 * Gera os documentos do recibo de salário (DOCX via PhpWord, PDF via DomPDF),
 * guarda em storage/app/tenant/{slug}/documents/ e regista na tabela documents.
 */
class SalarySlipDocumentService
{
    protected string $primary = '085041';

    public function __construct(protected TenantService $tenants) {}

    public function generateDocx(SalarySlip $slip): Document
    {
        $slip->loadMissing('employee');
        $company = $this->company();
        $months = self::monthNames();

        $word = new PhpWord();
        $word->setDefaultFontName('Calibri');
        $word->setDefaultFontSize(10);

        $section = $word->addSection(['marginTop' => 700, 'marginBottom' => 700]);

        // Cabeçalho: logótipo + nome da empresa
        $header = $section->addTable(['borderSize' => 0, 'cellMargin' => 40, 'width' => 100 * 50, 'unit' => 'pct']);
        $header->addRow();
        $logoCell = $header->addCell(2500);
        if ($logo = $this->logoAbsolutePath($company)) {
            $logoCell->addImage($logo, ['width' => 80, 'height' => 80]);
        }
        $titleCell = $header->addCell(7000);
        $titleCell->addText($company->name, ['bold' => true, 'size' => 16, 'color' => $this->primary]);
        $sub = trim(($company->nif ? 'NIF: '.$company->nif : '').($company->address ? ' · '.$company->address : ''));
        if ($sub) {
            $titleCell->addText($sub, ['size' => 8, 'color' => '6B7280']);
        }
        $titleCell->addText('RECIBO DE SALÁRIO', ['bold' => true, 'size' => 13, 'color' => $this->primary]);

        $section->addTextBreak(1);

        // Metadados do funcionário
        $e = $slip->employee;
        $meta = $section->addTable(['cellMargin' => 40]);
        $this->metaRow($meta, 'Funcionário', $e->full_name, 'Função', $e->position ?: '—');
        $this->metaRow($meta, 'BI/NIF', $e->bi_nif ?: '—', 'Departamento', $e->department ?: '—');
        $this->metaRow($meta, 'Período', ($months[$slip->month] ?? $slip->month).' / '.$slip->year, 'IBAN', $e->iban ?: '—');

        $section->addTextBreak(1);

        // Tabela de valores
        $t = $section->addTable([
            'borderSize' => 6, 'borderColor' => 'E5E7EB',
            'cellMargin' => 60, 'width' => 100 * 50, 'unit' => 'pct',
        ]);
        $this->headerRow($t, 'Descrição', 'Valor ('.$company->currency.')');
        $this->sectionRow($t, 'Rendimentos');
        $this->lineRow($t, 'Salário base', $slip->base_salary);
        $this->lineRow($t, 'Subsídio de alimentação', $slip->food_allowance);
        $this->lineRow($t, 'Subsídio de transporte', $slip->transport_allowance);
        $this->lineRow($t, 'Horas extra'.($slip->overtime_hours > 0 ? ' ('.(float) $slip->overtime_hours.'h)' : ''), $slip->overtime);
        $this->lineRow($t, 'Outros rendimentos', $slip->other_income);
        $this->lineRow($t, 'Salário bruto', $slip->gross_salary, true);
        $this->sectionRow($t, 'Descontos');
        $this->lineRow($t, 'IRT', $slip->irt_tax);
        $this->lineRow($t, 'Segurança Social (INSS)', $slip->social_security);
        $this->lineRow($t, 'Outros descontos'.($slip->absence_days > 0 ? ' (faltas: '.$slip->absence_days.' dia'.($slip->absence_days > 1 ? 's' : '').')' : ''), $slip->other_deductions);
        $this->lineRow($t, 'Total de descontos', $slip->total_deductions, true);
        $this->lineRow($t, 'SALÁRIO LÍQUIDO', $slip->net_salary, true, true);

        $section->addTextBreak(3);
        $sign = $section->addTable(['width' => 100 * 50, 'unit' => 'pct']);
        $sign->addRow();

        $empCell = $sign->addCell(4500);
        $companySigPath = $company->signature_path && Storage::disk('local')->exists($company->signature_path)
            ? Storage::disk('local')->path($company->signature_path)
            : null;
        if ($companySigPath) {
            $empCell->addImage($companySigPath, ['width' => 80, 'height' => 30, 'alignment' => \PhpOffice\PhpWord\SimpleType\Jc::CENTER]);
        }
        $empCell->addText('______________________________', [], ['alignment' => 'center']);
        $empCell->addText('A Entidade Empregadora', ['size' => 9], ['alignment' => 'center']);
        if ($slip->issued_by_name) {
            $empCell->addText($slip->issued_by_name, ['size' => 8, 'color' => '6B7280'], ['alignment' => 'center']);
        }
        if ($slip->issued_at) {
            $empCell->addText(\Carbon\Carbon::parse($slip->issued_at)->format('d/m/Y'), ['size' => 8, 'color' => '6B7280'], ['alignment' => 'center']);
        }

        $funcCell = $sign->addCell(4500);
        $sigPath = $slip->receipt_signature_path && Storage::disk('local')->exists($slip->receipt_signature_path)
            ? Storage::disk('local')->path($slip->receipt_signature_path)
            : null;
        if ($sigPath) {
            $funcCell->addImage($sigPath, ['width' => 80, 'height' => 30, 'alignment' => \PhpOffice\PhpWord\SimpleType\Jc::CENTER]);
        }
        $funcCell->addText('______________________________', [], ['alignment' => 'center']);
        $funcCell->addText('O Funcionário', ['size' => 9], ['alignment' => 'center']);
        if ($slip->receipt_confirmed_at) {
            $confirmed = \Carbon\Carbon::parse($slip->receipt_confirmed_at)->format('d/m/Y H:i');
            $funcCell->addText("Confirmado em {$confirmed}", ['size' => 8, 'color' => '6B7280'], ['alignment' => 'center']);
        }

        $section->addTextBreak(1);
        $section->addText('Documento gerado por RHadmin em '.now()->format('d/m/Y H:i').'.', ['size' => 8, 'color' => '6B7280']);

        $filename = $this->filename($slip, 'docx');
        $relative = $this->relativePath($filename);
        $absolute = Storage::disk('local')->path($relative);
        $this->ensureDir(dirname($absolute));

        $writer = \PhpOffice\PhpWord\IOFactory::createWriter($word, 'Word2007');
        $writer->save($absolute);

        return $this->record($slip, 'docx', $filename, $relative);
    }

    public function generatePdf(SalarySlip $slip): Document
    {
        $slip->loadMissing('employee');
        $company = $this->company();
        $months = self::monthNames();

        $pdf = Pdf::loadView('documents.salary_slip', [
            'slip'                  => $slip,
            'employee'              => $slip->employee,
            'company'               => $company,
            'currency'              => $company->currency,
            'monthName'             => $months[$slip->month] ?? $slip->month,
            'logoData'              => $this->logoDataUri($company),
            'generatedAt'           => now()->format('d/m/Y H:i'),
            'fmt'                   => fn ($v) => number_format((float) $v, 2, ',', '.'),
            'issuedByName'          => $slip->issued_by_name,
            'issuedAt'              => $slip->issued_at
                                        ? \Carbon\Carbon::parse($slip->issued_at)->format('d/m/Y')
                                        : null,
            'companySignatureData'  => $this->companySignatureDataUri($company),
            'receiptSignatureData'  => $this->signatureDataUri($slip),
            'receiptConfirmedAt'    => $slip->receipt_confirmed_at
                                        ? \Carbon\Carbon::parse($slip->receipt_confirmed_at)->format('d/m/Y H:i')
                                        : null,
        ]);

        $filename = $this->filename($slip, 'pdf');
        $relative = $this->relativePath($filename);
        $absolute = Storage::disk('local')->path($relative);
        $this->ensureDir(dirname($absolute));
        file_put_contents($absolute, $pdf->output());

        return $this->record($slip, 'pdf', $filename, $relative);
    }

    // ---- helpers ----

    protected function company(): Company
    {
        return Company::firstOrCreate([], ['name' => $this->tenants->current()?->name ?? 'Empresa']);
    }

    protected function filename(SalarySlip $slip, string $ext): string
    {
        $name = \Illuminate\Support\Str::slug($slip->employee->full_name);
        return "recibo-{$name}-{$slip->month}-{$slip->year}.{$ext}";
    }

    protected function relativePath(string $filename): string
    {
        $slug = $this->tenants->current()?->slug ?? 'default';
        return "tenant/{$slug}/documents/{$filename}";
    }

    protected function ensureDir(string $dir): void
    {
        if (! is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
    }

    protected function record(SalarySlip $slip, string $type, string $filename, string $relative): Document
    {
        return Document::updateOrCreate(
            [
                'documentable_type' => SalarySlip::class,
                'documentable_id' => $slip->id,
                'type' => $type,
            ],
            [
                'filename' => $filename,
                'path' => $relative,
                'generated_at' => now(),
            ]
        );
    }

    protected function logoAbsolutePath(Company $company): ?string
    {
        if ($company->logo_path && Storage::disk('local')->exists($company->logo_path)) {
            return Storage::disk('local')->path($company->logo_path);
        }
        return null;
    }

    protected function companySignatureDataUri(Company $company): ?string
    {
        if (! $company->signature_path) return null;
        if (! Storage::disk('local')->exists($company->signature_path)) return null;
        $path = Storage::disk('local')->path($company->signature_path);
        return 'data:image/png;base64,'.base64_encode(file_get_contents($path));
    }

    protected function signatureDataUri(SalarySlip $slip): ?string
    {
        if (! $slip->receipt_signature_path) return null;
        if (! Storage::disk('local')->exists($slip->receipt_signature_path)) return null;
        $path = Storage::disk('local')->path($slip->receipt_signature_path);
        return 'data:image/png;base64,'.base64_encode(file_get_contents($path));
    }

    protected function logoDataUri(Company $company): ?string
    {
        $path = $this->logoAbsolutePath($company);
        if (! $path) {
            return null;
        }
        $mime = mime_content_type($path) ?: 'image/png';
        return 'data:'.$mime.';base64,'.base64_encode(file_get_contents($path));
    }

    protected function metaRow($table, string $l1, string $v1, string $l2, string $v2): void
    {
        $table->addRow();
        $c1 = $table->addCell(4800);
        $c1->addText("{$l1}: {$v1}", [], ['spaceAfter' => 0]);
        $c2 = $table->addCell(4800);
        $c2->addText("{$l2}: {$v2}", [], ['spaceAfter' => 0]);
    }

    protected function headerRow($table, string $a, string $b): void
    {
        $table->addRow();
        $table->addCell(7000, ['bgColor' => $this->primary])->addText($a, ['bold' => true, 'color' => 'FFFFFF']);
        $table->addCell(3000, ['bgColor' => $this->primary])->addText($b, ['bold' => true, 'color' => 'FFFFFF'], ['alignment' => 'right']);
    }

    protected function sectionRow($table, string $label): void
    {
        $table->addRow();
        $cell = $table->addCell(10000, ['gridSpan' => 2, 'bgColor' => 'EEF2F6']);
        $cell->addText($label, ['bold' => true, 'color' => $this->primary]);
    }

    protected function lineRow($table, string $label, $value, bool $bold = false, bool $net = false): void
    {
        $table->addRow();
        $style = ['bold' => $bold];
        if ($net) {
            $style = ['bold' => true, 'size' => 12, 'color' => $this->primary];
        }
        $table->addCell(7000)->addText($label, $style);
        $table->addCell(3000)->addText(number_format((float) $value, 2, ',', '.'), $style, ['alignment' => 'right']);
    }

    public static function monthNames(): array
    {
        return [
            1 => 'Janeiro', 2 => 'Fevereiro', 3 => 'Março', 4 => 'Abril',
            5 => 'Maio', 6 => 'Junho', 7 => 'Julho', 8 => 'Agosto',
            9 => 'Setembro', 10 => 'Outubro', 11 => 'Novembro', 12 => 'Dezembro',
        ];
    }
}
