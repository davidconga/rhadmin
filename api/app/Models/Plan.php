<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Plan extends Model
{
    protected $connection = 'central';

    protected $fillable = [
        'slug', 'name', 'description', 'price_aoa',
        'max_companies', 'max_employees', 'max_users',
        'features', 'feature_keys', 'active', 'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'features'     => 'array',
            'feature_keys' => 'array',
            'active'       => 'boolean',
        ];
    }

    public function tenants(): HasMany
    {
        return $this->hasMany(Tenant::class);
    }
}
