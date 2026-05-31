<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BiometricDevice;
use App\Services\BiometricImportService;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BiometricController extends Controller
{
    public function __construct(protected BiometricImportService $importer) {}

    // ---- Dispositivos ----

    public function index(): JsonResponse
    {
        return response()->json(BiometricDevice::orderBy('name')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $device = BiometricDevice::create($this->validateDevice($request));
        Audit::log('created', $device);

        return response()->json($device, 201);
    }

    public function update(Request $request, BiometricDevice $device): JsonResponse
    {
        $device->update($this->validateDevice($request));

        return response()->json($device);
    }

    public function destroy(BiometricDevice $device): JsonResponse
    {
        $device->delete();

        return response()->json(null, 204);
    }

    /**
     * Testa a conectividade de rede ao terminal (TCP no ip:porta).
     */
    public function testConnection(BiometricDevice $device): JsonResponse
    {
        if (! $device->ip_address) {
            return response()->json(['reachable' => false, 'message' => 'Sem endereço IP configurado.'], 422);
        }

        $start = microtime(true);
        $conn = @fsockopen($device->ip_address, (int) $device->port, $errno, $errstr, 3);
        $ms = (int) round((microtime(true) - $start) * 1000);

        if ($conn) {
            fclose($conn);
            return response()->json([
                'reachable' => true,
                'message' => "Terminal acessível em {$device->ip_address}:{$device->port} ({$ms} ms).",
            ]);
        }

        return response()->json([
            'reachable' => false,
            'message' => "Sem resposta de {$device->ip_address}:{$device->port} — {$errstr}.",
        ]);
    }

    // ---- Ingestão de picagens ----

    /**
     * Importa um ficheiro de picagens exportado do terminal (CSV/TXT).
     */
    public function import(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt,dat', 'max:5120'],
            'device_id' => ['nullable', 'exists:biometric_devices,id'],
        ]);

        $punches = $this->importer->parseFile($request->file('file'));
        $result = $this->importer->processPunches($punches);

        $this->touchDevice($request->input('device_id'));
        Audit::log("biometric_import:{$result['attendances']}");

        return response()->json($result);
    }

    /**
     * Recebe picagens em JSON (push de um agente local ligado ao terminal).
     */
    public function punches(Request $request): JsonResponse
    {
        $data = $request->validate([
            'device_id' => ['nullable', 'exists:biometric_devices,id'],
            'punches' => ['required', 'array', 'min:1'],
            'punches.*.biometric_id' => ['required_without:punches.*.employee_id', 'string'],
            'punches.*.employee_id' => ['nullable', 'integer'],
            'punches.*.timestamp' => ['required', 'string'],
        ]);

        $result = $this->importer->processPunches($data['punches']);

        $this->touchDevice($data['device_id'] ?? null);
        Audit::log("biometric_push:{$result['attendances']}");

        return response()->json($result);
    }

    // ---- helpers ----

    private function validateDevice(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'brand' => ['nullable', 'string', 'max:100'],
            'model' => ['nullable', 'string', 'max:100'],
            'ip_address' => ['nullable', 'ip'],
            'port' => ['nullable', 'integer', 'between:1,65535'],
            'location' => ['nullable', 'string', 'max:255'],
            'active' => ['boolean'],
        ]);
    }

    private function touchDevice($deviceId): void
    {
        if ($deviceId) {
            BiometricDevice::where('id', $deviceId)->update(['last_sync_at' => now()]);
        }
    }
}
