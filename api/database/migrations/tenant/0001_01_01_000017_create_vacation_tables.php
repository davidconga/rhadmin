<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Saldo de férias por funcionário/ano
        Schema::create('vacation_balances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->unsignedSmallInteger('year');
            $table->unsignedSmallInteger('entitled_days')->default(22);  // dias a que tem direito
            $table->unsignedSmallInteger('carried_over')->default(0);    // transitados do ano anterior
            $table->unsignedSmallInteger('used_days')->default(0);       // dias já aprovados
            $table->unsignedSmallInteger('extra_days')->default(0);      // dias extra (bónus, etc.)
            $table->timestamps();
            $table->unique(['employee_id', 'year']);
        });

        // Pedidos de férias
        Schema::create('vacation_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->date('start_date');
            $table->date('end_date');
            $table->unsignedSmallInteger('working_days');  // dias úteis no período
            $table->string('reason')->nullable();
            $table->enum('status', ['pending', 'approved', 'rejected', 'cancelled'])->default('pending');
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vacation_requests');
        Schema::dropIfExists('vacation_balances');
    }
};
