<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, HasUuids;

    public const DEFAULT_NOTIFICATION_SETTINGS = [
        'push' => true, 'email' => false, 'daily_digest' => false, 'daily_digest_time' => '08:00',
    ];

    protected $fillable = ['name', 'email', 'password', 'timezone', 'week_start', 'theme', 'notification_settings'];

    protected $hidden = ['password'];

    protected $attributes = ['timezone' => 'Europe/Lisbon', 'week_start' => 1, 'theme' => 'system'];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'week_start' => 'integer',
            'notification_settings' => 'array',
        ];
    }

    /** A data de "hoje" no fuso horário do utilizador. */
    public function today(): \Carbon\CarbonImmutable
    {
        return \Carbon\CarbonImmutable::now($this->timezone)->startOfDay();
    }
}
