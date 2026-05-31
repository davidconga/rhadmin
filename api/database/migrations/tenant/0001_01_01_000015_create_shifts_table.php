<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shifts', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('code', 10);               // M, T, N, 24, PQ, FG, ...
            $table->enum('type', [
                'regular',   // turno normal
                'oncall',    // piquete (de sobreaviso)
                'rest',      // folga programada
                'holiday',   // feriado/folga especial
            ])->default('regular');
            $table->string('start_time', 5)->nullable();  // HH:MM
            $table->string('end_time', 5)->nullable();    // HH:MM
            $table->unsignedSmallInteger('duration_hours')->default(0);
            $table->boolean('crosses_midnight')->default(false);
            $table->string('color', 7)->default('#085041'); // hex
            $table->boolean('counts_as_worked')->default(true);
            $table->boolean('active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shifts');
    }
};
