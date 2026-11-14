<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\RlsContext;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Prova que a base de dados, sozinha, isola os utilizadores: as consultas
 * abaixo não têm nenhum filtro por utilizador.
 */
class RlsIsolationTest extends TestCase
{
    private function insertProject(string $userId): void
    {
        DB::table('projects')->insert(['id' => (string) Str::uuid(), 'user_id' => $userId, 'name' => 'Privado']);
    }

    public function test_rows_are_visible_only_to_their_owner(): void
    {
        [$ana, $bruno] = User::factory()->count(2)->create();

        RlsContext::set($ana->id);
        $this->insertProject($ana->id);
        $this->assertSame(1, DB::table('projects')->count());

        RlsContext::set($bruno->id);
        $this->assertSame(0, DB::table('projects')->count());
        $this->assertSame(0, DB::table('projects')->update(['name' => 'Roubado']));
        $this->assertSame(0, DB::table('projects')->delete());

        RlsContext::set($ana->id);
        $this->assertSame('Privado', DB::table('projects')->value('name'));
    }

    public function test_cannot_insert_rows_for_another_user(): void
    {
        [$ana, $bruno] = User::factory()->count(2)->create();
        RlsContext::set($bruno->id);

        $this->expectException(QueryException::class);
        $this->expectExceptionMessage('row-level security');

        $this->insertProject($ana->id);
    }

    public function test_nothing_is_visible_without_a_context(): void
    {
        $ana = User::factory()->create();
        RlsContext::set($ana->id);
        $this->insertProject($ana->id);

        DB::select("select set_config('app.user_id', '', true)");

        $this->assertSame(0, DB::table('projects')->count());
    }
}
