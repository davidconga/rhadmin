<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Models\EmployeeRegistration;
use App\Models\User;
use App\Models\PortalToken;
use App\Services\Sms\TelcosmsDriver;
use App\Services\SmsService;
use App\Services\SmsUsageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class EmployeeRegistrationController extends Controller
{
    /** Público — funcionário submete o próprio registo */
    public function submit(Request $request): JsonResponse
    {
        $data = $request->validate([
            'full_name'  => ['required','string','max:255'],
            'email'      => ['nullable','email','max:255'],
            'phone'      => ['nullable','string','max:50'],
            'bi_nif'     => ['nullable','string','max:100'],
            'position'   => ['nullable','string','max:255'],
            'bi_frente'  => ['nullable','image','mimes:jpg,jpeg,png,webp','max:4096'],
            'bi_verso'   => ['nullable','image','mimes:jpg,jpeg,png,webp','max:4096'],
            'signature'  => ['nullable','string'],
            'password'   => ['nullable','string','min:6'],
        ]);

        $tenant = $request->attributes->get('tenant');
        $slug   = $tenant?->slug ?? 'unknown';
        $base   = "registrations/{$slug}";

        $row = [
            'full_name' => $data['full_name'],
            'email'     => $data['email'] ?? null,
            'phone'     => $data['phone'] ?? null,
            'bi_nif'    => $data['bi_nif'] ?? null,
            'position'  => $data['position'] ?? null,
            'password'  => isset($data['password']) ? Hash::make($data['password']) : null,
        ];

        if ($request->hasFile('bi_frente')) {
            $row['bi_frente_path'] = $request->file('bi_frente')->store("{$base}/bi", 'local');
        }
        if ($request->hasFile('bi_verso')) {
            $row['bi_verso_path'] = $request->file('bi_verso')->store("{$base}/bi", 'local');
        }
        if (!empty($data['signature'])) {
            $b64  = preg_replace('#^data:image/\w+;base64,#i', '', $data['signature']);
            $path = "{$base}/signatures/" . uniqid() . ".png";
            Storage::disk('local')->put($path, base64_decode($b64));
            $row['signature_path'] = $path;
        }

        $reg = EmployeeRegistration::create($row);
        return response()->json(['message' => 'Pedido submetido com sucesso.', 'id' => $reg->id], 201);
    }

    /** Admin — envia convite SMS com link de auto-registo */
    public function invite(Request $request): JsonResponse
    {
        $data = $request->validate([
            'phone' => ['required', 'string', 'max:50'],
            'name'  => ['nullable', 'string', 'max:255'],
        ]);

        $apiKey = DB::connection('central')
            ->table('platform_settings')
            ->where('key', 'telcosms_api_key')
            ->value('value');

        if (!$apiKey) {
            return response()->json(['message' => 'API key TelcoSMS não configurada.'], 422);
        }

        $tenant      = $request->attributes->get('tenant');
        $slug        = $tenant?->slug ?? '';
        $tenantName  = $tenant?->name ?? 'RHadmin';
        $base        = rtrim(config('app.frontend_url', 'http://localhost:5173'), '/');
        $link        = "{$base}/admissao/{$slug}";

        $name    = $data['name'] ? "Olá {$data['name']}! " : 'Olá! ';
        $message = "{$name}Foi convidado(a) a registar-se em {$tenantName}. Preencha o seu perfil em:\n{$link}";

        try {
            $result = (new TelcosmsDriver($apiKey))->send($data['phone'], $message);
            if (!$result['success']) {
                return response()->json(['message' => 'SMS não enviado: ' . $result['response']], 422);
            }
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Erro ao enviar SMS: ' . $e->getMessage()], 500);
        }

        if ($tenant?->id) SmsUsageService::record((int) $tenant->id);

        return response()->json(['message' => 'Convite enviado para ' . $data['phone']]);
    }

    /** Admin — listar registos pendentes */
    public function index(Request $request): JsonResponse
    {
        $query = EmployeeRegistration::orderByRaw("CASE status WHEN 'pending' THEN 0 ELSE 1 END")
            ->orderByDesc('created_at');
        if ($status = $request->query('status'))
            $query->where('status', $status);

        $page = $query->paginate(20);
        // adicionar has_password sem expor o hash
        $page->getCollection()->transform(function ($r) {
            $r->has_password = !empty($r->getAttributes()['password']);
            return $r;
        });
        return response()->json($page);
    }

    /** Admin — aprovar: cria funcionário + conta de utilizador */
    public function approve(Request $request, EmployeeRegistration $registration): JsonResponse
    {
        if ($registration->status !== 'pending')
            return response()->json(['message' => 'Já processado.'], 422);

        $data = $request->validate([
            'admin_notes'    => ['nullable','string'],
            'base_salary'    => ['required','numeric','min:0'],
            'password'       => ['nullable','string','min:6'],
            'create_account' => ['boolean'],
            'send_sms'       => ['boolean'],
        ]);

        try {
            $companyId = $request->attributes->get('company_id');

            $employee = Employee::create([
                'company_id'     => $companyId,
                'full_name'      => $registration->full_name,
                'email'          => $registration->email,
                'phone'          => $registration->phone,
                'bi_nif'         => $registration->bi_nif,
                'position'       => $registration->position,
                'signature_path' => $registration->signature_path,
                'base_salary'    => $data['base_salary'],
                'active'         => true,
            ]);

            $user = null;
            if (!empty($data['create_account']) && $registration->email) {
                // verifica se já existe utilizador com este email
                $existing = User::where('email', $registration->email)->first();

                if ($existing) {
                    // liga o funcionário ao utilizador existente
                    $user = $existing;
                    $user->update(['employee_id' => $employee->id]);
                } else {
                    $storedHash = null;
                    try { $storedHash = $registration->getAttributes()['password'] ?? null; } catch (\Throwable) {}
                    $hashedPw = $storedHash
                        ?? ($data['password'] ? Hash::make($data['password']) : Hash::make(Str::random(10)));

                    $user = User::create([
                        'employee_id' => $employee->id,
                        'name'        => $registration->full_name,
                        'email'       => $registration->email,
                        'password'    => $hashedPw,
                        'role'        => 'employee',
                        'active'      => true,
                    ]);
                }
                $employee->update(['user_id' => $user->id]);
            }

            $registration->update([
                'status'      => 'approved',
                'admin_notes' => $data['admin_notes'] ?? null,
                'employee_id' => $employee->id,
            ]);

            $loginToken = $user ? PortalToken::generate($user->id) : null;

            $smsSent = false;
            if (!empty($data['send_sms']) && $registration->phone) {
                $smsSent = $this->sendApprovalSms(
                    $registration->phone,
                    $registration->full_name,
                    $loginToken?->token,
                    $request->attributes->get('tenant')?->slug ?? '',
                    $user !== null,
                );
            }

            return response()->json([
                'message'  => 'Aprovado.' . ($smsSent ? ' SMS enviado.' : ''),
                'employee' => $employee,
                'sms_sent' => $smsSent,
            ]);

        } catch (\Throwable $e) {
            return response()->json(['message' => 'Erro: ' . $e->getMessage()], 500);
        }
    }

    private function sendApprovalSms(
        string $phone, string $name,
        ?string $loginToken, string $slug, bool $hasAccount
    ): bool {
        $apiKey = DB::connection('central')
            ->table('platform_settings')
            ->where('key', 'telcosms_api_key')
            ->value('value');

        if (!$apiKey) return false;

        $base = rtrim(config('app.frontend_url', 'http://localhost:5173'), '/');

        if ($hasAccount && $loginToken) {
            $link    = "{$base}/portal?token={$loginToken}&org={$slug}";
            $message = "Olá {$name}! O seu registo foi aprovado.\nAceda ao portal com este link (válido 48h):\n{$link}";
        } else {
            $message = "Olá {$name}! O seu registo foi aprovado pela empresa. Bem-vindo(a)!";
        }

        try {
            $result = (new TelcosmsDriver($apiKey))->send($phone, $message);
            if ($result['success']) {
                $tenantId = DB::connection('central')
                    ->table('tenants')
                    ->where('slug', $slug)
                    ->value('id');
                if ($tenantId) SmsUsageService::record((int) $tenantId);
            }
            return $result['success'];
        } catch (\Throwable) {
            return false;
        }
    }

    /** Admin — rejeitar */
    public function reject(Request $request, EmployeeRegistration $registration): JsonResponse
    {
        if ($registration->status !== 'pending')
            return response()->json(['message' => 'Já processado.'], 422);
        $registration->update([
            'status'      => 'rejected',
            'admin_notes' => $request->input('admin_notes'),
        ]);
        return response()->json(['message' => 'Rejeitado.']);
    }
}
