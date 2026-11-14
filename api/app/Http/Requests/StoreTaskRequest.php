<?php

namespace App\Http\Requests;

use App\Models\Task;
use Closure;

class StoreTaskRequest extends TaskRequest
{
    protected function titlePresence(): string
    {
        return 'required';
    }

    public function rules(): array
    {
        return parent::rules() + [
            // Gerado no cliente, para a interface poder mostrar e desfazer antes da resposta.
            'id' => [
                'sometimes', 'uuid',
                function (string $attribute, mixed $value, Closure $fail) {
                    if (Task::withTrashed()->whereKey($value)->exists()) {
                        $fail('Já existe uma tarefa com este identificador.');
                    }
                },
            ],
            // Atalhos do Quick Add: procura pelo nome e cria o que não existir.
            'project_name' => ['sometimes', 'nullable', 'string', 'max:120', 'prohibits:project_id'],
            'label_names' => ['sometimes', 'array', 'max:50'],
            'label_names.*' => ['string', 'max:60', 'regex:/^[\pL\pN_-]+$/u'],
        ];
    }
}
