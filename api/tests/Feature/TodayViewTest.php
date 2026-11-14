<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Tests\TestCase;

class TodayViewTest extends TestCase
{
    private function actingInTimezone(string $timezone): void
    {
        $this->actingAsUser(User::factory()->create(['timezone' => $timezone]));
    }

    public function test_today_is_ahead_of_utc_for_auckland(): void
    {
        $this->travelTo('2026-11-14T12:00:00Z');
        $this->actingInTimezone('Pacific/Auckland');
        Task::factory()->create(['title' => 'Dia 15', 'due_date' => '2026-11-15']);
        Task::factory()->create(['title' => 'Dia 16', 'due_date' => '2026-11-16']);

        $this->getJson('/api/v1/tasks?view=today')->assertOk()
            ->assertJsonPath('meta.today', '2026-11-15')
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'Dia 15');
    }

    public function test_today_is_behind_utc_for_los_angeles(): void
    {
        $this->travelTo('2026-11-14T03:00:00Z');
        $this->actingInTimezone('America/Los_Angeles');
        Task::factory()->create(['title' => 'Dia 13', 'due_date' => '2026-11-13']);
        Task::factory()->create(['title' => 'Dia 14', 'due_date' => '2026-11-14']);

        $this->getJson('/api/v1/tasks?view=today')->assertOk()
            ->assertJsonPath('meta.today', '2026-11-13')
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'Dia 13');
    }

    public function test_today_includes_overdue_and_excludes_completed_deleted_and_undated(): void
    {
        $this->travelTo('2026-11-14T12:00:00Z');
        $this->actingInTimezone('Europe/Lisbon');
        Task::factory()->create(['title' => 'Atrasada', 'due_date' => '2026-11-10']);
        Task::factory()->create(['title' => 'Hoje', 'due_date' => '2026-11-14']);
        Task::factory()->create(['title' => 'Concluída', 'due_date' => '2026-11-14', 'is_completed' => true, 'completed_at' => now()]);
        Task::factory()->create(['title' => 'Apagada', 'due_date' => '2026-11-14'])->delete();
        Task::factory()->create(['title' => 'Sem data']);

        $titles = $this->getJson('/api/v1/tasks?view=today')->assertOk()->json('data.*.title');

        $this->assertSame(['Atrasada', 'Hoje'], $titles);
    }

    public function test_today_orders_by_date_time_priority_position(): void
    {
        $this->travelTo('2026-11-14T12:00:00Z');
        $this->actingInTimezone('Europe/Lisbon');
        Task::factory()->create(['title' => 'sem hora p1', 'due_date' => '2026-11-14', 'priority' => 1]);
        Task::factory()->create(['title' => '9h p4', 'due_date' => '2026-11-14', 'due_time' => '09:00', 'priority' => 4]);
        Task::factory()->create(['title' => '9h p1', 'due_date' => '2026-11-14', 'due_time' => '09:00', 'priority' => 1]);
        Task::factory()->create(['title' => '8h', 'due_date' => '2026-11-14', 'due_time' => '08:00']);
        Task::factory()->create(['title' => 'ontem', 'due_date' => '2026-11-13']);
        Task::factory()->create(['title' => 'sem hora p1 depois', 'due_date' => '2026-11-14', 'priority' => 1, 'position' => 9]);

        $titles = $this->getJson('/api/v1/tasks?view=today')->json('data.*.title');

        $this->assertSame(['ontem', '8h', '9h p1', '9h p4', 'sem hora p1', 'sem hora p1 depois'], $titles);
    }

    public function test_inbox_lists_open_tasks_without_project(): void
    {
        $this->actingInTimezone('Europe/Lisbon');
        $project = Project::factory()->create();
        $parent = Task::factory()->create(['title' => 'Triagem', 'position' => 2]);
        Task::factory()->create(['title' => 'Primeira', 'position' => 1]);
        Task::factory()->create(['title' => 'Com projeto', 'project_id' => $project->id]);
        Task::factory()->create(['title' => 'Subtarefa', 'parent_task_id' => $parent->id]);
        Task::factory()->create(['title' => 'Feita', 'is_completed' => true]);

        $titles = $this->getJson('/api/v1/tasks?view=inbox')->assertOk()->json('data.*.title');

        $this->assertSame(['Primeira', 'Triagem'], $titles);
    }

    public function test_view_is_required_and_must_be_known(): void
    {
        $this->actingInTimezone('Europe/Lisbon');

        $this->getJson('/api/v1/tasks')->assertStatus(422)->assertJsonValidationErrors('view');
        $this->getJson('/api/v1/tasks?view=tudo')->assertStatus(422)->assertJsonValidationErrors('view');
    }

    public function test_today_never_shows_other_users_tasks(): void
    {
        $this->travelTo('2026-11-14T12:00:00Z');
        $this->actingInTimezone('Europe/Lisbon');
        Task::factory()->create(['due_date' => '2026-11-14']);

        $this->actingInTimezone('Europe/Lisbon');

        $this->getJson('/api/v1/tasks?view=today')->assertOk()->assertJsonCount(0, 'data');
    }
}
