<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('central')->create('plans', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('name');
            $table->text('description')->nullable();
            $table->unsignedInteger('price_aoa')->default(0);
            $table->unsignedInteger('max_companies')->default(1);
            $table->unsignedInteger('max_employees')->default(10);
            $table->unsignedInteger('max_users')->default(2);
            $table->json('features')->nullable();
            $table->boolean('active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::connection('central')->table('tenants', function (Blueprint $table) {
            $table->unsignedBigInteger('plan_id')->nullable()->after('active');
            $table->enum('subscription_status', ['trial', 'active', 'suspended', 'cancelled'])->default('trial')->after('plan_id');
            $table->timestamp('trial_ends_at')->nullable()->after('subscription_status');
            $table->timestamp('subscribed_at')->nullable()->after('trial_ends_at');
        });
    }

    public function down(): void
    {
        Schema::connection('central')->table('tenants', function (Blueprint $table) {
            $table->dropColumn(['plan_id', 'subscription_status', 'trial_ends_at', 'subscribed_at']);
        });
        Schema::connection('central')->dropIfExists('plans');
    }
};
