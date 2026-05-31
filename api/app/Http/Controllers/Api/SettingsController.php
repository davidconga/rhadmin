<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Support\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SettingsController extends Controller
{
    public function show(): JsonResponse
    {
        return response()->json(Setting::allMerged());
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'irt_brackets' => ['sometimes', 'array', 'min:1'],
            'irt_brackets.*.limit' => ['required', 'numeric', 'min:0'],
            'irt_brackets.*.rate' => ['required', 'numeric', 'min:0', 'max:1'],
            'irt_exempt_allowances' => ['sometimes', 'boolean'],
            'inss_employee_rate' => ['sometimes', 'numeric', 'min:0', 'max:100'],
            'inss_company_rate' => ['sometimes', 'numeric', 'min:0', 'max:100'],
            'attendance_entry_limit' => ['sometimes', 'string', 'max:5'],
            'payroll_use_attendance' => ['sometimes', 'boolean'],
            'standard_working_days' => ['sometimes', 'numeric', 'min:1', 'max:31'],
            'standard_daily_hours' => ['sometimes', 'numeric', 'min:1', 'max:24'],
            'overtime_multiplier' => ['sometimes', 'numeric', 'min:1', 'max:5'],
            'vacation_days_per_year' => ['sometimes', 'integer', 'min:0', 'max:365'],
            'vacation_carry_over_max' => ['sometimes', 'integer', 'min:0'],
            'vacation_holidays' => ['sometimes', 'array'],
            'vacation_holidays.*' => ['date'],
            'shift_rest_after_night_hours' => ['sometimes', 'integer', 'min:0', 'max:24'],
            'shift_max_consecutive_days' => ['sometimes', 'integer', 'min:1', 'max:31'],
            'shift_weekly_hours_limit' => ['sometimes', 'integer', 'min:1', 'max:168'],
        ]);

        foreach ($data as $key => $value) {
            if ($key === 'irt_brackets') {
                // normaliza e ordena por limite
                $value = collect($value)
                    ->map(fn ($b) => ['limit' => (float) $b['limit'], 'rate' => (float) $b['rate']])
                    ->sortBy('limit')->values()->all();
            }
            Setting::set($key, $value);
        }

        Audit::log('settings_updated');

        return response()->json(Setting::allMerged());
    }
}
