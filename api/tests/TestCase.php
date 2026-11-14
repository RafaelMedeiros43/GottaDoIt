<?php

namespace Tests;

use App\Models\User;
use App\Support\RlsContext;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;

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

    /**
     * Cada pedido HTTP começa sem contexto RLS, como em produção: tem de ser
     * o middleware a defini-lo. O contexto do teste (usado para criar dados e
     * fazer verificações) é reposto no fim.
     */
    public function call($method, $uri, $parameters = [], $cookies = [], $files = [], $server = [], $content = null)
    {
        $context = DB::selectOne("select current_setting('app.user_id', true) as value")->value ?? '';
        DB::select("select set_config('app.user_id', '', true)");

        try {
            return parent::call($method, $uri, $parameters, $cookies, $files, $server, $content);
        } finally {
            DB::select("select set_config('app.user_id', ?, true)", [$context]);
        }
    }

    /** Autentica o utilizador e define o contexto RLS para os dados criados no teste. */
    protected function actingAsUser(User $user): static
    {
        Sanctum::actingAs($user);
        RlsContext::set($user->id);

        return $this;
    }
}
