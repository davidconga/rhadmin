<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PerformanceReviewCriterion extends Model
{
    protected $fillable = ['name', 'category', 'weight', 'description', 'active'];

    protected function casts(): array
    {
        return ['weight' => 'decimal:2', 'active' => 'boolean'];
    }

    public function scores(): HasMany
    {
        return $this->hasMany(PerformanceReviewScore::class, 'criterion_id');
    }
}
