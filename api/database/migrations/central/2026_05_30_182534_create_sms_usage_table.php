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
        Schema::create('sms_usage', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tenant_id');
            $table->unsignedTinyInteger('month');
            $table->unsignedSmallInteger('year');
            $table->unsignedInteger('sms_count')->default(0);
            $table->decimal('price_per_sms', 10, 4)->default(0);  // preço unitário na altura do envio
            $table->boolean('billed')->default(false);
            $table->timestamp('billed_at')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'month', 'year']);
            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sms_usage');
    }
};
