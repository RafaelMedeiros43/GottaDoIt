<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RescheduleTasksRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'task_ids' => ['required', 'array', 'min:1', 'max:200'],
            'task_ids.*' => [
                'uuid', 'distinct',
                Rule::exists('tasks', 'id')->where('user_id', $this->user()->id)->whereNull('deleted_at'),
            ],
            'due_date' => ['required', 'date_format:Y-m-d'],
        ];
    }
}
