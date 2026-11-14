import { vi } from 'vitest'

export interface RecordedCall {
  method: string
  path: string
  body: unknown
  headers: Record<string, string>
}

type Handler = (call: RecordedCall) => { status?: number; body?: unknown } | undefined

/**
 * Substitui `fetch` por um servidor falso. Cada rota é "MÉTODO /caminho"
 * (sem o prefixo /api/v1); a resposta por omissão é 200 com o corpo dado.
 */
export function fakeApi(routes: Record<string, Handler | Record<string, unknown>>) {
  const calls: RecordedCall[] = []

  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const call: RecordedCall = {
      method: init.method ?? 'GET',
      path: url.replace(/^\/api\/v1/, ''),
      body: init.body ? JSON.parse(init.body as string) : undefined,
      headers: (init.headers ?? {}) as Record<string, string>,
    }
    calls.push(call)

    const route = routes[`${call.method} ${call.path}`]
    if (route === undefined) throw new Error(`Pedido inesperado: ${call.method} ${call.path}`)

    const result = typeof route === 'function' ? (route(call) ?? {}) : { body: route }
    const status = result.status ?? 200

    return new Response(status === 204 ? null : JSON.stringify(result.body ?? {}), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  })

  vi.stubGlobal('fetch', fetchMock)

  return {
    calls,
    /** Os pedidos feitos a uma rota, por ordem. */
    callsTo: (route: string) => calls.filter((call) => `${call.method} ${call.path}` === route),
  }
}
