<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('career_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained()->cascadeOnDelete();
            $table->enum('type', ['promotion', 'transfer', 'role_change', 'training', 'award', 'warning', 'other']);
            $table->string('from_position')->nullable();
            $table->string('to_position')->nullable();
            $table->string('from_department')->nullable();
            $table->string('to_department')->nullable();
            $table->decimal('from_salary', 14, 2)->nullable();
            $table->decimal('to_salary', 14, 2)->nullable();
            $table->date('effective_date');
            $table->string('title')->nullable();
            $table->text('description')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('career_events');
    }
};
