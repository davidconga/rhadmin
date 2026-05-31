<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VacationBalance extends Model
{
    protected $fillable = [
        'employee_id', 'year', 'entitled_days', 'carried_over', 'used_days', 'extra_days',
    ];

    protected function casts(): array
    {
        return [
            'year' => 'integer',
            'entitled_days' => 'integer',
            'carried_over' => 'integer',
            'used_days' => 'integer',
            'extra_days' => 'integer',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    /** Total de dias disponíveis (direito + transitados + extra). */
    public function totalDays(): int
    {
        return $this->entitled_days + $this->carried_over + $this->extra_days;
    }

    /** Dias restantes. */
    public function remainingDays(): int
    {
        return max(0, $this->totalDays() - $this->used_days);
    }
}
