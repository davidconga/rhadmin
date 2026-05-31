<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AdminToken extends Model
{
    protected $connection = 'central';
    protected $table = 'admin_tokens';

    protected $fillable = ['admin_id', 'token_hash', 'name', 'expires_at'];

    protected function casts(): array
    {
        return ['expires_at' => 'datetime'];
    }

    public function admin()
    {
        return $this->belongsTo(Admin::class);
    }
}
