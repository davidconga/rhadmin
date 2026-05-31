<?php
namespace App\Services;

use Illuminate\Support\Facades\DB;

class SmsUsageService
{
    /** Preço por SMS definido nas platform_settings (default: 5 AOA). */
    public static function pricePerSms(): float
    {
        return (float) (DB::connection('central')
            ->table('platform_settings')
            ->where('key', 'sms_price_per_unit')
            ->value('value') ?? 5.00);
    }

    /**
     * Regista um SMS enviado para um tenant no mês corrente.
     * Usa upsert para incrementar atomicamente.
     */
    public static function record(int $tenantId, int $count = 1): void
    {
        $month = (int) now()->format('m');
        $year  = (int) now()->format('Y');
        $price = static::pricePerSms();

        DB::connection('central')->table('sms_usage')->upsert(
            [[
                'tenant_id'    => $tenantId,
                'month'        => $month,
                'year'         => $year,
                'sms_count'    => $count,
                'price_per_sms'=> $price,
                'billed'       => false,
                'created_at'   => now(),
                'updated_at'   => now(),
            ]],
            ['tenant_id', 'month', 'year'],
            ['sms_count' => DB::raw("sms_count + {$count}"), 'updated_at' => now()]
        );
    }

    /** Custo total (não faturado) de um tenant. */
    public static function pendingCost(int $tenantId): array
    {
        $rows = DB::connection('central')
            ->table('sms_usage')
            ->where('tenant_id', $tenantId)
            ->where('billed', false)
            ->get();

        $total = $rows->sum(fn($r) => $r->sms_count * $r->price_per_sms);
        $count = $rows->sum('sms_count');

        return ['count' => $count, 'cost' => $total, 'rows' => $rows];
    }

    /** Marca como faturado (chamado quando a mensalidade é paga). */
    public static function markBilled(int $tenantId): void
    {
        DB::connection('central')
            ->table('sms_usage')
            ->where('tenant_id', $tenantId)
            ->where('billed', false)
            ->update(['billed' => true, 'billed_at' => now()]);
    }
}
