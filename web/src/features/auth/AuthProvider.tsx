import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, setUnauthorizedHandler, tokenStore } from '@/lib/api'
import type { User } from '@/lib/types'

interface AuthContextValue {
  user: User | null
  /** Verdadeiro enquanto se confirma um token guardado. */
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

type Session = { data: User; token: string }

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(() => tokenStore.get() !== null)

  useEffect(() => {
    // Os dados em memória são de quem tinha sessão: saem com ela.
    setUnauthorizedHandler(() => {
      setUser(null)
      queryClient.clear()
    })

    if (tokenStore.get() === null) return

    api<{ data: User }>('/me')
      .then(({ data }) => setUser(data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [queryClient])

  const startSession = useCallback(
    ({ data, token }: Session) => {
      queryClient.clear()
      tokenStore.set(token)
      setUser(data)
    },
    [queryClient],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login: async (email, password) => {
        startSession(await api<Session>('/auth/login', { method: 'POST', body: { email, password } }))
      },
      register: async (name, email, password) => {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
        startSession(await api<Session>('/auth/register', { method: 'POST', body: { name, email, password, timezone } }))
      },
      logout: async () => {
        await api('/auth/logout', { method: 'POST' }).catch(() => {})
        tokenStore.clear()
        setUser(null)
        queryClient.clear()
      },
    }),
    [user, loading, startSession, queryClient],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth tem de ser usado dentro de <AuthProvider>.')
  return context
}
