<?php

namespace App\Services\Sms;

use Illuminate\Support\Facades\Http;

/**
 * Driver genérico via HTTP webhook.
 * Envia POST/GET para um URL configurável com os parâmetros {to}, {message}, {sender}.
 * Ideal para gateways locais, Movicel, Movitel, mCel, etc.
 */
class HttpWebhookDriver implements SmsDriverInterface
{
    public function __construct(
        private string $webhookUrl,
        private string $method = 'POST',
        private string $apiKey = '',
        private string $senderId = 'RHadmin',
    ) {}

    public function send(string $to, string $message): array
    {
        $payload = [
            'to'      => $to,
            'message' => $message,
            'sender'  => $this->senderId,
            'api_key' => $this->apiKey,
        ];

        $request = Http::withHeaders(['Accept' => 'application/json']);
        if ($this->apiKey) {
            $request = $request->withToken($this->apiKey);
        }

        $response = strtoupper($this->method) === 'GET'
            ? $request->get($this->webhookUrl, $payload)
            : $request->post($this->webhookUrl, $payload);

        return [
            'success'  => $response->successful(),
            'response' => $response->body(),
        ];
    }
}
