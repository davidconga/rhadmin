<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BiometricDevice extends Model
{
    protected $fillable = [
        'name', 'brand', 'model', 'ip_address', 'port', 'location', 'active', 'last_sync_at',
    ];

    protected function casts(): array
    {
        return [
            'active' => 'boolean',
            'port' => 'integer',
            'last_sync_at' => 'datetime',
        ];
    }
}
