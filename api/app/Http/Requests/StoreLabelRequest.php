<?php

namespace App\Http\Requests;

use App\Models\Label;
use Closure;
use Illuminate\Foundation\Http\FormRequest;

class StoreLabelRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'name' => [
                'required', 'string', 'max:60', 'regex:/^[\pL\pN_-]+$/u',
                function (string $attribute, mixed $value, Closure $fail) {
                    if (Label::whereRaw('lower(name) = ?', [mb_strtolower((string) $value)])->exists()) {
                        $fail('Já tens uma etiqueta com este nome.');
                    }
                },
            ],
            'color' => ['sometimes', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
        ];
    }
}
