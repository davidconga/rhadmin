<?php

namespace App\Services;

/**
 * Cálculo do IRT (Imposto sobre o Rendimento do Trabalho) — Angola.
 *
 * Implementa a tabela progressiva fornecida na especificação RHadmin:
 *
 *   0       –  70.000  -> 0%
 *   70.001  – 100.000  -> 10% sobre o excedente de 70.000
 *   100.001 – 150.000  -> 13%
 *   150.001 – 200.000  -> 16%
 *   200.001 – 300.000  -> 18%
 *   300.001 – 500.000  -> 19%
 *   > 500.000          -> 20%
 *
 * O imposto é progressivo por escalões: cada escalão aplica a sua taxa apenas
 * à parte do rendimento que cai dentro dele, somando-se as parcelas fixas dos
 * escalões inferiores (modelo contínuo, sem "saltos" entre escalões).
 *
 * NOTA: A tabela oficial da AGT inclui parcelas fixas próprias e isenções
 * específicas. Esta implementação segue exatamente a tabela do spec e está
 * isolada aqui para fácil ajuste caso a tabela legal seja atualizada.
 */
class IrtCalculatorService
{
    /**
     * Escalões normalizados como [limite_inferior, taxa], lidos das definições
     * do tenant (Setting 'irt_brackets'), com fallback para a tabela default.
     *
     * @return array<int, array{0: float, 1: float}>
     */
    protected function brackets(): array
    {
        $stored = \App\Models\Setting::get('irt_brackets');

        $rows = collect($stored)
            ->map(fn ($b) => [(float) ($b['limit'] ?? 0), (float) ($b['rate'] ?? 0)])
            ->sortBy(fn ($b) => $b[0])
            ->values()
            ->all();

        return $rows ?: [[0, 0.0]];
    }

    /**
     * Calcula o IRT devido sobre a matéria coletável.
     */
    public function calculate(float $taxableBase): float
    {
        if ($taxableBase <= 0) {
            return 0.0;
        }

        $brackets = $this->brackets();
        $tax = 0.0;
        $count = count($brackets);

        for ($i = 0; $i < $count; $i++) {
            [$lower, $rate] = $brackets[$i];

            if ($taxableBase <= $lower) {
                break;
            }

            // Topo deste escalão = limite inferior do escalão seguinte (ou infinito).
            $upper = $brackets[$i + 1][0] ?? INF;
            $amountInBracket = min($taxableBase, $upper) - $lower;

            if ($amountInBracket > 0) {
                $tax += $amountInBracket * $rate;
            }
        }

        return round($tax, 2);
    }

    /**
     * Taxa marginal aplicável a um dado rendimento (útil para apresentação).
     */
    public function marginalRate(float $taxableBase): float
    {
        $rate = 0.0;
        foreach ($this->brackets() as [$lower, $bracketRate]) {
            if ($taxableBase > $lower) {
                $rate = $bracketRate;
            }
        }

        return $rate;
    }
}
