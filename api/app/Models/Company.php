<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Company extends Model
{
    protected $fillable = [
        'name', 'nif', 'address', 'phone', 'email',
        'bank_name', 'account_number', 'iban', 'logo_path', 'signature_path',
        'default_debit_account', 'currency', 'active',
    ];

    protected function casts(): array
    {
        return ['active' => 'boolean'];
    }

    public function employees(): HasMany
    {
        return $this->hasMany(Employee::class);
    }
}
