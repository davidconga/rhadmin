<?php

namespace App\Services\Documents;

use App\Models\Company;
use App\Models\Document;
use App\Models\PaymentOrder;
use App\Services\TenantService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Storage;
use PhpOffice\PhpWord\PhpWord;

class PaymentOrderDocumentService
{
    protected string $primary = '085041';

    protected array $statusLabels = [
        'draft' => 'Rascunho',
        'approved' => 'Aprovado',
        'sent' => 'Enviado ao banco',
    ];

    public function __construct(protected TenantService $tenants) {}

    public function generatePdf(PaymentOrder $order): Document
    {
        $order->loadMissing('items', 'bank');
        $company = $this->company();

        $pdf = Pdf::loadView('documents.payment_order', [
            'order' => $order,
            'company' => $company,
            'currency' => $company->currency,
            'bankName' => $order->bank?->name ?? ($company->bank_name ?: 'Banco'),
            'monthName' => SalarySlipDocumentService::monthNames()[$order->month] ?? $order->month,
            'statusLabel' => $this->statusLabels[$order->status] ?? $order->status,
            'logoData' => $this->logoDataUri($company),
            'generatedAt' => now()->format('d/m/Y H:i'),
            'fmt' => fn ($v) => number_format((float) $v, 2, ',', '.'),
        ])->setPaper('a4', 'portrait');

        return $this->save($order, 'pdf', $pdf->output());
    }

    public function generateDocx(PaymentOrder $order): Document
    {
        $order->loadMissing('items', 'bank');
        $company = $this->company();
        $months = SalarySlipDocumentService::monthNames();

        $word = new PhpWord();
        $word->setDefaultFontName('Calibri');
        $word->setDefaultFontSize(10);
        $section = $word->addSection(['marginTop' => 700, 'marginBottom' => 700]);

        $header = $section->addTable(['width' => 100 * 50, 'unit' => 'pct']);
        $header->addRow();
        $logoCell = $header->addCell(2500);
        if ($logo = $this->logoAbsolutePath($company)) {
            $logoCell->addImage($logo, ['width' => 70, 'height' => 70]);
        }
        $titleCell = $header->addCell(7000);
        $titleCell->addText($company->name, ['bold' => true, 'size' => 16, 'color' => $this->primary]);
        $titleCell->addText('ORDEM DE PAGAMENTO / TRANSFERÊNCIA', ['bold' => true, 'size' => 12, 'color' => $this->primary]);
        $titleCell->addText('Ref.: '.$order->reference_number.'  ·  '.($this->statusLabels[$order->status] ?? $order->status), ['size' => 9, 'color' => '6B7280']);

        $section->addTextBreak(1);

        $bankName = $order->bank?->name ?? ($company->bank_name ?: 'Banco');
        $section->addText("Ao {$bankName},");
        $section->addText(
            'Solicitamos a transferência dos montantes abaixo, referentes a '
            .($months[$order->month] ?? $order->month).' / '.$order->year
            .', por débito da conta '.($order->debit_account ?: '—').'.'
        );
        $section->addTextBreak(1);

        $t = $section->addTable(['borderSize' => 6, 'borderColor' => 'E5E7EB', 'cellMargin' => 60, 'width' => 100 * 50, 'unit' => 'pct']);
        $t->addRow();
        foreach (['#', 'Beneficiário', 'IBAN', 'Banco', 'Montante ('.$company->currency.')'] as $h) {
            $t->addCell(2000, ['bgColor' => $this->primary])->addText($h, ['bold' => true, 'color' => 'FFFFFF']);
        }
        foreach ($order->items as $i => $item) {
            $t->addRow();
            $t->addCell(600)->addText((string) ($i + 1));
            $t->addCell(3500)->addText($item->beneficiary);
            $t->addCell(3500)->addText($item->iban ?: '—');
            $t->addCell(2500)->addText($item->bank ?: '—');
            $t->addCell(2500)->addText(number_format((float) $item->amount, 2, ',', '.'), [], ['alignment' => 'right']);
        }
        $t->addRow();
        $t->addCell(10100, ['gridSpan' => 4])->addText('TOTAL ('.count($order->items).' beneficiários)', ['bold' => true, 'color' => $this->primary]);
        $t->addCell(2500)->addText(number_format((float) $order->total_amount, 2, ',', '.'), ['bold' => true, 'color' => $this->primary], ['alignment' => 'right']);

        if ($order->notes) {
            $section->addTextBreak(1);
            $section->addText('Observações: '.$order->notes, ['size' => 9]);
        }

        $section->addTextBreak(3);
        $sign = $section->addTable(['width' => 100 * 50, 'unit' => 'pct']);
        $sign->addRow();
        foreach (['Elaborado por', 'Aprovado por', 'Autorizado por'] as $label) {
            $sign->addCell(3000)->addText('____________________'."\n".$label, [], ['alignment' => 'center']);
        }

        $writer = \PhpOffice\PhpWord\IOFactory::createWriter($word, 'Word2007');
        ob_start();
        $writer->save('php://output');
        $content = ob_get_clean();

        return $this->save($order, 'docx', $content);
    }

    // ---- helpers ----

    protected function company(): Company
    {
        return Company::firstOrCreate([], ['name' => $this->tenants->current()?->name ?? 'Empresa']);
    }

    protected function save(PaymentOrder $order, string $type, string $content): Document
    {
        $slug = $this->tenants->current()?->slug ?? 'default';
        $filename = "ordem-pagamento-{$order->reference_number}.{$type}";
        $relative = "tenant/{$slug}/documents/{$filename}";
        $absolute = Storage::disk('local')->path($relative);
        if (! is_dir(dirname($absolute))) {
            mkdir(dirname($absolute), 0755, true);
        }
        file_put_contents($absolute, $content);

        return Document::updateOrCreate(
            ['documentable_type' => PaymentOrder::class, 'documentable_id' => $order->id, 'type' => $type],
            ['filename' => $filename, 'path' => $relative, 'generated_at' => now()],
        );
    }

    protected function logoAbsolutePath(Company $company): ?string
    {
        if ($company->logo_path && Storage::disk('local')->exists($company->logo_path)) {
            return Storage::disk('local')->path($company->logo_path);
        }
        return null;
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
}
