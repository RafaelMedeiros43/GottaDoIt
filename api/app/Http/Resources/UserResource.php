<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin User */
class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'timezone' => $this->timezone,
            'week_start' => $this->week_start,
            'theme' => $this->theme,
            'notification_settings' => array_merge(
                User::DEFAULT_NOTIFICATION_SETTINGS, $this->notification_settings ?? []
            ),
        ];
    }
}
