<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PerformanceReviewScore extends Model
{
    protected $fillable = ['review_id', 'criterion_id', 'score', 'comment'];

    public function review(): BelongsTo
    {
        return $this->belongsTo(PerformanceReview::class);
    }

    public function criterion(): BelongsTo
    {
        return $this->belongsTo(PerformanceReviewCriterion::class, 'criterion_id');
    }
}
