<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CareerEvent extends Model
{
    protected $fillable = [
        'employee_id', 'type', 'title',
        'from_position', 'to_position',
        'from_department', 'to_department',
        'from_salary', 'to_salary',
        'effective_date', 'description',
    ];

    protected function casts(): array
    {
        return [
            'effective_date' => 'date',
            'from_salary'    => 'decimal:2',
            'to_salary'      => 'decimal:2',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }
}
