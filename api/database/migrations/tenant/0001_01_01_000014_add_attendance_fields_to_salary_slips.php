<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('salary_slips', function (Blueprint $table) {
            // Informativos vindos da assiduidade
            $table->unsignedSmallInteger('absence_days')->default(0)->after('other_deductions');
            $table->decimal('overtime_hours', 6, 2)->default(0)->after('absence_days');
        });
    }

    public function down(): void
    {
        Schema::table('salary_slips', function (Blueprint $table) {
            $table->dropColumn(['absence_days', 'overtime_hours']);
        });
    }
};
