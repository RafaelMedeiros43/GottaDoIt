import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useAuth } from './AuthProvider'
import { api, tokenStore } from '@/lib/api'
import { fakeApi } from '@/test/fake-api'
import { renderApp } from '@/test/render'

const USER = { id: 'u1', name: 'Ana', email: 'ana@example.com', timezone: 'Europe/Lisbon', week_start: 1, theme: 'system' }
const CACHED = ['tasks', 'today']

function Probe() {
  const { user, logout } = useAuth()

  return (
    <>
      <p>{user ? `Sessão de ${user.name}` : 'Sem sessão'}</p>
      <button onClick={logout}>Sair</button>
    </>
  )
}

describe('AuthProvider', () => {
  it('ao terminar sessão esquece os dados em memória do utilizador', async () => {
    tokenStore.set('tok')
    fakeApi({ 'GET /me': { data: USER }, 'POST /auth/logout': () => ({ status: 204 }) })
    const { queryClient } = renderApp(<Probe />)
    await screen.findByText('Sessão de Ana')
    queryClient.setQueryData(CACHED, { data: [{ title: 'Privada' }] })

    await userEvent.click(screen.getByRole('button', { name: 'Sair' }))

    await screen.findByText('Sem sessão')
    expect(queryClient.getQueryData(CACHED)).toBeUndefined()
    expect(tokenStore.get()).toBeNull()
  })

  it('quando a sessão expira esquece os dados em memória', async () => {
    tokenStore.set('tok')
    fakeApi({
      'GET /me': { data: USER },
      'GET /projects': () => ({ status: 401, body: { message: 'Unauthenticated.' } }),
    })
    const { queryClient } = renderApp(<Probe />)
    await screen.findByText('Sessão de Ana')
    queryClient.setQueryData(CACHED, { data: [{ title: 'Privada' }] })

    await api('/projects').catch(() => {})

    await screen.findByText('Sem sessão')
    await waitFor(() => expect(queryClient.getQueryData(CACHED)).toBeUndefined())
  })
})
