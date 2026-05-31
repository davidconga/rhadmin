<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class ApiKey extends Model
{
    protected $fillable = [
        'name', 'prefix', 'key_hash', 'permissions', 'active', 'last_used_at', 'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'permissions'  => 'array',
            'active'       => 'boolean',
            'last_used_at' => 'datetime',
            'expires_at'   => 'datetime',
        ];
    }

    /** Gera uma nova API key, devolve o par [modelo, plaintext]. */
    public static function generate(string $name, array $permissions = [], ?\DateTime $expiresAt = null): array
    {
        $plain  = 'rha_' . Str::random(40);
        $prefix = substr($plain, 0, 12);

        $model = self::create([
            'name'        => $name,
            'prefix'      => $prefix,
            'key_hash'    => Hash::make($plain),
            'permissions' => $permissions,
            'active'      => true,
            'expires_at'  => $expiresAt,
        ]);

        return [$model, $plain];
    }

    public function isExpired(): bool
    {
        return $this->expires_at && $this->expires_at->isPast();
    }

    /** Verifica o plaintext contra o hash. */
    public function verify(string $plain): bool
    {
        return Hash::check($plain, $this->key_hash);
    }

    public function hasPermission(string $perm): bool
    {
        if (empty($this->permissions)) return true;
        return in_array($perm, $this->permissions, true) || in_array('*', $this->permissions, true);
    }
}
