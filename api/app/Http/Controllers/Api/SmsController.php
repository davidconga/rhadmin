<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Models\SmsLog;
use App\Services\SmsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SmsController extends Controller
{
    public function __construct(protected SmsService $sms) {}

    /** Configurações actuais. */
    public function settings(): JsonResponse
    {
        $keys = ['sms_enabled','sms_driver','sms_api_key','sms_username','sms_sender_id',
                 'sms_webhook_url','sms_webhook_method','sms_notify_slip','sms_notify_welcome','sms_notify_trial'];

        $settings = [];
        foreach ($keys as $k) {
            $settings[$k] = Setting::get($k);
        }

        return response()->json($settings);
    }

    /** Guardar configurações. */
    public function saveSettings(Request $request): JsonResponse
    {
        $data = $request->validate([
            'sms_enabled'         => ['boolean'],
            'sms_driver'          => ['in:africas_talking,unitel,http_webhook'],
            'sms_api_key'         => ['nullable', 'string', 'max:255'],
            'sms_username'        => ['nullable', 'string', 'max:100'],
            'sms_sender_id'       => ['nullable', 'string', 'max:11'],
            'sms_webhook_url'     => ['nullable', 'url'],
            'sms_webhook_method'  => ['in:POST,GET'],
            'sms_notify_slip'     => ['boolean'],
            'sms_notify_welcome'  => ['boolean'],
            'sms_notify_trial'    => ['boolean'],
        ]);

        foreach ($data as $key => $value) {
            Setting::set($key, $value);
        }

        return response()->json(['message' => 'Configurações SMS guardadas.']);
    }

    /** Envia um SMS de teste para o número fornecido. */
    public function test(Request $request): JsonResponse
    {
        $data = $request->validate([
            'to'      => ['required', 'string', 'max:20'],
            'message' => ['nullable', 'string', 'max:160'],
        ]);

        $message = $data['message'] ?? 'Teste de SMS do RHadmin — se recebeu esta mensagem, a integração está funcional!';

        $success = $this->sms->send($data['to'], $message, 'test');

        return response()->json([
            'success' => $success,
            'message' => $success ? 'SMS enviado com sucesso.' : 'Falha no envio — verifique as configurações e os logs.',
        ], $success ? 200 : 422);
    }

    /** Histórico de SMS enviados. */
    public function logs(Request $request): JsonResponse
    {
        $query = SmsLog::query()->orderByDesc('created_at');

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        return response()->json($query->paginate(50));
    }

    /** Templates disponíveis. */
    public function templates(): JsonResponse
    {
        return response()->json(SmsService::TEMPLATES);
    }

    /** Verifica saldo na TelcoSMS (apenas para o driver telcosms). */
    public function balance(): JsonResponse
    {
        $driver = $this->sms->driver();

        if (! $driver instanceof \App\Services\Sms\TelcosmsDriver) {
            return response()->json(['message' => 'Check de saldo apenas disponível com o driver TelcoSMS.'], 422);
        }

        return response()->json($driver->checkBalance());
    }
}
