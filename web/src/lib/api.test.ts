import { api, ApiError, setUnauthorizedHandler, tokenStore } from './api'
import { fakeApi } from '@/test/fake-api'

describe('api', () => {
  it('envia o token e o corpo em JSON, e devolve a resposta', async () => {
    tokenStore.set('abc123')
    const server = fakeApi({ 'POST /tasks': { data: { id: '1' } } })

    const result = await api<{ data: { id: string } }>('/tasks', { method: 'POST', body: { title: 'X' } })

    expect(result).toEqual({ data: { id: '1' } })
    expect(server.calls[0]).toMatchObject({
      method: 'POST',
      path: '/tasks',
      body: { title: 'X' },
      headers: { Authorization: 'Bearer abc123', Accept: 'application/json', 'Content-Type': 'application/json' },
    })
  })

  it('não envia Authorization sem token', async () => {
    const server = fakeApi({ 'GET /projects': { data: [] } })

    await api('/projects')

    expect(server.calls[0].headers).not.toHaveProperty('Authorization')
  })

  it('converte um 422 em ApiError com os erros por campo', async () => {
    fakeApi({
      'POST /auth/login': () => ({
        status: 422,
        body: { message: 'Credenciais erradas.', errors: { email: ['Credenciais erradas.'] } },
      }),
    })

    const error = await api('/auth/login', { method: 'POST', body: {} }).catch((e) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 422, message: 'Credenciais erradas.', errors: { email: ['Credenciais erradas.'] } })
  })

  it('devolve undefined num 204', async () => {
    fakeApi({ 'DELETE /tasks/1': () => ({ status: 204 }) })

    await expect(api('/tasks/1', { method: 'DELETE' })).resolves.toBeUndefined()
  })

  it('num 401 esquece o token e avisa a aplicação', async () => {
    tokenStore.set('expirado')
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)
    fakeApi({ 'GET /me': () => ({ status: 401, body: { message: 'Unauthenticated.' } }) })

    await expect(api('/me')).rejects.toMatchObject({ status: 401 })

    expect(tokenStore.get()).toBeNull()
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  it('uma falha de rede dá um ApiError com estado 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(api('/me')).rejects.toMatchObject({ status: 0 })
  })
})
