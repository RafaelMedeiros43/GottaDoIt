<?php

namespace App\Models;

use App\Models\Concerns\BelongsToUser;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class ActivityLog extends Model
{
    use BelongsToUser, HasUuids;

    public const UPDATED_AT = null;

    protected $table = 'activity_log';

    protected $fillable = ['task_id', 'action', 'payload'];

    protected function casts(): array
    {
        return ['payload' => 'array'];
    }
}
