<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('performance_review_criteria', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('category')->default('Geral');
            $table->decimal('weight', 5, 2)->default(5);
            $table->text('description')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        $now = now();
        DB::table('performance_review_criteria')->insert([
            // Desempenho e Resultados
            ['name'=>'Cumprimento de metas e objectivos',      'category'=>'Desempenho e Resultados',      'weight'=>8.5,'description'=>'Grau de alcance das metas e objectivos definidos para o período.','active'=>true,'created_at'=>$now,'updated_at'=>$now],
            ['name'=>'Qualidade do trabalho entregue',          'category'=>'Desempenho e Resultados',      'weight'=>8.5,'description'=>'Precisão, rigor e padrão de qualidade do trabalho realizado.','active'=>true,'created_at'=>$now,'updated_at'=>$now],
            ['name'=>'Produtividade e eficiência',              'category'=>'Desempenho e Resultados',      'weight'=>8,  'description'=>'Volume e eficiência no uso do tempo de trabalho.','active'=>true,'created_at'=>$now,'updated_at'=>$now],
            // Competências Técnicas
            ['name'=>'Domínio das ferramentas e conhecimentos', 'category'=>'Competências Técnicas',        'weight'=>7,  'description'=>'Domínio das ferramentas, sistemas e conhecimentos necessários à função.','active'=>true,'created_at'=>$now,'updated_at'=>$now],
            ['name'=>'Capacidade de resolver problemas',        'category'=>'Competências Técnicas',        'weight'=>7,  'description'=>'Capacidade de identificar e resolver problemas de forma eficaz.','active'=>true,'created_at'=>$now,'updated_at'=>$now],
            ['name'=>'Actualização profissional',               'category'=>'Competências Técnicas',        'weight'=>6,  'description'=>'Investimento contínuo na aprendizagem e desenvolvimento técnico.','active'=>true,'created_at'=>$now,'updated_at'=>$now],
            // Competências Comportamentais
            ['name'=>'Trabalho em equipa',                      'category'=>'Competências Comportamentais', 'weight'=>6,  'description'=>'Colaboração e contribuição para o sucesso colectivo.','active'=>true,'created_at'=>$now,'updated_at'=>$now],
            ['name'=>'Comunicação',                             'category'=>'Competências Comportamentais', 'weight'=>5,  'description'=>'Clareza e eficácia na comunicação com colegas, chefia e clientes.','active'=>true,'created_at'=>$now,'updated_at'=>$now],
            ['name'=>'Proactividade e iniciativa',              'category'=>'Competências Comportamentais', 'weight'=>5,  'description'=>'Capacidade de agir sem necessitar de orientação constante.','active'=>true,'created_at'=>$now,'updated_at'=>$now],
            ['name'=>'Adaptabilidade a mudanças',               'category'=>'Competências Comportamentais', 'weight'=>4,  'description'=>'Flexibilidade para ajustar-se a novos processos e situações.','active'=>true,'created_at'=>$now,'updated_at'=>$now],
            // Assiduidade e Pontualidade
            ['name'=>'Faltas justificadas e injustificadas',    'category'=>'Assiduidade e Pontualidade',   'weight'=>5,  'description'=>'Registo e impacto das ausências no trabalho.','active'=>true,'created_at'=>$now,'updated_at'=>$now],
            ['name'=>'Cumprimento de horários',                 'category'=>'Assiduidade e Pontualidade',   'weight'=>5,  'description'=>'Pontualidade e respeito pelos horários definidos.','active'=>true,'created_at'=>$now,'updated_at'=>$now],
            ['name'=>'Disponibilidade',                         'category'=>'Assiduidade e Pontualidade',   'weight'=>5,  'description'=>'Compromisso e disponibilidade além do estritamente exigido.','active'=>true,'created_at'=>$now,'updated_at'=>$now],
            // Liderança
            ['name'=>'Capacidade de motivar a equipa',          'category'=>'Liderança',                    'weight'=>3.5,'description'=>'Capacidade de inspirar e manter a equipa motivada. (Apenas para cargos de chefia)','active'=>true,'created_at'=>$now,'updated_at'=>$now],
            ['name'=>'Tomada de decisão',                       'category'=>'Liderança',                    'weight'=>3.5,'description'=>'Assertividade e eficácia na tomada de decisões. (Apenas para cargos de chefia)','active'=>true,'created_at'=>$now,'updated_at'=>$now],
            ['name'=>'Gestão de conflitos',                     'category'=>'Liderança',                    'weight'=>3,  'description'=>'Capacidade de gerir e resolver conflitos na equipa. (Apenas para cargos de chefia)','active'=>true,'created_at'=>$now,'updated_at'=>$now],
            // Desenvolvimento Pessoal
            ['name'=>'Formações realizadas',                    'category'=>'Desenvolvimento Pessoal',      'weight'=>3,  'description'=>'Participação em formações e acções de desenvolvimento.','active'=>true,'created_at'=>$now,'updated_at'=>$now],
            ['name'=>'Crescimento desde a última avaliação',    'category'=>'Desenvolvimento Pessoal',      'weight'=>3,  'description'=>'Evolução observada em relação ao período de avaliação anterior.','active'=>true,'created_at'=>$now,'updated_at'=>$now],
            ['name'=>'Abertura a feedback',                     'category'=>'Desenvolvimento Pessoal',      'weight'=>3,  'description'=>'Receptividade a críticas construtivas e sugestões de melhoria.','active'=>true,'created_at'=>$now,'updated_at'=>$now],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('performance_review_criteria');
    }
};
