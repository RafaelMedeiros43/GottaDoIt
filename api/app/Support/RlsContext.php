<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

/**
 * Diz à base de dados quem é o utilizador do pedido atual. As políticas RLS
 * comparam `user_id` com este valor. Só vale até ao fim da transação em curso.
 */
class RlsContext
{
    public static function set(string $userId): void
    {
        DB::select("select set_config('app.user_id', ?, true)", [$userId]);
    }
}
