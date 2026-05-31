<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Position extends Model
{
    protected $fillable = ['name', 'code', 'department', 'description', 'active'];

    protected function casts(): array
    {
        return ['active' => 'boolean'];
    }
}
