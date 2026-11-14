<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * O esquema vive em database/sql/001_schema.sql (única fonte de verdade).
 * Correr com: php artisan migrate --database=pgsql_admin
 */
return new class extends Migration
{
    protected $connection = 'pgsql_admin';

    public function up(): void
    {
        DB::connection($this->connection)->unprepared(
            file_get_contents(database_path('sql/001_schema.sql'))
        );
    }

    public function down(): void
    {
        DB::connection($this->connection)->unprepared(<<<'SQL'
            DROP TABLE IF EXISTS push_subscriptions, activity_log, reminders, task_labels,
                labels, tasks, sections, projects, personal_access_tokens, users CASCADE;
        SQL);
    }
};
