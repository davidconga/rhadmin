<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Attendance extends Model
{
    public const STATUSES = ['present', 'late', 'absent', 'justified', 'vacation', 'sick', 'holiday'];

    /** Estados que contam como dia efetivamente trabalhado/presente. */
    public const PRESENT_STATUSES = ['present', 'late'];

    protected $fillable = [
        'employee_id', 'date', 'status', 'check_in', 'check_out', 'worked_hours', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date:Y-m-d',
            'worked_hours' => 'decimal:2',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    /** Calcula horas trabalhadas a partir de check_in/check_out (HH:MM). */
    public static function computeHours(?string $in, ?string $out): ?float
    {
        if (! $in || ! $out) {
            return null;
        }
        [$ih, $im] = array_map('intval', explode(':', $in) + [1 => 0]);
        [$oh, $om] = array_map('intval', explode(':', $out) + [1 => 0]);
        $minutes = ($oh * 60 + $om) - ($ih * 60 + $im);

        return $minutes > 0 ? round($minutes / 60, 2) : 0.0;
    }
}
