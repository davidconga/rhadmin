<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('salary_slips', 'issued_by_name')) {
            Schema::table('salary_slips', function (Blueprint $table) {
                $table->string('issued_by_name')->nullable()->after('issued_at');
            });
        }
    }

    public function down(): void
    {
        Schema::table('salary_slips', function (Blueprint $table) {
            $table->dropColumn('issued_by_name');
        });
    }
};
