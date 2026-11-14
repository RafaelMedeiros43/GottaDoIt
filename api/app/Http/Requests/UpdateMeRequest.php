<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateMeRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:120'],
            'timezone' => ['sometimes', 'string', 'timezone:all'],
            'week_start' => ['sometimes', 'integer', 'in:0,1'],
            'theme' => ['sometimes', 'string', 'in:system,light,dark'],
            'notification_settings' => ['sometimes', 'array'],
            'notification_settings.push' => ['sometimes', 'boolean'],
            'notification_settings.email' => ['sometimes', 'boolean'],
            'notification_settings.daily_digest' => ['sometimes', 'boolean'],
            'notification_settings.daily_digest_time' => ['sometimes', 'date_format:H:i'],
        ];
    }
}
