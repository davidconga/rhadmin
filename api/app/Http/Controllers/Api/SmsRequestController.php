<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Sms\TelcosmsDriver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SmsRequestController extends Controller
{
    private function tenantId(Request $request): int
    {
        return $request->attributes->get('tenant')->id;
    }

    /** Estado actual do pedido do tenant. */
    public function status(Request $request): JsonResponse
    {
        $row = DB::connection('central')
            ->table('sms_requests')
            ->where('tenant_id', $this->tenantId($request))
            ->first();

        return response()->json($row ? (array) $row : null);
    }

    /** Submete ou actualiza pedido. */
    public function submit(Request $request): JsonResponse
    {
        $data = $request->validate([
            'justification'  => ['required', 'string', 'min:10', 'max:500'],
            'contact_name'   => ['required', 'string', 'max:255'],
            'contact_phone'  => ['required', 'string', 'max:20'],
        ]);

        $tenantId = $this->tenantId($request);

        $existing = DB::connection('central')
            ->table('sms_requests')
            ->where('tenant_id', $tenantId)
            ->first();

        if ($existing && $existing->status === 'approved') {
            return response()->json(['message' => 'O acesso SMS já está aprovado.'], 422);
        }

        DB::connection('central')->table('sms_requests')->upsert(
            [[
                'tenant_id'      => $tenantId,
                'status'         => 'pending',
                'justification'  => $data['justification'],
                'contact_name'   => $data['contact_name'],
                'contact_phone'  => $data['contact_phone'],
                'admin_notes'    => null,
                'reviewed_at'    => null,
                'created_at'     => now(),
                'updated_at'     => now(),
            ]],
            ['tenant_id'],
            ['status', 'justification', 'contact_name', 'contact_phone', 'admin_notes', 'reviewed_at', 'updated_at']
        );

        return response()->json(['message' => 'Pedido submetido. O super admin irá analisar em breve.'], 201);
    }

    /**
     * Envia SMS usando a chave da plataforma (apenas tenants aprovados).
     */
    public function send(Request $request): JsonResponse
    {
        $tenantId = $this->tenantId($request);

        $approved = DB::connection('central')
            ->table('sms_requests')
            ->where('tenant_id', $tenantId)
            ->where('status', 'approved')
            ->exists();

        if (! $approved) {
            return response()->json(['message' => 'O seu tenant ainda não tem acesso SMS aprovado.'], 403);
        }

        $data = $request->validate([
            'to'      => ['required', 'string'],
            'message' => ['required', 'string', 'max:160'],
        ]);

        $apiKey = DB::connection('central')
            ->table('platform_settings')
            ->where('key', 'telcosms_api_key')
            ->value('value');

        if (! $apiKey) {
            return response()->json(['message' => 'SMS da plataforma não configurado. Contacte o suporte.'], 503);
        }

        $result = (new TelcosmsDriver($apiKey))->send($data['to'], $data['message']);

        // Registar no log do tenant
        \App\Models\SmsLog::create([
            'to'      => $data['to'],
            'message' => $data['message'],
            'event'   => 'tenant_send',
            'driver'  => 'telcosms_platform',
            'status'  => $result['success'] ? 'sent' : 'failed',
            'provider_response' => $result['response'],
        ]);

        return response()->json(['success' => $result['success']], $result['success'] ? 200 : 422);
    }
}
