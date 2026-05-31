<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmployeeRegistration extends Model
{
    protected $fillable = [
        'full_name','email','phone','bi_nif',
        'bi_frente_path','bi_verso_path','signature_path','password',
        'position','status','admin_notes','employee_id',
    ];
    protected $hidden = ['password'];
    public function employee(): BelongsTo { return $this->belongsTo(Employee::class); }
}
