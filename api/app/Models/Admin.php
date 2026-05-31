<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class Admin extends Model
{
    protected $connection = 'central';
    protected $table = 'admins';

    protected $fillable = ['name', 'email', 'password', 'active', 'last_login_at'];

    protected $hidden = ['password'];

    protected function casts(): array
    {
        return [
            'active'       => 'boolean',
            'last_login_at'=> 'datetime',
            'password'     => 'hashed',
        ];
    }

    public function tokens()
    {
        return $this->hasMany(AdminToken::class);
    }

    public function createToken(string $name = 'session'): string
    {
        $plain = 'sadm_' . Str::random(48);

        AdminToken::create([
            'admin_id'   => $this->id,
            'token_hash' => Hash::make($plain),
            'name'       => $name,
        ]);

        return $plain;
    }
}
