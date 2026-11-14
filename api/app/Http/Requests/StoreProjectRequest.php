<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreProjectRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'color' => ['sometimes', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'icon' => ['sometimes', 'nullable', 'string', 'max:60'],
            'view' => ['sometimes', 'string', 'in:list,board'],
            'is_favorite' => ['sometimes', 'boolean'],
            'parent_id' => [
                'sometimes', 'nullable', 'uuid',
                Rule::exists('projects', 'id')->where('user_id', $this->user()->id),
            ],
        ];
    }
}
