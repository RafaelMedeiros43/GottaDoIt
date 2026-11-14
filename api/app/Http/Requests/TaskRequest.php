<?php

namespace App\Http\Requests;

use App\Models\Task;
use App\Support\Recurrence;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/** Regras comuns a criar e editar tarefas. */
abstract class TaskRequest extends FormRequest
{
    /** A tarefa que está a ser editada, ou null ao criar. */
    protected function task(): ?Task
    {
        return null;
    }

    /** `required` ao criar, `sometimes` ao editar. */
    abstract protected function titlePresence(): string;

    public function rules(): array
    {
        $owned = fn (string $table) => Rule::exists($table, 'id')->where('user_id', $this->user()->id);

        return [
            'title' => [$this->titlePresence(), 'string', 'max:500'],
            'description' => ['sometimes', 'nullable', 'string', 'max:20000'],
            'due_date' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'due_time' => ['sometimes', 'nullable', 'date_format:H:i'],
            'recurrence_rule' => [
                'sometimes', 'nullable', 'string', 'max:200',
                function (string $attribute, mixed $value, Closure $fail) {
                    if (! Recurrence::isValid((string) $value)) {
                        $fail('A regra de recorrência não é válida.');
                    }
                },
            ],
            'recurrence_text' => ['sometimes', 'nullable', 'string', 'max:120'],
            'priority' => ['sometimes', 'integer', 'between:1,4'],
            'project_id' => ['sometimes', 'nullable', 'uuid', $owned('projects')],
            'section_id' => ['sometimes', 'nullable', 'uuid', $owned('sections')],
            'parent_task_id' => ['sometimes', 'nullable', 'uuid', $owned('tasks')->whereNull('deleted_at')],
            'label_ids' => ['sometimes', 'array', 'max:50'],
            'label_ids.*' => ['uuid', 'distinct', $owned('labels')],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            // Ao editar, o que não vem no pedido mantém o valor atual da tarefa.
            $effective = fn (string $key) => $this->has($key) ? $this->input($key) : $this->task()?->getAttribute($key);

            if ($effective('due_date') === null) {
                if ($effective('due_time') !== null) {
                    $validator->errors()->add('due_time', 'Uma hora precisa de uma data.');
                }
                if ($effective('recurrence_rule') !== null) {
                    $validator->errors()->add('recurrence_rule', 'Uma tarefa recorrente precisa de uma data.');
                }
            }

            if ($this->filled('section_id')) {
                $sectionProject = DB::table('sections')->where('id', $this->input('section_id'))->value('project_id');
                if ($this->has('project_name') || $sectionProject !== $effective('project_id')) {
                    $validator->errors()->add('section_id', 'A secção não pertence ao projeto da tarefa.');
                }
            }

            if ($this->task() && $this->input('parent_task_id') === $this->task()->id) {
                $validator->errors()->add('parent_task_id', 'Uma tarefa não pode ser subtarefa de si própria.');
            }
        }];
    }
}
