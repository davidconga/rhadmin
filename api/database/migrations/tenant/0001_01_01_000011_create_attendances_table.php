<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attendances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->date('date');
            // present | late | absent | justified | vacation | sick | holiday
            $table->string('status')->default('present');
            $table->string('check_in')->nullable();   // HH:MM
            $table->string('check_out')->nullable();   // HH:MM
            $table->decimal('worked_hours', 6, 2)->nullable();
            $table->string('notes')->nullable();
            $table->timestamps();

            $table->unique(['employee_id', 'date']);
            $table->index(['date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendances');
    }
};
