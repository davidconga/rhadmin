<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FamilyMember extends Model
{
    protected $fillable = ['employee_id','full_name','relationship','bi_nif','date_of_birth'];
    protected function casts(): array { return ['date_of_birth' => 'date']; }
    public function employee(): BelongsTo { return $this->belongsTo(Employee::class); }
}
