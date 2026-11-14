<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;
use Tests\TestCase;

class ProjectTest extends TestCase
{
    public function test_creates_project_with_defaults_and_next_position(): void
    {
        $this->actingAsUser(User::factory()->create());
        Project::factory()->create(['position' => 3]);

        $this->postJson('/api/v1/projects', ['name' => 'Trabalho'])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Trabalho')
            ->assertJsonPath('data.color', '#808080')
            ->assertJsonPath('data.view', 'list')
            ->assertJsonPath('data.is_favorite', false)
            ->assertJsonPath('data.parent_id', null)
            ->assertJsonPath('data.position', 4);
    }

    public function test_lists_projects_by_position(): void
    {
        $this->actingAsUser(User::factory()->create());
        Project::factory()->create(['name' => 'B', 'position' => 2]);
        Project::factory()->create(['name' => 'A', 'position' => 1]);

        $this->getJson('/api/v1/projects')->assertOk()
            ->assertJsonPath('data.0.name', 'A')
            ->assertJsonPath('data.1.name', 'B');
    }

    public function test_list_excludes_projects_of_other_users(): void
    {
        $this->actingAsUser(User::factory()->create());
        Project::factory()->create(['name' => 'Da Ana']);

        $this->actingAsUser(User::factory()->create());
        Project::factory()->create(['name' => 'Do Bruno']);

        $this->getJson('/api/v1/projects')->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Do Bruno');
    }

    public function test_rejects_invalid_color(): void
    {
        $this->actingAsUser(User::factory()->create());

        $this->postJson('/api/v1/projects', ['name' => 'X', 'color' => 'vermelho'])
            ->assertStatus(422)->assertJsonValidationErrors('color');
    }

    public function test_rejects_parent_of_another_user(): void
    {
        $this->actingAsUser(User::factory()->create());
        $foreign = Project::factory()->create();

        $this->actingAsUser(User::factory()->create());

        $this->postJson('/api/v1/projects', ['name' => 'Sub', 'parent_id' => $foreign->id])
            ->assertStatus(422)->assertJsonValidationErrors('parent_id');
    }

    public function test_creates_sub_project(): void
    {
        $this->actingAsUser(User::factory()->create());
        $parent = Project::factory()->create();

        $this->postJson('/api/v1/projects', ['name' => 'Sub', 'parent_id' => $parent->id])
            ->assertCreated()->assertJsonPath('data.parent_id', $parent->id);
    }
}
