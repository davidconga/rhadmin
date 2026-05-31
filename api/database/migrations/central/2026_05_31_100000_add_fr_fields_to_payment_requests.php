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
        // Adiciona colunas apenas se ainda não existirem (idempotente)
        Schema::connection('central')->table('payment_requests', function (Blueprint $table) {
            $cols = DB::connection('central')
                ->select("PRAGMA table_info('payment_requests')");
            $existing = array_column($cols, 'name');

            if (! in_array('fr_number', $existing)) {
                $table->string('fr_number')->nullable()->after('reviewed_at');
            }
            if (! in_array('fr_path', $existing)) {
                $table->string('fr_path')->nullable()->after('fr_number');
            }
            if (! in_array('contact_phone', $existing)) {
                $table->string('contact_phone')->nullable()->after('fr_path');
            }
        });

        // Garante que fr_sequence existe na platform_settings
        $exists = DB::connection('central')
            ->table('platform_settings')
            ->where('key', 'fr_sequence')
            ->exists();

        if (! $exists) {
            DB::connection('central')->table('platform_settings')->insert([
                'key'        => 'fr_sequence',
                'value'      => '0',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::connection('central')->table('payment_requests', function (Blueprint $table) {
            $table->dropColumn(['fr_number', 'fr_path', 'contact_phone']);
        });
    }
};
