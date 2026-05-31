<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Shift extends Model
{
    protected $fillable = [
        'name', 'code', 'type', 'start_time', 'end_time',
        'duration_hours', 'crosses_midnight', 'color',
        'counts_as_worked', 'active', 'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'crosses_midnight' => 'boolean',
            'counts_as_worked' => 'boolean',
            'active' => 'boolean',
            'duration_hours' => 'integer',
            'sort_order' => 'integer',
        ];
    }

    public function schedules(): HasMany
    {
        return $this->hasMany(ShiftSchedule::class);
    }

    public function scopeActive($query)
    {
        return $query->where('active', true);
    }
}
