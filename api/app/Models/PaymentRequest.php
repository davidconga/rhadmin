<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PaymentRequest extends Model
{
    protected $connection = 'central';
    protected $table      = 'payment_requests';

    protected $fillable = [
        'tenant_id', 'plan_id', 'reference', 'amount', 'discount',
        'status', 'proof_path', 'notes', 'reviewed_at', 'contact_phone',
        'fr_number', 'fr_path',
    ];

    protected function casts(): array
    {
        return ['reviewed_at' => 'datetime'];
    }

    public function tenant(): BelongsTo { return $this->belongsTo(Tenant::class); }
    public function plan(): BelongsTo   { return $this->belongsTo(Plan::class); }
}
