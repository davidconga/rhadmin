<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (! Schema::hasColumn('employee_registrations', 'bi_frente_path')) {
            Schema::table('employee_registrations', function (Blueprint $table) {
                $table->string('bi_frente_path')->nullable()->after('bi_nif');
                $table->string('bi_verso_path')->nullable()->after('bi_frente_path');
                $table->string('signature_path')->nullable()->after('bi_verso_path');
                $table->string('password')->nullable()->after('signature_path');
            });
        }
    }

    public function down(): void
    {
        Schema::table('employee_registrations', function (Blueprint $table) {
            $table->dropColumn(['bi_frente_path','bi_verso_path','signature_path','password']);
        });
    }
};
