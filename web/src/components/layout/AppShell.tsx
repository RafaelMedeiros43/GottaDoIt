import { Navigate, Outlet } from 'react-router'
import { Sidebar } from './Sidebar'
import { useAuth } from '@/features/auth/AuthProvider'

/** Moldura das páginas autenticadas: barra lateral e conteúdo. */
export function AppShell() {
  const { user, loading } = useAuth()

  if (loading) return null
  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <Sidebar onQuickAdd={() => {}} />
      <main className="min-w-0 flex-1 md:h-dvh md:overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-4 py-8 md:px-8 md:py-12">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
