<?php

namespace App\Models;

use App\Models\Concerns\BelongsToUser;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Task extends Model
{
    use BelongsToUser, HasFactory, HasUuids, SoftDeletes;

    protected $fillable = [
        'id', 'title', 'description', 'due_date', 'due_time', 'recurrence_rule', 'recurrence_text',
        'priority', 'project_id', 'section_id', 'parent_task_id', 'position',
    ];

    protected $attributes = ['priority' => 4, 'is_completed' => false, 'position' => 0];

    protected function casts(): array
    {
        return [
            'due_date' => 'immutable_date',
            'priority' => 'integer',
            'position' => 'integer',
            'is_completed' => 'boolean',
            'completed_at' => 'immutable_datetime',
        ];
    }

    public function labels(): BelongsToMany
    {
        return $this->belongsToMany(Label::class, 'task_labels');
    }

    public function scopeOpen(Builder $query): void
    {
        $query->where('is_completed', false);
    }

    public function isRecurring(): bool
    {
        return $this->recurrence_rule !== null;
    }

    /** Hora de vencimento como "HH:MM" (a base de dados devolve "HH:MM:SS"). */
    public function dueTimeShort(): ?string
    {
        return $this->due_time === null ? null : substr($this->due_time, 0, 5);
    }
}
