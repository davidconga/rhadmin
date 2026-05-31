<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Employee extends Model
{
    protected $fillable = [
        'company_id', 'user_id', 'full_name', 'email', 'phone',
        'bi_nif', 'biometric_id', 'photo_path', 'signature_path',
        'position', 'department',
        'bank_name', 'account_number', 'iban',
        'base_salary', 'food_allowance', 'transport_allowance',
        'social_security_rate', 'active',
    ];

    protected function casts(): array
    {
        return [
            'base_salary' => 'decimal:2',
            'food_allowance' => 'decimal:2',
            'transport_allowance' => 'decimal:2',
            'social_security_rate' => 'decimal:2',
            'active' => 'boolean',
        ];
    }

    public function salarySlips(): HasMany
    {
        return $this->hasMany(SalarySlip::class);
    }

    public function familyMembers(): HasMany
    {
        return $this->hasMany(FamilyMember::class);
    }

    public function contracts(): HasMany
    {
        return $this->hasMany(Contract::class);
    }

    public function user(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function performanceReviews(): HasMany
    {
        return $this->hasMany(PerformanceReview::class);
    }

    public function careerEvents(): HasMany
    {
        return $this->hasMany(CareerEvent::class);
    }
}
