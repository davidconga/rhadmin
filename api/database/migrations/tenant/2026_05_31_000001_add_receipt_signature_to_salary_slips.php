<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('salary_slips', 'receipt_signature_path')) {
            Schema::table('salary_slips', function (Blueprint $table) {
                $table->string('receipt_signature_path')->nullable()->after('receipt_confirmed_at');
            });
        }
    }

    public function down(): void
    {
        Schema::table('salary_slips', function (Blueprint $table) {
            $table->dropColumn('receipt_signature_path');
        });
    }
};
