<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Contract extends Model
{
    protected $fillable = [
        'employee_id','type','title','position','department',
        'base_salary','food_allowance','transport_allowance',
        'start_date','end_date','status','notes','document_path',
        'employee_signature_path','signed_at',
    ];
    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date'   => 'date',
            'base_salary' => 'decimal:2',
            'food_allowance' => 'decimal:2',
            'transport_allowance' => 'decimal:2',
        ];
    }
    public function employee(): BelongsTo { return $this->belongsTo(Employee::class); }
}
