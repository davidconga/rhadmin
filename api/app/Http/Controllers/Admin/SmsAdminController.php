<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\Sms\TelcosmsDriver;
use App\Services\SmsUsageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SmsAdminController extends Controller
{
    private function getKey(): string
    {
        return DB::connection('central')
            ->table('platform_settings')
            ->where('key', 'telcosms_api_key')
            ->value('value') ?? '';
    }

    private function saveKey(string $key): void
    {
        DB::connection('central')->table('platform_settings')->upsert(
            [['key' => 'telcosms_api_key', 'value' => $key, 'updated_at' => now(), 'created_at' => now()]],
            ['key'],
            ['value', 'updated_at']
        );
    }

    /** Usage de SMS por tenant no mês corrente. */
    public function usage(): JsonResponse
    {
        $month = (int) now()->format('m');
        $year  = (int) now()->format('Y');
        $price = SmsUsageService::pricePerSms();

        $rows = DB::connection('central')
            ->table('sms_usage')
            ->join('tenants', 'tenants.id', '=', 'sms_usage.tenant_id')
            ->select('sms_usage.*', 'tenants.name as tenant_name', 'tenants.slug as tenant_slug')
            ->where('sms_usage.month', $month)
            ->where('sms_usage.year', $year)
            ->orderByDesc('sms_usage.sms_count')
            ->get();

        return response()->json([
            'month'         => $month,
            'year'          => $year,
            'price_per_sms' => $price,
            'total_sms'     => $rows->sum('sms_count'),
            'total_cost'    => $rows->sum(fn($r) => $r->sms_count * $price),
            'tenants'       => $rows,
        ]);
    }

    /** Lista pedidos de acesso SMS. */
    public function requests(Request $request): JsonResponse
    {
        $query = DB::connection('central')
            ->table('sms_requests')
            ->join('tenants', 'tenants.id', '=', 'sms_requests.tenant_id')
            ->select('sms_requests.*', 'tenants.name as tenant_name', 'tenants.slug as tenant_slug')
            ->orderByRaw("CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END")
            ->orderByDesc('sms_requests.created_at');

        if ($status = $request->query('status')) {
            $query->where('sms_requests.status', $status);
        }

        return response()->json($query->get());
    }

    /** Aprova ou rejeita um pedido. */
    public function review(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'status'      => ['required', 'in:approved,rejected'],
            'admin_notes' => ['nullable', 'string', 'max:500'],
        ]);

        $updated = DB::connection('central')
            ->table('sms_requests')
            ->where('id', $id)
            ->update([
                'status'      => $data['status'],
                'admin_notes' => $data['admin_notes'] ?? null,
                'reviewed_at' => now(),
                'updated_at'  => now(),
            ]);

        if (! $updated) {
            return response()->json(['message' => 'Pedido não encontrado.'], 404);
        }

        return response()->json(['message' => ucfirst($data['status']) . ' com sucesso.']);
    }

    /** Devolve a configuração actual (chave mascarada). */
    public function config(): JsonResponse
    {
        $key = $this->getKey();
        return response()->json([
            'api_key'        => $key ? substr($key, 0, 6) . str_repeat('•', max(0, strlen($key) - 6)) : '',
            'api_key_set'    => $key !== '',
        ]);
    }

    /** Guarda a API key. */
    public function saveConfig(Request $request): JsonResponse
    {
        $data = $request->validate([
            'api_key' => ['required', 'string', 'min:8'],
        ]);

        $this->saveKey($data['api_key']);

        return response()->json(['message' => 'Chave TelcoSMS guardada.']);
    }

    /** Verifica o saldo. */
    public function balance(): JsonResponse
    {
        $key = $this->getKey();
        if (! $key) {
            return response()->json(['message' => 'Configure a API key primeiro.'], 422);
        }

        $result = (new TelcosmsDriver($key))->checkBalance();
        return response()->json($result);
    }

    /** Logs de SMS de um tenant específico. */
    public function tenantLogs(string $slug): JsonResponse
    {
        $tenant = DB::connection('central')->table('tenants')->where('slug', $slug)->first();
        if (! $tenant) {
            return response()->json(['message' => 'Tenant não encontrado.'], 404);
        }

        $dbPath = database_path("../storage/databases/{$slug}.sqlite");
        if (! file_exists($dbPath)) {
            return response()->json(['data' => [], 'total' => 0]);
        }

        config(["database.connections.tenant_{$slug}" => [
            'driver'   => 'sqlite',
            'database' => $dbPath,
            'prefix'   => '',
        ]]);

        $logs = DB::connection("tenant_{$slug}")
            ->table('sms_logs')
            ->orderByDesc('created_at')
            ->limit(100)
            ->get();

        return response()->json([
            'tenant' => ['id' => $tenant->id, 'name' => $tenant->name, 'slug' => $tenant->slug],
            'data'   => $logs,
            'total'  => $logs->count(),
        ]);
    }

    /** Envia SMS de teste. */
    public function test(Request $request): JsonResponse
    {
        $data = $request->validate([
            'to'      => ['required', 'string'],
            'message' => ['nullable', 'string', 'max:160'],
        ]);

        $key = $this->getKey();
        if (! $key) {
            return response()->json(['message' => 'Configure a API key primeiro.'], 422);
        }

        $msg    = $data['message'] ?? 'Teste de SMS RHadmin — integração TelcoSMS a funcionar!';
        $result = (new TelcosmsDriver($key))->send($data['to'], $msg);

        return response()->json([
            'success'  => $result['success'],
            'response' => $result['response'],
        ], $result['success'] ? 200 : 422);
    }
}
