<?php

namespace App\Services\Sms;

interface SmsDriverInterface
{
    /**
     * Envia SMS. Devolve ['success' => bool, 'response' => string].
     */
    public function send(string $to, string $message): array;
}
