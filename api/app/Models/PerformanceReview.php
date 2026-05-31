<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PerformanceReview extends Model
{
    protected $fillable = [
        'employee_id', 'reviewer_id', 'period_year', 'period_type',
        'period_number', 'status', 'method', 'overall_score',
        'reviewer_comments', 'employee_comments', 'conducted_at',
    ];

    protected function casts(): array
    {
        return [
            'overall_score' => 'decimal:2',
            'conducted_at'  => 'datetime',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewer_id');
    }

    public function scores(): HasMany
    {
        return $this->hasMany(PerformanceReviewScore::class, 'review_id');
    }

    /** Recalcula a nota global ponderada a partir dos scores. */
    public function recalcOverallScore(): void
    {
        $scores = $this->scores()->with('criterion')->get();
        if ($scores->isEmpty()) return;

        $totalWeight = $scores->sum(fn ($s) => $s->criterion->weight);
        if ($totalWeight == 0) return;

        $weighted = $scores->sum(fn ($s) => $s->score * $s->criterion->weight);
        // normaliza para escala 1-5
        $this->update(['overall_score' => round($weighted / $totalWeight, 2)]);
    }

    public function periodLabel(): string
    {
        return match ($this->period_type) {
            'annual'      => "Anual {$this->period_year}",
            'semi_annual' => "S{$this->period_number} {$this->period_year}",
            'quarterly'   => "Q{$this->period_number} {$this->period_year}",
            default       => "{$this->period_year}",
        };
    }
}
