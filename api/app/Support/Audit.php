<?php

namespace App\Support;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Request;

class Audit
{
    /**
     * Regista uma ação de auditoria no tenant atual.
     */
    public static function log(string $action, ?Model $model = null, ?array $old = null): void
    {
        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => $action,
            'model_type' => $model ? class_basename($model) : null,
            'model_id' => $model?->getKey(),
            'old_values' => $old,
            'new_values' => $model?->getAttributes(),
            'ip_address' => Request::ip(),
        ]);
    }
}
