<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('salary_slips', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->unsignedSmallInteger('month');
            $table->unsignedSmallInteger('year');

            // Rendimentos
            $table->decimal('base_salary', 14, 2)->default(0);
            $table->decimal('food_allowance', 14, 2)->default(0);
            $table->decimal('transport_allowance', 14, 2)->default(0);
            $table->decimal('overtime', 14, 2)->default(0);
            $table->decimal('other_income', 14, 2)->default(0);

            // Descontos
            $table->decimal('irt_tax', 14, 2)->default(0);
            $table->decimal('social_security', 14, 2)->default(0);
            $table->decimal('other_deductions', 14, 2)->default(0);

            // Totais
            $table->decimal('gross_salary', 14, 2)->default(0);
            $table->decimal('total_deductions', 14, 2)->default(0);
            $table->decimal('net_salary', 14, 2)->default(0);

            $table->enum('status', ['draft', 'issued', 'paid'])->default('draft');
            $table->timestamp('issued_at')->nullable();
            $table->timestamps();

            $table->unique(['employee_id', 'month', 'year']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('salary_slips');
    }
};
