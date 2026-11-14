import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { AuthProvider } from './AuthProvider'
import { LoginPage } from './LoginPage'
import { tokenStore } from '@/lib/api'
import { fakeApi } from '@/test/fake-api'

const USER = { id: 'u1', name: 'Ana', email: 'ana@example.com', timezone: 'Europe/Lisbon', week_start: 1, theme: 'system' }

function renderLogin() {
  render(
    <MemoryRouter>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('LoginPage', () => {
  it('entra e guarda o token', async () => {
    const server = fakeApi({ 'POST /auth/login': { data: USER, token: 'tok-1' } })
    renderLogin()

    await userEvent.type(screen.getByLabelText('E-mail'), 'ana@example.com')
    await userEvent.type(screen.getByLabelText('Palavra-passe'), 'segredo-123')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    await vi.waitFor(() => expect(tokenStore.get()).toBe('tok-1'))
    expect(server.calls[0].body).toEqual({ email: 'ana@example.com', password: 'segredo-123' })
  })

  it('mostra o erro do campo quando o login falha', async () => {
    fakeApi({
      'POST /auth/login': () => ({
        status: 422,
        body: { message: 'x', errors: { email: ['O e-mail ou a palavra-passe estão incorretos.'] } },
      }),
    })
    renderLogin()

    await userEvent.type(screen.getByLabelText('E-mail'), 'ana@example.com')
    await userEvent.type(screen.getByLabelText('Palavra-passe'), 'errada-123')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText('O e-mail ou a palavra-passe estão incorretos.')).toBeInTheDocument()
    expect(tokenStore.get()).toBeNull()
  })

  it('alterna para criar conta e envia o fuso horário do browser', async () => {
    const server = fakeApi({ 'POST /auth/register': () => ({ status: 201, body: { data: USER, token: 'tok-2' } }) })
    renderLogin()

    expect(screen.queryByLabelText('Nome')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }))

    await userEvent.type(screen.getByLabelText('Nome'), 'Ana')
    await userEvent.type(screen.getByLabelText('E-mail'), 'ana@example.com')
    await userEvent.type(screen.getByLabelText('Palavra-passe'), 'segredo-123')
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }))

    await vi.waitFor(() => expect(tokenStore.get()).toBe('tok-2'))
    expect(server.calls[0].body).toEqual({
      name: 'Ana',
      email: 'ana@example.com',
      password: 'segredo-123',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    })
  })
})
