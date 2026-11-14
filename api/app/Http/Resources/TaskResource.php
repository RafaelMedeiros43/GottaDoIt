<?php

namespace App\Http\Resources;

use App\Models\Task;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Task */
class TaskResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'description' => $this->description,
            'due_date' => $this->due_date?->toDateString(),
            'due_time' => $this->dueTimeShort(),
            'recurrence_rule' => $this->recurrence_rule,
            'recurrence_text' => $this->recurrence_text,
            'priority' => $this->priority,
            'is_completed' => $this->is_completed,
            'completed_at' => $this->completed_at?->toIso8601String(),
            'position' => $this->position,
            'project_id' => $this->project_id,
            'section_id' => $this->section_id,
            'parent_task_id' => $this->parent_task_id,
            'label_ids' => $this->labels->pluck('id')->all(),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
