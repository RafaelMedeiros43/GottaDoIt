<?php

namespace App\Models;

use App\Models\Concerns\BelongsToUser;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Project extends Model
{
    use BelongsToUser, HasFactory, HasUuids;

    protected $fillable = ['parent_id', 'name', 'color', 'icon', 'view', 'is_favorite', 'position'];

    protected $attributes = ['color' => '#808080', 'view' => 'list', 'is_favorite' => false, 'position' => 0];

    protected function casts(): array
    {
        return ['is_favorite' => 'boolean', 'position' => 'integer'];
    }
}
