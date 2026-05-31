<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Registry entry stored in the central database. Each tenant maps to an
 * isolated SQLite file under storage/databases/{slug}.sqlite.
 */
class Tenant extends Model
{
    protected $connection = 'central';

    protected $fillable = [
        'name', 'slug', 'subdomain', 'database_path', 'active',
        'plan_id', 'subscription_status', 'trial_ends_at', 'subscribed_at',
        'nif', 'address', 'email',
    ];

    protected function casts(): array
    {
        return [
            'active'        => 'boolean',
            'trial_ends_at' => 'datetime',
            'subscribed_at' => 'datetime',
        ];
    }

    public function plan()
    {
        return $this->belongsTo(Plan::class);
    }
}
