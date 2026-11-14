<?php

namespace Tests;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Artisan;

abstract class TestCase extends BaseTestCase
{
    use DatabaseTransactions;

    /** Os testes correm numa transação da ligação da aplicação (com RLS). */
    protected $connectionsToTransact = ['pgsql'];

    private static bool $migrated = false;

    protected function setUp(): void
    {
        parent::setUp();

        // O esquema é criado uma vez por processo, com o papel de administração.
        if (! self::$migrated) {
            Artisan::call('migrate:fresh', ['--database' => 'pgsql_admin', '--force' => true]);
            self::$migrated = true;
        }
    }
}
