<?php

namespace Tests\Feature;

use App\Models\Label;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class TaskCrudTest extends TestCase
{
    private User $ana;

    protected function setUp(): void
    {
        parent::setUp();
        $this->ana = User::factory()->create();
        $this->actingAsUser($this->ana);
    }

    /** Cria dados de outro utilizador e volta ao contexto da Ana. */
    private function asOtherUser(callable $callback): mixed
    {
        $this->actingAsUser(User::factory()->create());
        $result = $callback();
        $this->actingAsUser($this->ana);

        return $result;
    }

    private function lastActivity(string $taskId): object
    {
        return DB::table('activity_log')->where('task_id', $taskId)->orderByDesc('created_at')->orderByDesc('id')->first();
    }

    public function test_creates_task_with_all_fields(): void
    {
        $project = Project::factory()->create();
        $label = Label::factory()->create();

        $response = $this->postJson('/api/v1/tasks', [
            'title' => 'Pagar renda', 'description' => '**Transferência**', 'due_date' => '2026-12-01',
            'due_time' => '09:30', 'recurrence_rule' => 'FREQ=MONTHLY;BYMONTHDAY=1', 'recurrence_text' => 'todo dia 1',
            'priority' => 1, 'project_id' => $project->id, 'label_ids' => [$label->id],
        ]);

        $response->assertCreated()->assertJson(['data' => [
            'title' => 'Pagar renda', 'description' => '**Transferência**', 'due_date' => '2026-12-01',
            'due_time' => '09:30', 'recurrence_rule' => 'FREQ=MONTHLY;BYMONTHDAY=1', 'recurrence_text' => 'todo dia 1',
            'priority' => 1, 'is_completed' => false, 'completed_at' => null, 'project_id' => $project->id,
            'section_id' => null, 'parent_task_id' => null, 'label_ids' => [$label->id],
        ]]);
        $this->assertSame('created', $this->lastActivity($response->json('data.id'))->action);
    }

    public function test_creates_minimal_task_with_defaults(): void
    {
        $this->postJson('/api/v1/tasks', ['title' => '  Ligar ao João  '])
            ->assertCreated()
            ->assertJsonPath('data.title', 'Ligar ao João')
            ->assertJsonPath('data.priority', 4)
            ->assertJsonPath('data.due_date', null)
            ->assertJsonPath('data.project_id', null)
            ->assertJsonPath('data.label_ids', []);
    }

    public function test_accepts_client_generated_id(): void
    {
        $id = (string) Str::uuid();

        $this->postJson('/api/v1/tasks', ['id' => $id, 'title' => 'X'])
            ->assertCreated()->assertJsonPath('data.id', $id);
    }

    public function test_reusing_an_id_is_a_validation_error(): void
    {
        $task = Task::factory()->create();

        $this->postJson('/api/v1/tasks', ['id' => $task->id, 'title' => 'X'])
            ->assertStatus(422)->assertJsonValidationErrors('id');
    }

    public function test_position_follows_last_task_of_same_list(): void
    {
        Task::factory()->create(['position' => 5]);

        $this->postJson('/api/v1/tasks', ['title' => 'X'])->assertJsonPath('data.position', 6);
    }

    public function test_project_and_label_names_reuse_or_create(): void
    {
        $casa = Project::factory()->create(['name' => 'Casa']);
        $urgente = Label::factory()->create(['name' => 'Urgente']);

        $response = $this->postJson('/api/v1/tasks', [
            'title' => 'X', 'project_name' => 'casa', 'label_names' => ['urgente', 'novo'],
        ])->assertCreated()->assertJsonPath('data.project_id', $casa->id);

        $this->assertSame(1, Project::count());
        $this->assertSame(2, Label::count());
        $novo = Label::where('name', 'novo')->firstOrFail();
        $this->assertEqualsCanonicalizing([$urgente->id, $novo->id], $response->json('data.label_ids'));
    }

    public function test_unknown_project_name_creates_the_project(): void
    {
        $response = $this->postJson('/api/v1/tasks', ['title' => 'X', 'project_name' => 'Universidade'])->assertCreated();

        $this->assertSame($response->json('data.project_id'), Project::where('name', 'Universidade')->value('id'));
    }

    public function test_project_id_and_project_name_together_are_rejected(): void
    {
        $project = Project::factory()->create();

        $this->postJson('/api/v1/tasks', ['title' => 'X', 'project_id' => $project->id, 'project_name' => 'Outro'])
            ->assertStatus(422)->assertJsonValidationErrors('project_name');
    }

    public function test_validation_rules(): void
    {
        $cases = [
            'title' => ['title' => '   '],
            'due_time' => ['title' => 'X', 'due_time' => '10:00'],
            'recurrence_rule' => ['title' => 'X', 'due_date' => '2026-12-01', 'recurrence_rule' => 'FREQ=HOURLY'],
            'priority' => ['title' => 'X', 'priority' => 5],
            'due_date' => ['title' => 'X', 'due_date' => '01/12/2026'],
        ];

        foreach ($cases as $field => $payload) {
            $this->postJson('/api/v1/tasks', $payload)->assertStatus(422)->assertJsonValidationErrors($field);
        }

        $this->postJson('/api/v1/tasks', ['title' => 'X', 'recurrence_rule' => 'FREQ=DAILY'])
            ->assertStatus(422)->assertJsonValidationErrors('recurrence_rule');
        $this->assertSame(0, Task::count());
    }

    public function test_rejects_references_to_another_users_records(): void
    {
        [$project, $sectionId, $task, $label] = $this->asOtherUser(function () {
            $project = Project::factory()->create();
            $sectionId = (string) Str::uuid();
            DB::table('sections')->insert([
                'id' => $sectionId, 'user_id' => $project->user_id, 'project_id' => $project->id, 'name' => 'Por fazer',
            ]);

            return [$project, $sectionId, Task::factory()->create(), Label::factory()->create()];
        });

        $cases = [
            'project_id' => ['project_id' => $project->id],
            'section_id' => ['section_id' => $sectionId],
            'parent_task_id' => ['parent_task_id' => $task->id],
            'label_ids.0' => ['label_ids' => [$label->id]],
        ];

        foreach ($cases as $field => $payload) {
            $this->postJson('/api/v1/tasks', ['title' => 'X'] + $payload)
                ->assertStatus(422)->assertJsonValidationErrors($field);
        }
        $this->assertSame(0, Task::count());
    }

    public function test_section_must_belong_to_the_tasks_project(): void
    {
        $project = Project::factory()->create();
        $other = Project::factory()->create();
        $sectionId = (string) Str::uuid();
        DB::table('sections')->insert([
            'id' => $sectionId, 'user_id' => $this->ana->id, 'project_id' => $other->id, 'name' => 'Por fazer',
        ]);

        $this->postJson('/api/v1/tasks', ['title' => 'X', 'project_id' => $project->id, 'section_id' => $sectionId])
            ->assertStatus(422)->assertJsonValidationErrors('section_id');

        $this->postJson('/api/v1/tasks', ['title' => 'X', 'project_id' => $other->id, 'section_id' => $sectionId])
            ->assertCreated();
    }

    public function test_update_changes_fields_and_logs_the_changes(): void
    {
        $task = Task::factory()->create(['title' => 'Antes', 'priority' => 4]);
        $label = Label::factory()->create();

        $this->patchJson("/api/v1/tasks/{$task->id}", [
            'title' => 'Depois', 'priority' => 2, 'due_date' => '2026-11-20', 'label_ids' => [$label->id],
        ])->assertOk()
            ->assertJsonPath('data.title', 'Depois')
            ->assertJsonPath('data.priority', 2)
            ->assertJsonPath('data.due_date', '2026-11-20')
            ->assertJsonPath('data.label_ids', [$label->id]);

        $log = $this->lastActivity($task->id);
        $this->assertSame('updated', $log->action);
        $changes = json_decode($log->payload, true)['changes'];
        $this->assertSame(['Antes', 'Depois'], $changes['title']);
        $this->assertSame([4, 2], $changes['priority']);
        $this->assertSame([null, '2026-11-20'], $changes['due_date']);
    }

    public function test_update_without_changes_does_not_log(): void
    {
        $task = Task::factory()->create(['title' => 'Igual']);

        $this->patchJson("/api/v1/tasks/{$task->id}", ['title' => 'Igual'])->assertOk();

        $this->assertSame(0, DB::table('activity_log')->where('action', 'updated')->count());
    }

    public function test_update_cannot_leave_time_without_date(): void
    {
        $task = Task::factory()->create(['due_date' => '2026-11-20', 'due_time' => '10:00']);

        $this->patchJson("/api/v1/tasks/{$task->id}", ['due_date' => null])
            ->assertStatus(422)->assertJsonValidationErrors('due_time');

        $this->patchJson("/api/v1/tasks/{$task->id}", ['due_date' => null, 'due_time' => null])
            ->assertOk()->assertJsonPath('data.due_time', null);
    }

    public function test_task_cannot_be_its_own_parent(): void
    {
        $task = Task::factory()->create();

        $this->patchJson("/api/v1/tasks/{$task->id}", ['parent_task_id' => $task->id])
            ->assertStatus(422)->assertJsonValidationErrors('parent_task_id');
    }

    public function test_delete_hides_the_task_and_restore_brings_it_back(): void
    {
        $task = Task::factory()->create();

        $this->deleteJson("/api/v1/tasks/{$task->id}")->assertNoContent();
        $this->getJson('/api/v1/tasks?view=inbox')->assertJsonCount(0, 'data');
        $this->patchJson("/api/v1/tasks/{$task->id}", ['title' => 'Y'])->assertNotFound();
        $this->assertSame('deleted', $this->lastActivity($task->id)->action);

        $this->postJson("/api/v1/tasks/{$task->id}/restore")->assertOk()->assertJsonPath('data.id', $task->id);
        $this->getJson('/api/v1/tasks?view=inbox')->assertJsonCount(1, 'data');
        $this->assertSame('restored', $this->lastActivity($task->id)->action);
    }

    public function test_other_users_tasks_are_not_found(): void
    {
        $task = $this->asOtherUser(fn () => Task::factory()->create());

        $this->patchJson("/api/v1/tasks/{$task->id}", ['title' => 'Y'])->assertNotFound();
        $this->deleteJson("/api/v1/tasks/{$task->id}")->assertNotFound();
        $this->postJson("/api/v1/tasks/{$task->id}/restore")->assertNotFound();
    }

    public function test_reschedule_moves_dates_and_keeps_times(): void
    {
        $a = Task::factory()->create(['due_date' => '2026-11-10', 'due_time' => '09:00']);
        $b = Task::factory()->create(['due_date' => '2026-11-12']);
        $c = Task::factory()->create();

        $this->postJson('/api/v1/tasks/reschedule', ['task_ids' => [$a->id, $b->id, $c->id], 'due_date' => '2026-11-14'])
            ->assertOk()->assertJsonCount(3, 'data');

        $this->assertSame('2026-11-14', $a->fresh()->due_date->toDateString());
        $this->assertSame('09:00:00', $a->fresh()->due_time);
        $this->assertSame('2026-11-14', $c->fresh()->due_date->toDateString());

        $log = $this->lastActivity($a->id);
        $this->assertSame('rescheduled', $log->action);
        $this->assertEquals(['previous_due_date' => '2026-11-10', 'due_date' => '2026-11-14'], json_decode($log->payload, true));
    }

    public function test_reschedule_rejects_foreign_ids_and_changes_nothing(): void
    {
        $mine = Task::factory()->create(['due_date' => '2026-11-10']);
        $foreign = $this->asOtherUser(fn () => Task::factory()->create());

        $this->postJson('/api/v1/tasks/reschedule', ['task_ids' => [$mine->id, $foreign->id], 'due_date' => '2026-11-14'])
            ->assertStatus(422)->assertJsonValidationErrors('task_ids.1');

        $this->assertSame('2026-11-10', $mine->fresh()->due_date->toDateString());
    }
}
