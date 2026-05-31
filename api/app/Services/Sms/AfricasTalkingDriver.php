<?php

namespace App\Services\Sms;

use Illuminate\Support\Facades\Http;

/**
 * Driver para Africa's Talking SMS API.
 * Documentação: https://developers.africastalking.com/docs/sms/sending
 * Suporta Angola (+244) e Moçambique (+258).
 */
class AfricasTalkingDriver implements SmsDriverInterface
{
    public function __construct(
        private string $apiKey,
        private string $username,
        private string $senderId = 'RHadmin',
    ) {}

    public function send(string $to, string $message): array
    {
        $endpoint = $this->username === 'sandbox'
            ? 'https://api.sandbox.africastalking.com/version1/messaging'
            : 'https://api.africastalking.com/version1/messaging';

        $response = Http::withHeaders([
            'apiKey' => $this->apiKey,
            'Accept' => 'application/json',
        ])->asForm()->post($endpoint, [
            'username' => $this->username,
            'to'       => $to,
            'message'  => $message,
            'from'     => $this->senderId ?: null,
        ]);

        $body = $response->json();
        $recipients = $body['SMSMessageData']['Recipients'] ?? [];
        $success = ! empty($recipients) && ($recipients[0]['statusCode'] ?? 0) == 101;

        return [
            'success'  => $success,
            'response' => json_encode($body),
        ];
    }
}
