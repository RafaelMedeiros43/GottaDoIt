<?php

namespace App\Http\Middleware;

use App\Support\RlsContext;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

/**
 * Corre cada pedido autenticado dentro de uma transação com o contexto RLS
 * do utilizador. Qualquer resposta de erro desfaz o que o pedido escreveu.
 */
class SetRlsContext
{
    public function handle(Request $request, Closure $next): Response
    {
        DB::beginTransaction();

        try {
            RlsContext::set($request->user()->getAuthIdentifier());
            $response = $next($request);
        } catch (Throwable $e) {
            DB::rollBack();
            throw $e;
        }

        $response->getStatusCode() >= 400 ? DB::rollBack() : DB::commit();

        return $response;
    }
}
