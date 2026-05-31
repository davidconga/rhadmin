<?php

namespace App\Services\Sms;

use Illuminate\Support\Facades\Http;

/**
 * Driver para a API de SMS da Unitel Angola.
 * Endpoint genérico — ajuste conforme a documentação recebida da Unitel.
 */
class UnitelDriver implements SmsDriverInterface
{
    public function __construct(
        private string $apiKey,
        private string $senderId = 'RHadmin',
    ) {}

    public function send(string $to, string $message): array
    {
        // Normalizar número angolano: +244XXXXXXXXX
        $to = preg_replace('/[^+0-9]/', '', $to);
        if (! str_starts_with($to, '+')) {
            $to = '+244' . ltrim($to, '0');
        }

        $response = Http::withHeaders([
            'Authorization' => "Bearer {$this->apiKey}",
            'Content-Type'  => 'application/json',
        ])->post('https://api.unitel.co.ao/sms/v1/send', [
            'to'      => $to,
            'from'    => $this->senderId,
            'message' => $message,
        ]);

        return [
            'success'  => $response->successful(),
            'response' => $response->body(),
        ];
    }
}
