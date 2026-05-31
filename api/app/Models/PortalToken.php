<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class PortalToken extends Model
{
    protected $fillable = ['user_id', 'token', 'expires_at', 'used_at'];

    protected function casts(): array
    {
        return ['expires_at' => 'datetime', 'used_at' => 'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isValid(): bool
    {
        return is_null($this->used_at) && $this->expires_at->isFuture();
    }

    public static function generate(int $userId, int $hours = 48): self
    {
        // limpa tokens expirados do mesmo utilizador
        static::where('user_id', $userId)
            ->where('expires_at', '<', now())
            ->delete();

        return static::create([
            'user_id'    => $userId,
            'token'      => Str::random(48),
            'expires_at' => now()->addHours($hours),
        ]);
    }
}
