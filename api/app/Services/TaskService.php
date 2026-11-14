<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\Label;
use App\Models\Project;
use App\Models\Task;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/** Escritas sobre tarefas. Cada escrita deixa uma linha no registo de atividade. */
class TaskService
{
    private const TRACKED = [
        'title', 'description', 'due_date', 'due_time', 'recurrence_rule', 'recurrence_text',
        'priority', 'project_id', 'section_id', 'parent_task_id',
    ];

    public function create(array $data): Task
    {
        if (filled($data['project_name'] ?? null)) {
            $data['project_id'] = $this->findOrCreateProject($data['project_name'])->id;
        }

        $labelIds = array_merge(
            $data['label_ids'] ?? [],
            $this->findOrCreateLabels($data['label_names'] ?? [])
        );

        $attributes = Arr::only($data, ['id', ...self::TRACKED]);
        $attributes['position'] = (Task::where('project_id', $attributes['project_id'] ?? null)
            ->where('parent_task_id', $attributes['parent_task_id'] ?? null)
            ->max('position') ?? 0) + 1;

        try {
            $task = Task::create($attributes);
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages(['id' => 'Já existe uma tarefa com este identificador.']);
        }

        $this->syncLabels($task, $labelIds);
        $this->log($task, 'created', ['title' => $task->title]);

        return $task->load('labels');
    }

    public function update(Task $task, array $data): Task
    {
        $before = $this->snapshot($task);

        // Mudar de projeto sem indicar secção tira a tarefa da secção antiga.
        if (array_key_exists('project_id', $data) && $data['project_id'] !== $task->project_id) {
            $data['section_id'] ??= null;
        }

        $task->fill(Arr::only($data, self::TRACKED))->save();

        if (array_key_exists('label_ids', $data)) {
            $this->syncLabels($task, $data['label_ids']);
        }

        $after = $this->snapshot($task->refresh());
        $changes = [];
        foreach ($after as $field => $value) {
            if ($before[$field] !== $value) {
                $changes[$field] = [$before[$field], $value];
            }
        }

        if ($changes !== []) {
            $this->log($task, 'updated', ['changes' => $changes]);
        }

        return $task;
    }

    public function delete(Task $task): void
    {
        $task->delete();
        $this->log($task, 'deleted');
    }

    public function restore(Task $task): Task
    {
        if ($task->trashed()) {
            $task->restore();
            $this->log($task, 'restored');
        }

        return $task->load('labels');
    }

    /** @param string[] $taskIds */
    public function reschedule(array $taskIds, string $dueDate): Collection
    {
        $tasks = Task::with('labels')->whereKey($taskIds)->get();

        foreach ($tasks as $task) {
            $previous = $task->due_date?->toDateString();
            if ($previous === $dueDate) {
                continue;
            }

            $task->update(['due_date' => $dueDate]);
            $this->log($task, 'rescheduled', ['previous_due_date' => $previous, 'due_date' => $dueDate]);
        }

        return $tasks;
    }

    public function log(Task $task, string $action, array $payload = []): ActivityLog
    {
        return ActivityLog::create(['task_id' => $task->id, 'action' => $action, 'payload' => $payload]);
    }

    private function snapshot(Task $task): array
    {
        $labelIds = $task->labels()->pluck('labels.id')->sort()->values()->all();

        return [
            'title' => $task->title,
            'description' => $task->description,
            'due_date' => $task->due_date?->toDateString(),
            'due_time' => $task->dueTimeShort(),
            'recurrence_rule' => $task->recurrence_rule,
            'recurrence_text' => $task->recurrence_text,
            'priority' => $task->priority,
            'project_id' => $task->project_id,
            'section_id' => $task->section_id,
            'parent_task_id' => $task->parent_task_id,
            'label_ids' => $labelIds,
        ];
    }

    /** @param string[] $labelIds */
    private function syncLabels(Task $task, array $labelIds): void
    {
        $task->labels()->syncWithPivotValues(array_values(array_unique($labelIds)), ['user_id' => $task->user_id]);
        $task->unsetRelation('labels');
    }

    private function findOrCreateProject(string $name): Project
    {
        return Project::whereRaw('lower(name) = ?', [mb_strtolower($name)])->orderBy('position')->first()
            ?? Project::create(['name' => $name, 'position' => (Project::max('position') ?? 0) + 1]);
    }

    /**
     * @param  string[]  $names
     * @return string[] ids das etiquetas
     */
    private function findOrCreateLabels(array $names): array
    {
        return collect($names)
            ->unique(fn (string $name) => mb_strtolower($name))
            ->map(fn (string $name) => (
                Label::whereRaw('lower(name) = ?', [mb_strtolower($name)])->first() ?? Label::create(['name' => $name])
            )->id)
            ->all();
    }
}
