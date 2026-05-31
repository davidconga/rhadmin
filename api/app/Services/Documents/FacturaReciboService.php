<?php

namespace App\Services\Documents;

use App\Models\PaymentRequest;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class FacturaReciboService
{
    public function generate(PaymentRequest $payment): string
    {
        $payment->load(['tenant', 'plan']);

        // Número sequencial
        $seq = DB::connection('central')
            ->table('platform_settings')
            ->where('key', 'fr_sequence')
            ->value('value');

        $seq = ((int) $seq) + 1;

        DB::connection('central')
            ->table('platform_settings')
            ->where('key', 'fr_sequence')
            ->update(['value' => $seq, 'updated_at' => now()]);

        $year     = now()->format('Y');
        $frNumber = "FR {$year}/{$seq}";

        // Emitente — lê da platform_settings (com fallback para .env)
        $ps = DB::connection('central')->table('platform_settings')
            ->whereIn('key', ['platform_name','payment_beneficiary','payment_nif','payment_address','payment_email'])
            ->pluck('value', 'key');

        $issuer = [
            'name'    => $ps['payment_beneficiary'] ?? env('PAYMENT_BENEFICIARY', 'RHadmin Lda'),
            'nif'     => $ps['payment_nif']         ?? env('PAYMENT_NIF', ''),
            'address' => $ps['payment_address']     ?? env('PAYMENT_ADDRESS', 'Angola'),
            'email'   => $ps['payment_email']       ?? env('PAYMENT_EMAIL', ''),
        ];

        // Cliente (tenant) — tenta buscar dados da empresa do tenant
        $clientNif     = $payment->tenant->nif ?? '';
        $clientAddress = $payment->tenant->address ?? '';
        $clientEmail   = $payment->tenant->email ?? '';

        if (! $clientNif) {
            try {
                $tenantDb = config('database.connections.tenant');
                config(['database.connections.tenant_fr' => array_merge($tenantDb, [
                    'database' => $payment->tenant->database_path,
                ])]);
                $company = DB::connection('tenant_fr')->table('companies')->first();
                if ($company) {
                    $clientNif     = $company->nif ?? '';
                    $clientAddress = $company->address ?? '';
                    $clientEmail   = $company->email ?? '';
                }
            } catch (\Throwable) {}
        }

        $client = [
            'name'    => $payment->tenant->name,
            'nif'     => $clientNif,
            'address' => $clientAddress,
            'email'   => $clientEmail,
        ];

        $pdf = Pdf::loadView('documents.factura_recibo', [
            'frNumber' => $frNumber,
            'reference' => $payment->reference,
            'planName'  => $payment->plan->name,
            'period'    => now()->format('F Y'),
            'amount'    => $payment->amount,
            'issuer'    => $issuer,
            'client'    => $client,
            'issuedAt'  => now()->format('d/m/Y'),
            'paidAt'    => now()->format('d/m/Y H:i'),
            'fmt'       => fn ($v) => number_format((float) $v, 2, ',', '.'),
        ]);

        $pdf->setPaper('A4', 'portrait');

        $filename = "fr-{$payment->id}-" . str_replace('/', '-', $frNumber) . ".pdf";
        $relative = "invoices/{$filename}";
        $absolute = Storage::disk('local')->path($relative);

        $dir = dirname($absolute);
        if (! is_dir($dir)) mkdir($dir, 0755, true);

        file_put_contents($absolute, $pdf->output());

        $payment->update([
            'fr_number' => $frNumber,
            'fr_path'   => $relative,
        ]);

        return $relative;
    }
}
