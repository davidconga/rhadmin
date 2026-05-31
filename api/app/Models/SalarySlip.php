<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class SalarySlip extends Model
{
    protected $fillable = [
        'employee_id', 'month', 'year',
        'base_salary', 'food_allowance', 'transport_allowance',
        'overtime', 'other_income',
        'irt_tax', 'social_security', 'other_deductions',
        'absence_days', 'overtime_hours',
        'gross_salary', 'total_deductions', 'net_salary',
        'status', 'issued_at', 'issued_by_name', 'receipt_confirmed_at', 'receipt_signature_path',
    ];

    protected function casts(): array
    {
        return [
            'month' => 'integer',
            'year' => 'integer',
            'base_salary' => 'decimal:2',
            'food_allowance' => 'decimal:2',
            'transport_allowance' => 'decimal:2',
            'overtime' => 'decimal:2',
            'other_income' => 'decimal:2',
            'irt_tax' => 'decimal:2',
            'social_security' => 'decimal:2',
            'other_deductions' => 'decimal:2',
            'absence_days' => 'integer',
            'overtime_hours' => 'decimal:2',
            'gross_salary' => 'decimal:2',
            'total_deductions' => 'decimal:2',
            'net_salary' => 'decimal:2',
            'issued_at' => 'datetime',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function documents(): MorphMany
    {
        return $this->morphMany(Document::class, 'documentable');
    }
}
