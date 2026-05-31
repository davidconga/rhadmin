<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('channels', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->timestamps();
        });

        Schema::create('channel_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('channel_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('sender_id');
            $table->text('body');
            $table->timestamps();
        });

        // Canal geral por defeito
        DB::table('channels')->insert([
            'name'        => 'Geral',
            'slug'        => 'geral',
            'description' => 'Canal de comunicação geral da empresa',
            'created_at'  => now(),
            'updated_at'  => now(),
        ]);
    }

    public function down(): void {
        Schema::dropIfExists('channel_messages');
        Schema::dropIfExists('channels');
    }
};
