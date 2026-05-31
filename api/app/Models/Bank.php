<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Bank extends Model
{
    protected $fillable = ['name', 'code', 'bic', 'active'];

    protected function casts(): array
    {
        return ['active' => 'boolean'];
    }
}
