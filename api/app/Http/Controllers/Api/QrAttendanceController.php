<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attendance;
use App\Models\Employee;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class QrAttendanceController extends Controller
{
    /**
     * Admin gera um token QR assinado com lat/lng/raio/validade.
     * O frontend renderiza o token como imagem QR.
     */
    public function generate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'lat'            => ['required', 'numeric', 'between:-90,90'],
            'lng'            => ['required', 'numeric', 'between:-180,180'],
            'radius_meters'  => ['required', 'integer', 'min:10', 'max:5000'],
            'valid_minutes'  => ['required', 'integer', 'min:1', 'max:1440'],
            'label'          => ['nullable', 'string', 'max:100'],
        ]);

        $payload = [
            'lat'    => (float) $data['lat'],
            'lng'    => (float) $data['lng'],
            'radius' => (int) $data['radius_meters'],
            'exp'    => now()->addMinutes($data['valid_minutes'])->timestamp,
            'label'  => $data['label'] ?? null,
        ];

        $token = $this->signPayload($payload);

        $tenant = app(\App\Services\TenantService::class)->current();
        $slug   = $tenant?->slug ?? 'app';
        $url    = "https://{$slug}.rhadmin.ao/portal?qr=" . urlencode($token);

        return response()->json(['token' => $token, 'url' => $url, 'expires_at' => $payload['exp']]);
    }

    /**
     * Funcionário submete o token QR lido + a sua posição GPS.
     * Valida assinatura, expiração e distância. Regista entrada ou saída.
     */
    public function clock(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token'    => ['required', 'string'],
            'lat'      => ['required', 'numeric', 'between:-90,90'],
            'lng'      => ['required', 'numeric', 'between:-180,180'],
            'type'     => ['required', 'in:in,out'],
            'password' => ['required', 'string'],
        ]);

        // Validar password do funcionário
        if (! \Illuminate\Support\Facades\Hash::check($data['password'], $request->user()->password)) {
            return response()->json(['message' => 'Password incorrecta.'], 422);
        }

        $payload = $this->verifyToken($data['token']);

        if (! $payload) {
            return response()->json(['message' => 'QR code inválido ou adulterado.'], 422);
        }

        if (now()->timestamp > $payload['exp']) {
            return response()->json(['message' => 'QR code expirado. Solicite um novo ao administrador.'], 422);
        }

        $distance = $this->haversine($data['lat'], $data['lng'], $payload['lat'], $payload['lng']);

        if ($distance > $payload['radius']) {
            return response()->json([
                'message'  => "Está a {$distance}m do local permitido ({$payload['radius']}m de raio). Aproxime-se do local de trabalho.",
                'distance' => $distance,
                'radius'   => $payload['radius'],
            ], 422);
        }

        $user     = $request->user();
        $employee = Employee::where('email', $user->email)->orWhere('user_id', $user->id)->first();

        if (! $employee) {
            return response()->json(['message' => 'O seu utilizador não está associado a um funcionário.'], 404);
        }

        $today = now()->toDateString();
        $time  = now()->format('H:i');

        $attendance = Attendance::firstOrNew(
            ['employee_id' => $employee->id, 'date' => $today]
        );

        if ($data['type'] === 'in') {
            if ($attendance->check_in) {
                return response()->json(['message' => 'Entrada já registada hoje às ' . $attendance->check_in . '.'], 422);
            }
            $attendance->check_in     = $time;
            $attendance->check_in_lat = $data['lat'];
            $attendance->check_in_lng = $data['lng'];
            $attendance->status       = 'present';
            $attendance->source       = 'qr';
        } else {
            if (! $attendance->check_in) {
                return response()->json(['message' => 'Registe primeiro a entrada.'], 422);
            }
            if ($attendance->check_out) {
                return response()->json(['message' => 'Saída já registada hoje às ' . $attendance->check_out . '.'], 422);
            }
            $attendance->check_out     = $time;
            $attendance->check_out_lat = $data['lat'];
            $attendance->check_out_lng = $data['lng'];
            $attendance->worked_hours  = Attendance::computeHours($attendance->check_in, $time);
            $attendance->source        = 'qr';
        }

        $attendance->save();

        return response()->json([
            'message'    => $data['type'] === 'in' ? "Entrada registada às {$time}." : "Saída registada às {$time}.",
            'attendance' => $attendance,
        ]);
    }

    /**
     * Devolve o registo de presença do funcionário autenticado para hoje.
     */
    public function today(Request $request): JsonResponse
    {
        $user     = $request->user();
        $employee = Employee::where('email', $user->email)->orWhere('user_id', $user->id)->first();

        if (! $employee) {
            return response()->json(null);
        }

        $attendance = Attendance::where('employee_id', $employee->id)
            ->where('date', now()->toDateString())
            ->first();

        return response()->json($attendance);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function signPayload(array $payload): string
    {
        $encoded = base64_encode(json_encode($payload));
        $sig     = hash_hmac('sha256', $encoded, config('app.key'));

        return $encoded . '.' . $sig;
    }

    private function verifyToken(string $token): ?array
    {
        $parts = explode('.', $token, 2);
        if (count($parts) !== 2) return null;

        [$encoded, $sig] = $parts;
        $expected = hash_hmac('sha256', $encoded, config('app.key'));

        if (! hash_equals($expected, $sig)) return null;

        $payload = json_decode(base64_decode($encoded), true);

        return is_array($payload) ? $payload : null;
    }

    /**
     * Distância em metros entre dois pontos GPS (fórmula de Haversine).
     */
    private function haversine(float $lat1, float $lng1, float $lat2, float $lng2): int
    {
        $R   = 6371000;
        $phi1 = deg2rad($lat1);
        $phi2 = deg2rad($lat2);
        $dphi = deg2rad($lat2 - $lat1);
        $dlam = deg2rad($lng2 - $lng1);

        $a = sin($dphi / 2) ** 2 + cos($phi1) * cos($phi2) * sin($dlam / 2) ** 2;

        return (int) round($R * 2 * atan2(sqrt($a), sqrt(1 - $a)));
    }
}
