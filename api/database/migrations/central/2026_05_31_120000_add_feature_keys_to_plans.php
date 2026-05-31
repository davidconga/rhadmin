<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'central';

    public function up(): void
    {
        Schema::connection('central')->table('plans', function (Blueprint $table) {
            $table->json('feature_keys')->nullable()->after('features');
        });

        $map = [
            'basic'        => ['employees','salary_slips','contracts','departments','positions'],
            'profissional' => ['employees','salary_slips','contracts','departments','positions','attendance','schedules','vacations','banks'],
            'empresarial'  => ['employees','salary_slips','contracts','departments','positions','attendance','schedules','vacations','banks','biometrics','payment_orders','api_keys','sms'],
        ];

        foreach ($map as $slug => $keys) {
            DB::connection('central')->table('plans')
                ->where('slug', $slug)
                ->update(['feature_keys' => json_encode($keys)]);
        }
    }

    public function down(): void
    {
        Schema::connection('central')->table('plans', function (Blueprint $table) {
            $table->dropColumn('feature_keys');
        });
    }
};
