<?php

namespace App\Services;

use App\Models\Setting;
use App\Models\SmsLog;
use App\Services\Sms\AfricasTalkingDriver;
use App\Services\Sms\HttpWebhookDriver;
use App\Services\Sms\SmsDriverInterface;
use App\Services\Sms\TelcosmsDriver;
use App\Services\Sms\UnitelDriver;

class SmsService
{
    /** Templates de mensagem. {placeholders} serão substituídos. */
    public const TEMPLATES = [
        'welcome'         => "Bem-vindo(a) ao RHadmin, {name}! A sua conta foi criada com sucesso. Aceda em: rhadmin.ao",
        'slip'            => "Olá {name}, o seu recibo de salário de {month}/{year} está disponível no RHadmin.",
        'trial'           => "O seu trial do RHadmin expira em {days} dia(s). Actualize o plano para continuar.",
        'otp'             => "O seu código de verificação RHadmin é: {code}. Válido por 10 minutos.",
        'admission_approved' =>
            "Olá {name}, o seu registo foi aprovado! Aceda ao portal com este link (válido 48h): {link}",
        'admission_approved_no_account' =>
            "Olá {name}, o seu registo de funcionário foi aprovado pela empresa. Bem-vindo(a)!",
    ];

    private ?SmsDriverInterface $driver = null;

    public function driver(): ?SmsDriverInterface
    {
        if ($this->driver) return $this->driver;

        if (! Setting::get('sms_enabled')) return null;

        $driverName = Setting::get('sms_driver', 'africas_talking');
        $apiKey     = Setting::get('sms_api_key', '');
        $senderId   = Setting::get('sms_sender_id', 'RHadmin');

        return $this->driver = match ($driverName) {
            'africas_talking' => new AfricasTalkingDriver(
                $apiKey,
                Setting::get('sms_username', 'sandbox'),
                $senderId,
            ),
            'telcosms'    => new TelcosmsDriver($apiKey),
            'unitel'      => new UnitelDriver($apiKey, $senderId),
            'http_webhook' => new HttpWebhookDriver(
                Setting::get('sms_webhook_url', ''),
                Setting::get('sms_webhook_method', 'POST'),
                $apiKey,
                $senderId,
            ),
            default => null,
        };
    }

    /**
     * Envia SMS e regista no log. Devolve true em caso de sucesso.
     */
    public function send(string $to, string $message, string $event = 'manual'): bool
    {
        $driver = $this->driver();

        $log = SmsLog::create([
            'to'      => $to,
            'message' => $message,
            'event'   => $event,
            'driver'  => Setting::get('sms_driver', 'africas_talking'),
            'status'  => 'pending',
        ]);

        if (! $driver) {
            $log->update(['status' => 'failed', 'provider_response' => 'SMS desactivado ou driver não configurado.']);
            return false;
        }

        try {
            $result = $driver->send($to, $message);
            $log->update([
                'status'            => $result['success'] ? 'sent' : 'failed',
                'provider_response' => $result['response'],
            ]);
            return $result['success'];
        } catch (\Throwable $e) {
            $log->update(['status' => 'failed', 'provider_response' => $e->getMessage()]);
            return false;
        }
    }

    /** Compõe e envia a partir de um template. */
    public function sendTemplate(string $to, string $template, array $vars = [], string $event = ''): bool
    {
        $message = self::TEMPLATES[$template] ?? $template;
        foreach ($vars as $key => $value) {
            $message = str_replace("{{$key}}", $value, $message);
        }
        return $this->send($to, $message, $event ?: $template);
    }
}
