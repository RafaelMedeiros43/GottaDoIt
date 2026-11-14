<?php

namespace Tests\Feature;

use App\Models\User;
use Tests\TestCase;

class AuthTest extends TestCase
{
    private function register(array $overrides = [])
    {
        return $this->postJson('/api/v1/auth/register', $overrides + [
            'name' => 'Ana', 'email' => 'ana@example.com', 'password' => 'segredo-123',
        ]);
    }

    public function test_register_returns_user_and_token(): void
    {
        $response = $this->register(['timezone' => 'America/Sao_Paulo']);

        $response->assertCreated()
            ->assertJsonPath('data.email', 'ana@example.com')
            ->assertJsonPath('data.timezone', 'America/Sao_Paulo')
            ->assertJsonPath('data.week_start', 1)
            ->assertJsonPath('data.theme', 'system')
            ->assertJsonMissingPath('data.password');
        $this->assertNotEmpty($response->json('token'));
    }

    public function test_register_defaults_timezone_to_lisbon(): void
    {
        $this->register()->assertJsonPath('data.timezone', 'Europe/Lisbon');
    }

    public function test_register_rejects_duplicate_email_ignoring_case(): void
    {
        $this->register()->assertCreated();

        $this->register(['email' => 'ANA@Example.com'])
            ->assertStatus(422)->assertJsonValidationErrors('email');
    }

    public function test_register_rejects_short_password(): void
    {
        $this->register(['password' => 'curta'])
            ->assertStatus(422)->assertJsonValidationErrors('password');
    }

    public function test_login_returns_token_that_authenticates(): void
    {
        $this->register();

        $token = $this->postJson('/api/v1/auth/login', ['email' => 'Ana@example.com', 'password' => 'segredo-123'])
            ->assertOk()->json('token');

        $this->withToken($token)->getJson('/api/v1/me')
            ->assertOk()->assertJsonPath('data.name', 'Ana');
    }

    public function test_login_with_wrong_password_is_rejected(): void
    {
        $this->register();

        $this->postJson('/api/v1/auth/login', ['email' => 'ana@example.com', 'password' => 'errada-123'])
            ->assertStatus(422)->assertJsonValidationErrors('email');
    }

    public function test_me_requires_token(): void
    {
        $this->getJson('/api/v1/me')->assertUnauthorized();
    }

    public function test_update_me_changes_preferences(): void
    {
        $this->actingAsUser(User::factory()->create());

        $this->patchJson('/api/v1/me', [
            'timezone' => 'Pacific/Auckland', 'week_start' => 0, 'theme' => 'dark',
            'notification_settings' => ['daily_digest' => true],
        ])->assertOk()
            ->assertJsonPath('data.timezone', 'Pacific/Auckland')
            ->assertJsonPath('data.week_start', 0)
            ->assertJsonPath('data.theme', 'dark')
            ->assertJsonPath('data.notification_settings.daily_digest', true)
            ->assertJsonPath('data.notification_settings.push', true);
    }

    public function test_update_me_rejects_unknown_timezone(): void
    {
        $this->actingAsUser(User::factory()->create());

        $this->patchJson('/api/v1/me', ['timezone' => 'Marte/Olimpo'])
            ->assertStatus(422)->assertJsonValidationErrors('timezone');
    }

    public function test_logout_revokes_the_token(): void
    {
        $token = $this->register()->json('token');

        $this->withToken($token)->postJson('/api/v1/auth/logout')->assertNoContent();

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/v1/me')->assertUnauthorized();
    }


    public function test_login_attempts_are_rate_limited(): void
    {
        $attempt = fn () => $this->postJson('/api/v1/auth/login', ['email' => 'ana@example.com', 'password' => 'errada-123']);

        for ($i = 0; $i < 10; $i++) {
            $attempt()->assertStatus(422);
        }

        $attempt()->assertStatus(429);
    }
}
