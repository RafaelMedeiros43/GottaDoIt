<?php

namespace App\Http\Resources;

use App\Models\Project;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Project */
class ProjectResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'parent_id' => $this->parent_id,
            'name' => $this->name,
            'color' => $this->color,
            'icon' => $this->icon,
            'view' => $this->view,
            'is_favorite' => $this->is_favorite,
            'position' => $this->position,
        ];
    }
}
