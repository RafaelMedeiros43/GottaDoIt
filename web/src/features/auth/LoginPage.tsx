import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router'
import { useAuth } from './AuthProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError } from '@/lib/api'

type Mode = 'login' | 'register'

export function LoginPage() {
  const { user, login, register } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to="/hoje" replace />

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setErrors({})
    setMessage(null)

    try {
      await (mode === 'login' ? login(email, password) : register(name, email, password))
    } catch (error) {
      if (error instanceof ApiError && error.errors) setErrors(error.errors)
      else setMessage(error instanceof ApiError ? error.message : 'Ocorreu um erro. Tenta de novo.')
    } finally {
      setSubmitting(false)
    }
  }

  const field = (id: string) => ({
    id,
    'aria-invalid': errors[id] ? true : undefined,
    'aria-describedby': errors[id] ? `${id}-error` : undefined,
  })
  const fieldError = (id: string) =>
    errors[id] && (
      <p id={`${id}-error`} className="text-sm text-destructive">
        {errors[id][0]}
      </p>
    )

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">GottaDoIt</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === 'login' ? 'Entra para veres as tuas tarefas.' : 'Cria a tua conta em menos de um minuto.'}
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          {mode === 'register' && (
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome</Label>
              <Input {...field('name')} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              {fieldError('name')}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input
              {...field('email')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            {fieldError('email')}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Palavra-passe</Label>
            <Input
              {...field('password')}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            {mode === 'register' && !errors.password && (
              <p className="text-xs text-muted-foreground">Pelo menos 8 caracteres.</p>
            )}
            {fieldError('password')}
          </div>

          {message && (
            <p role="alert" className="text-sm text-destructive">
              {message}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {mode === 'login' ? 'Entrar' : 'Criar conta'}
          </Button>
        </form>

        <p className="mt-4 text-sm text-muted-foreground">
          {mode === 'login' ? 'Ainda não tens conta?' : 'Já tens conta?'}{' '}
          <Button
            type="button"
            variant="link"
            className="h-auto p-0"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login')
              setErrors({})
              setMessage(null)
            }}
          >
            {mode === 'login' ? 'Criar conta' : 'Já tenho conta'}
          </Button>
        </p>
      </div>
    </main>
  )
}
