<?php

namespace Tests\Feature;

use App\Models\Task;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class TaskCompletionTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-12-01T10:00:00Z');
        $this->actingAsUser(User::factory()->create(['timezone' => 'Europe/Lisbon']));
    }

    private function actions(Task $task): array
    {
        return DB::table('activity_log')->where('task_id', $task->id)->orderBy('created_at')->pluck('action')->all();
    }

    private function todayTitles(): array
    {
        return $this->getJson('/api/v1/tasks?view=today')->json('data.*.title');
    }

    public function test_completing_a_simple_task_removes_it_from_today(): void
    {
        $task = Task::factory()->create(['title' => 'Simples', 'due_date' => '2026-12-01']);

        $this->postJson("/api/v1/tasks/{$task->id}/complete")->assertOk()
            ->assertJsonPath('data.is_completed', true)
            ->assertJsonPath('meta.recurred', false);

        $this->assertNotNull($task->fresh()->completed_at);
        $this->assertSame([], $this->todayTitles());
        $this->assertSame(['completed'], $this->actions($task));
    }

    public function test_completing_twice_logs_once(): void
    {
        $task = Task::factory()->create(['due_date' => '2026-12-01']);

        $this->postJson("/api/v1/tasks/{$task->id}/complete")->assertOk();
        $this->postJson("/api/v1/tasks/{$task->id}/complete")->assertOk()->assertJsonPath('data.is_completed', true);

        $this->assertSame(['completed'], $this->actions($task));
    }

    public function test_reopening_a_simple_task_shows_it_again(): void
    {
        $task = Task::factory()->create(['title' => 'Simples', 'due_date' => '2026-12-01']);
        $this->postJson("/api/v1/tasks/{$task->id}/complete");

        $this->postJson("/api/v1/tasks/{$task->id}/reopen")->assertOk()
            ->assertJsonPath('data.is_completed', false)
            ->assertJsonPath('data.completed_at', null);

        $this->assertSame(['Simples'], $this->todayTitles());
        $this->assertSame(['completed', 'reopened'], $this->actions($task));
    }

    public function test_reopening_an_open_task_changes_nothing(): void
    {
        $task = Task::factory()->create(['due_date' => '2026-12-01']);

        $this->postJson("/api/v1/tasks/{$task->id}/reopen")->assertOk()->assertJsonPath('data.is_completed', false);

        $this->assertSame([], $this->actions($task));
    }

    public function test_completing_a_recurring_task_schedules_the_next_occurrence(): void
    {
        $task = Task::factory()->create([
            'title' => 'Pagar renda', 'due_date' => '2026-12-01', 'due_time' => '09:00',
            'recurrence_rule' => 'FREQ=MONTHLY;BYMONTHDAY=1',
        ]);

        $this->postJson("/api/v1/tasks/{$task->id}/complete")->assertOk()
            ->assertJsonPath('data.is_completed', false)
            ->assertJsonPath('data.due_date', '2027-01-01')
            ->assertJsonPath('data.due_time', '09:00')
            ->assertJsonPath('meta.recurred', true);

        $log = DB::table('activity_log')->where('task_id', $task->id)->where('action', 'completed')->sole();
        $this->assertEquals(
            ['occurrence_date' => '2026-12-01', 'previous_due_date' => '2026-12-01', 'next_due_date' => '2027-01-01'],
            json_decode($log->payload, true)
        );
        $this->assertSame([], $this->todayTitles());
    }

    public function test_overdue_recurring_task_jumps_to_the_next_future_occurrence(): void
    {
        $task = Task::factory()->create(['due_date' => '2026-11-20', 'recurrence_rule' => 'FREQ=DAILY;INTERVAL=2']);

        $this->postJson("/api/v1/tasks/{$task->id}/complete")->assertJsonPath('data.due_date', '2026-12-02');
    }

    public function test_recurrence_uses_the_users_today(): void
    {
        // 23:30 UTC de dia 1 já é dia 2 em Auckland.
        $this->travelTo('2026-12-01T23:30:00Z');
        $this->actingAsUser(User::factory()->create(['timezone' => 'Pacific/Auckland']));
        $task = Task::factory()->create(['due_date' => '2026-11-28', 'recurrence_rule' => 'FREQ=DAILY']);

        $this->postJson("/api/v1/tasks/{$task->id}/complete")->assertJsonPath('data.due_date', '2026-12-02');
    }

    public function test_reopening_a_recurring_task_restores_the_previous_date_once(): void
    {
        $task = Task::factory()->create(['due_date' => '2026-12-01', 'recurrence_rule' => 'FREQ=MONTHLY;BYMONTHDAY=1']);
        $this->postJson("/api/v1/tasks/{$task->id}/complete");

        $this->postJson("/api/v1/tasks/{$task->id}/reopen")->assertOk()->assertJsonPath('data.due_date', '2026-12-01');
        $this->postJson("/api/v1/tasks/{$task->id}/reopen")->assertOk()->assertJsonPath('data.due_date', '2026-12-01');

        $this->assertSame(['completed', 'reopened'], $this->actions($task));
    }

    public function test_history_survives_several_recurrences(): void
    {
        $task = Task::factory()->create(['due_date' => '2026-12-01', 'recurrence_rule' => 'FREQ=DAILY']);

        $this->postJson("/api/v1/tasks/{$task->id}/complete");
        $this->postJson("/api/v1/tasks/{$task->id}/complete")->assertJsonPath('data.due_date', '2026-12-03');

        $dates = DB::table('activity_log')->where('task_id', $task->id)->orderBy('created_at')
            ->get()->map(fn ($row) => json_decode($row->payload, true)['occurrence_date'])->all();
        $this->assertSame(['2026-12-01', '2026-12-02'], $dates);
    }

    public function test_other_users_tasks_are_not_found(): void
    {
        $task = Task::factory()->create();
        $this->actingAsUser(User::factory()->create());

        $this->postJson("/api/v1/tasks/{$task->id}/complete")->assertNotFound();
        $this->postJson("/api/v1/tasks/{$task->id}/reopen")->assertNotFound();
    }
}
