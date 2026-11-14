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
}
