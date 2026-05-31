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
        if (! Schema::hasColumn('salary_slips', 'receipt_confirmed_at')) {
            Schema::table('salary_slips', function (Blueprint $table) {
                $table->timestamp('receipt_confirmed_at')->nullable()->after('issued_at');
            });
        }
    }

    public function down(): void
    {
        Schema::table('salary_slips', function (Blueprint $table) {
            $table->dropColumn('receipt_confirmed_at');
        });
    }
};
