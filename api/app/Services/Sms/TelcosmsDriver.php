<?php

namespace App\Services\Sms;

use Illuminate\Support\Facades\Http;

/**
 * Driver para TelcoSMS Angola (telcosms.co.ao).
 * Documentação: https://documenter.getpostman.com/view/9777660/2sAXjDeayT
 *
 * Endpoint v2:  POST https://www.telcosms.co.ao/api/v2/send_message
 * Body JSON:    { "message": { "api_key_app": "...", "phone_number": "9XX...", "message_body": "..." } }
 *
 * Check balance: GET https://telcosms.co.ao/check_balance?api_key=...
 */
class TelcosmsDriver implements SmsDriverInterface
{
    private const BASE = 'https://www.telcosms.co.ao';

    public function __construct(private string $apiKey) {}

    public function send(string $to, string $message): array
    {
        // TelcoSMS usa apenas os dígitos angolanos sem +244
        $phone = preg_replace('/[^0-9]/', '', $to);
        if (str_starts_with($phone, '244')) {
            $phone = substr($phone, 3);
        }

        $response = Http::post(self::BASE . '/api/v2/send_message', [
            'message' => [
                'api_key_app'  => $this->apiKey,
                'phone_number' => $phone,
                'message_body' => $message,
            ],
        ]);

        $body = $response->json();

        // A API devolve { "status": "success"|"error", "message": "..." }
        $success = $response->successful()
            && strtolower($body['status'] ?? '') === 'success';

        return [
            'success'  => $success,
            'response' => json_encode($body),
        ];
    }

    /** Verifica o saldo de SMS disponível. */
    public function checkBalance(): array
    {
        $response = Http::get(self::BASE . '/check_balance', [
            'api_key' => $this->apiKey,
        ]);

        return $response->json() ?? [];
    }
}
