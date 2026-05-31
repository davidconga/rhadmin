<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class SettingsController extends Controller
{
    private const KEYS = [
        'platform_name', 'payment_nif', 'payment_address', 'payment_email',
        'payment_iban', 'payment_bank', 'payment_beneficiary', 'payment_notify_phone',
        'trial_days', 'telcosms_api_key', 'sms_price_per_unit', 'fr_sequence',
    ];

    public function show(): JsonResponse
    {
        $rows = DB::connection('central')
            ->table('platform_settings')
            ->whereIn('key', self::KEYS)
            ->pluck('value', 'key');

        return response()->json($rows);
    }

    public function uploadLogo(Request $request): JsonResponse
    {
        $request->validate(['logo' => ['required', 'image', 'mimes:png,jpg,jpeg,webp,svg', 'max:2048']]);

        $old = DB::connection('central')->table('platform_settings')->where('key','platform_logo_path')->value('value');
        if ($old && Storage::disk('local')->exists($old)) {
            Storage::disk('local')->delete($old);
        }

        $path = $request->file('logo')->storeAs('platform', 'logo.' . $request->file('logo')->extension(), 'local');

        DB::connection('central')->table('platform_settings')->updateOrInsert(
            ['key' => 'platform_logo_path'],
            ['value' => $path, 'updated_at' => now()]
        );

        return response()->json(['path' => $path]);
    }

    public function logo()
    {
        $path = DB::connection('central')->table('platform_settings')->where('key','platform_logo_path')->value('value');
        abort_if(! $path || ! Storage::disk('local')->exists($path), 404);
        return Storage::disk('local')->response($path);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'platform_name'       => ['sometimes', 'string', 'max:255'],
            'payment_nif'         => ['sometimes', 'nullable', 'string', 'max:50'],
            'payment_address'     => ['sometimes', 'nullable', 'string', 'max:255'],
            'payment_email'       => ['sometimes', 'nullable', 'email', 'max:255'],
            'payment_iban'        => ['sometimes', 'nullable', 'string', 'max:100'],
            'payment_bank'        => ['sometimes', 'nullable', 'string', 'max:255'],
            'payment_beneficiary' => ['sometimes', 'nullable', 'string', 'max:255'],
            'payment_notify_phone'=> ['sometimes', 'nullable', 'string', 'max:30'],
            'trial_days'          => ['sometimes', 'integer', 'min:1', 'max:365'],
            'sms_price_per_unit'  => ['sometimes', 'numeric', 'min:0'],
        ]);

        $now = now();
        foreach ($data as $key => $value) {
            DB::connection('central')->table('platform_settings')->updateOrInsert(
                ['key' => $key],
                ['value' => (string) $value, 'updated_at' => $now]
            );
        }

        return response()->json(['message' => 'Configurações guardadas.']);
    }
}
