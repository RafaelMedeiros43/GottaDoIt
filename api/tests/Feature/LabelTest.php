<?php

namespace Tests\Feature;

use App\Models\Label;
use App\Models\User;
use Tests\TestCase;

class LabelTest extends TestCase
{
    public function test_creates_and_lists_labels_by_name(): void
    {
        $this->actingAsUser(User::factory()->create());

        $this->postJson('/api/v1/labels', ['name' => 'urgente', 'color' => '#ff0000'])
            ->assertCreated()
            ->assertJsonPath('data.name', 'urgente')
            ->assertJsonPath('data.color', '#ff0000');
        Label::factory()->create(['name' => 'casa']);

        $this->getJson('/api/v1/labels')->assertOk()
            ->assertJsonPath('data.0.name', 'casa')
            ->assertJsonPath('data.1.name', 'urgente');
    }

    public function test_rejects_duplicate_name_ignoring_case(): void
    {
        $this->actingAsUser(User::factory()->create());
        Label::factory()->create(['name' => 'Urgente']);

        $this->postJson('/api/v1/labels', ['name' => 'urgente'])
            ->assertStatus(422)->assertJsonValidationErrors('name');
    }

    public function test_same_name_is_allowed_for_different_users(): void
    {
        $this->actingAsUser(User::factory()->create());
        Label::factory()->create(['name' => 'casa']);

        $this->actingAsUser(User::factory()->create());

        $this->postJson('/api/v1/labels', ['name' => 'casa'])->assertCreated();
    }

    public function test_rejects_name_with_spaces(): void
    {
        $this->actingAsUser(User::factory()->create());

        $this->postJson('/api/v1/labels', ['name' => 'muito urgente'])
            ->assertStatus(422)->assertJsonValidationErrors('name');
    }
}
