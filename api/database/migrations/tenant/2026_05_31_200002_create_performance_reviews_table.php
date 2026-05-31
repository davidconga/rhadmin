<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('performance_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->foreignId('reviewer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedSmallInteger('period_year');
            $table->enum('period_type', ['annual', 'semi_annual', 'quarterly'])->default('annual');
            $table->unsignedTinyInteger('period_number')->default(1); // ex: Q1=1, Q2=2, S1=1, S2=2
            $table->enum('status', ['draft', 'in_progress', 'completed'])->default('draft');
            $table->enum('method', ['standard', '360', 'self', 'apo'])->default('standard');
            $table->decimal('overall_score', 4, 2)->nullable();
            $table->text('reviewer_comments')->nullable();
            $table->text('employee_comments')->nullable();
            $table->timestamp('conducted_at')->nullable();
            $table->timestamps();

            $table->unique(['employee_id', 'period_year', 'period_type', 'period_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('performance_reviews');
    }
};
