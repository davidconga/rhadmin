<?php

namespace App\Services;

use App\Services\Sms\TelcosmsDriver;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * SMS de plataforma — usa a chave TelcoSMS da BD central,
 * independente das configurações de cada tenant.
 */
class PlatformSmsService
{
    public function send(string $to, string $message): bool
    {
        try {
            $apiKey = DB::connection('central')
                ->table('platform_settings')
                ->where('key', 'telcosms_api_key')
                ->value('value');

            if (! $apiKey) {
                Log::warning('PlatformSms: telcosms_api_key não configurado.');
                return false;
            }

            $result = (new TelcosmsDriver($apiKey))->send($to, $message);

            if (! $result['success']) {
                Log::warning('PlatformSms falhou', ['to' => $to, 'response' => $result['response']]);
            }

            return $result['success'];
        } catch (\Throwable $e) {
            Log::error('PlatformSms exception: ' . $e->getMessage());
            return false;
        }
    }
}
