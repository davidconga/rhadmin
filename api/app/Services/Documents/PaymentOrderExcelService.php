<?php

namespace App\Services\Documents;

use App\Models\Company;
use App\Models\PaymentOrder;
use App\Services\TenantService;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Gera o ficheiro Excel de transferências para envio ao banco.
 */
class PaymentOrderExcelService
{
    public function __construct(protected TenantService $tenants) {}

    public function download(PaymentOrder $order): StreamedResponse
    {
        $order->loadMissing('items', 'bank');
        $company = Company::first();

        $ss = new Spreadsheet();
        $sheet = $ss->getActiveSheet();
        $sheet->setTitle('Transferências');

        // Cabeçalho informativo
        $sheet->setCellValue('A1', $company?->name ?? 'Empresa');
        $sheet->setCellValue('A2', 'Ordem de Pagamento: '.$order->reference_number);
        $sheet->setCellValue('A3', 'Período: '.$order->month.'/'.$order->year);
        $sheet->setCellValue('A4', 'Conta de débito: '.($order->debit_account ?: '—'));
        $sheet->setCellValue('A5', 'Banco: '.($order->bank?->name ?? $company?->bank_name ?? '—'));
        $sheet->mergeCells('A1:E1');
        $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(14)->getColor()->setRGB('085041');

        // Tabela
        $headerRow = 7;
        $headers = ['#', 'Beneficiário', 'IBAN', 'Banco', 'Montante ('.($company?->currency ?? 'AOA').')'];
        $col = 'A';
        foreach ($headers as $h) {
            $sheet->setCellValue($col.$headerRow, $h);
            $col++;
        }
        $sheet->getStyle("A{$headerRow}:E{$headerRow}")->applyFromArray([
            'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '085041']],
        ]);

        $row = $headerRow + 1;
        foreach ($order->items as $i => $item) {
            $sheet->setCellValue("A{$row}", $i + 1);
            $sheet->setCellValue("B{$row}", $item->beneficiary);
            $sheet->setCellValueExplicit("C{$row}", (string) ($item->iban ?? ''), \PhpOffice\PhpSpreadsheet\Cell\DataType::TYPE_STRING);
            $sheet->setCellValue("D{$row}", $item->bank ?? '');
            $sheet->setCellValue("E{$row}", (float) $item->amount);
            $sheet->getStyle("E{$row}")->getNumberFormat()->setFormatCode('#,##0.00');
            $row++;
        }

        // Total
        $sheet->setCellValue("D{$row}", 'TOTAL');
        $sheet->setCellValue("E{$row}", (float) $order->total_amount);
        $sheet->getStyle("D{$row}:E{$row}")->getFont()->setBold(true);
        $sheet->getStyle("E{$row}")->getNumberFormat()->setFormatCode('#,##0.00');

        foreach (['A' => 6, 'B' => 32, 'C' => 30, 'D' => 22, 'E' => 18] as $c => $w) {
            $sheet->getColumnDimension($c)->setWidth($w);
        }
        $sheet->getStyle("E8:E{$row}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);

        $filename = "transferencias-{$order->reference_number}.xlsx";

        return new StreamedResponse(function () use ($ss) {
            (new Xlsx($ss))->save('php://output');
        }, 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ]);
    }
}
