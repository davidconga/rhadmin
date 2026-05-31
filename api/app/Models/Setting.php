<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Configurações por tenant (key/value JSON). Inclui a tabela de IRT e as
 * taxas de Segurança Social, para serem editáveis sem alterar código.
 */
class Setting extends Model
{
    protected $fillable = ['key', 'value'];

    protected function casts(): array
    {
        return ['value' => 'array'];
    }

    /**
     * Valores por defeito usados quando ainda não há nada gravado.
     *
     * @return array<string, mixed>
     */
    public static function defaults(): array
    {
        return [
            // Escalões de IRT: limite_inferior + taxa (fração). Tabela RHadmin.
            'irt_brackets' => [
                ['limit' => 0,       'rate' => 0.00],
                ['limit' => 70000,   'rate' => 0.10],
                ['limit' => 100000,  'rate' => 0.13],
                ['limit' => 150000,  'rate' => 0.16],
                ['limit' => 200000,  'rate' => 0.18],
                ['limit' => 300000,  'rate' => 0.19],
                ['limit' => 500000,  'rate' => 0.20],
            ],
            // Subsídios de alimentação e transporte isentos de IRT.
            'irt_exempt_allowances' => true,
            // Segurança Social (INSS)
            'inss_employee_rate' => 3,  // % retido ao funcionário
            'inss_company_rate' => 8,   // % a cargo da entidade empregadora
            // Assiduidade: hora-limite de entrada (acima disto conta como atraso)
            'attendance_entry_limit' => '08:15',
            // Processamento salarial a partir da assiduidade
            'payroll_use_attendance' => false,  // descontar faltas / pagar horas extra
            'standard_working_days' => 22,      // dias úteis padrão (base p/ taxa diária)
            'standard_daily_hours' => 8,        // horas/dia (base p/ taxa horária e extra)
            'overtime_multiplier' => 1.5,       // fator de pagamento das horas extra
            // Férias
            'vacation_days_per_year' => 22,    // dias úteis a que o funcionário tem direito (lei angolana)
            'vacation_carry_over_max' => 0,    // máx. dias transitáveis para o ano seguinte (0 = sem carry-over)
            'vacation_holidays' => [],         // feriados excluídos do cálculo (array de 'YYYY-MM-DD')
            // Escalas / turnos
            'shift_rest_after_night_hours' => 11,
            'shift_max_consecutive_days' => 6,
            'shift_weekly_hours_limit' => 40,
            // SMS / Telco
            'sms_enabled'        => false,
            'sms_driver'         => 'africas_talking', // africas_talking | unitel | http_webhook
            'sms_api_key'        => '',
            'sms_username'       => '',
            'sms_sender_id'      => 'RHadmin',
            'sms_webhook_url'    => '',
            'sms_webhook_method' => 'POST',
            'sms_notify_slip'    => true,  // notificar ao emitir recibo
            'sms_notify_welcome' => true,  // SMS de boas-vindas ao novo utilizador
            'sms_notify_trial'   => true,  // alerta trial a expirar
        ];
    }

    public static function get(string $key, mixed $fallback = null): mixed
    {
        $row = static::query()->where('key', $key)->first();
        if ($row) {
            return $row->value;
        }

        return $fallback ?? (static::defaults()[$key] ?? null);
    }

    public static function set(string $key, mixed $value): void
    {
        static::updateOrCreate(['key' => $key], ['value' => $value]);
    }

    /**
     * Todas as definições (defaults sobrepostos pelos valores gravados).
     *
     * @return array<string, mixed>
     */
    public static function allMerged(): array
    {
        $stored = static::all()->pluck('value', 'key')->toArray();

        return array_merge(static::defaults(), $stored);
    }
}
