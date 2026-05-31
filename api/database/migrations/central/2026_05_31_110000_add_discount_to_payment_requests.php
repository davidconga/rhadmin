<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'central';

    public function up(): void
    {
        Schema::connection('central')->table('payment_requests', function (Blueprint $table) {
            $table->integer('discount')->default(0)->after('amount');
        });
    }

    public function down(): void
    {
        Schema::connection('central')->table('payment_requests', function (Blueprint $table) {
            $table->dropColumn('discount');
        });
    }
};
