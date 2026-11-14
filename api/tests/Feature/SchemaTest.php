<?php

namespace Tests\Feature;

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class SchemaTest extends TestCase
{
    private const DATA_TABLES = [
        'projects', 'sections', 'tasks', 'labels', 'task_labels',
        'reminders', 'activity_log', 'push_subscriptions',
    ];

    private const OPEN_TABLES = ['users', 'personal_access_tokens'];

    public function test_all_tables_exist(): void
    {
        $tables = DB::table('pg_tables')->where('schemaname', 'public')->pluck('tablename')->all();

        foreach ([...self::DATA_TABLES, ...self::OPEN_TABLES] as $table) {
            $this->assertContains($table, $tables);
        }
    }

    public function test_rls_is_forced_on_data_tables(): void
    {
        $flags = DB::table('pg_class')
            ->whereIn('relname', [...self::DATA_TABLES, ...self::OPEN_TABLES])
            ->where('relkind', 'r')
            ->get(['relname', 'relrowsecurity', 'relforcerowsecurity'])
            ->keyBy('relname');

        foreach (self::DATA_TABLES as $table) {
            $this->assertTrue($flags[$table]->relrowsecurity, "$table sem RLS");
            $this->assertTrue($flags[$table]->relforcerowsecurity, "$table sem FORCE RLS");
        }

        foreach (self::OPEN_TABLES as $table) {
            $this->assertFalse($flags[$table]->relrowsecurity, "$table não devia ter RLS");
        }
    }

    public function test_app_role_cannot_bypass_rls(): void
    {
        $role = DB::selectOne('select rolname, rolbypassrls, rolsuper from pg_roles where rolname = current_user');

        $this->assertSame('gottadoit_app', $role->rolname);
        $this->assertFalse($role->rolbypassrls);
        $this->assertFalse($role->rolsuper);
    }

    public function test_task_checks_reject_time_without_date(): void
    {
        $userId = (string) Str::uuid();
        DB::table('users')->insert([
            'id' => $userId, 'name' => 'Ana', 'email' => 'ana@example.com', 'password' => 'x',
        ]);
        DB::select("select set_config('app.user_id', ?, true)", [$userId]);

        $this->expectException(QueryException::class);
        $this->expectExceptionMessage('tasks_time_needs_date');

        DB::table('tasks')->insert([
            'id' => (string) Str::uuid(), 'user_id' => $userId, 'title' => 'Sem data', 'due_time' => '10:00',
        ]);
    }


    public function test_foreign_keys_reject_rows_of_another_user(): void
    {
        [$ana, $bruno] = [(string) Str::uuid(), (string) Str::uuid()];
        foreach ([$ana => 'ana@example.com', $bruno => 'bruno@example.com'] as $id => $email) {
            DB::table('users')->insert(['id' => $id, 'name' => 'X', 'email' => $email, 'password' => 'x']);
        }

        $project = (string) Str::uuid();
        DB::select("select set_config('app.user_id', ?, true)", [$bruno]);
        DB::table('projects')->insert(['id' => $project, 'user_id' => $bruno, 'name' => 'Do Bruno']);

        // Mesmo que a validação da API falhasse, a base de dados não deixa
        // uma tarefa da Ana apontar para um projeto do Bruno.
        DB::select("select set_config('app.user_id', ?, true)", [$ana]);

        $this->expectException(QueryException::class);
        $this->expectExceptionMessage('foreign key');

        DB::table('tasks')->insert([
            'id' => (string) Str::uuid(), 'user_id' => $ana, 'title' => 'X', 'project_id' => $project,
        ]);
    }

    public function test_deleting_a_section_keeps_its_tasks(): void
    {
        $user = (string) Str::uuid();
        DB::table('users')->insert(['id' => $user, 'name' => 'X', 'email' => 'x@example.com', 'password' => 'x']);
        DB::select("select set_config('app.user_id', ?, true)", [$user]);
        [$project, $section, $task] = [(string) Str::uuid(), (string) Str::uuid(), (string) Str::uuid()];
        DB::table('projects')->insert(['id' => $project, 'user_id' => $user, 'name' => 'P']);
        DB::table('sections')->insert(['id' => $section, 'user_id' => $user, 'project_id' => $project, 'name' => 'S']);
        DB::table('tasks')->insert([
            'id' => $task, 'user_id' => $user, 'title' => 'X', 'project_id' => $project, 'section_id' => $section,
        ]);

        DB::table('sections')->where('id', $section)->delete();

        $row = DB::table('tasks')->where('id', $task)->first();
        $this->assertNull($row->section_id);
        $this->assertSame($user, $row->user_id);
    }
}
