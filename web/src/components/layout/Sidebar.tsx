import { CalendarDays, Inbox, LogOut, Plus, Sun } from 'lucide-react'
import { NavLink } from 'react-router'
import { ThemeToggle } from './ThemeToggle'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/AuthProvider'
import { cn } from '@/lib/utils'

const VIEWS = [
  { to: '/caixa-de-entrada', label: 'Caixa de Entrada', icon: Inbox, available: true },
  { to: '/hoje', label: 'Hoje', icon: Sun, available: true },
  { to: '/em-breve', label: 'Em breve', icon: CalendarDays, available: false },
]

const itemClass = 'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm'

export function Sidebar({ onQuickAdd }: { onQuickAdd: () => void }) {
  const { user, logout } = useAuth()

  return (
    <aside className="flex shrink-0 flex-col gap-4 border-b bg-muted/40 p-3 md:h-dvh md:w-64 md:border-r md:border-b-0">
      <div className="flex items-center justify-between gap-2 px-1">
        <span className="truncate text-sm font-semibold">{user?.name}</span>
        <ThemeToggle />
      </div>

      <Button onClick={onQuickAdd} className="justify-start" aria-keyshortcuts="Q Control+K Meta+K">
        <Plus />
        Adicionar tarefa
        <kbd className="ml-auto rounded bg-primary-foreground/20 px-1.5 text-[11px] font-normal">Q</kbd>
      </Button>

      <nav aria-label="Vistas" className="flex gap-1 md:flex-col">
        {VIEWS.map(({ to, label, icon: Icon, available }) =>
          available ? (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  itemClass,
                  'outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring',
                  isActive && 'bg-accent font-medium text-accent-foreground',
                )
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ) : (
            <span
              key={to}
              aria-disabled="true"
              title="Disponível numa próxima fase"
              className={cn(itemClass, 'text-muted-foreground/60')}
            >
              <Icon className="size-4" />
              {label}
            </span>
          ),
        )}
      </nav>

      <Button variant="ghost" size="sm" onClick={logout} className="justify-start text-muted-foreground md:mt-auto">
        <LogOut />
        Terminar sessão
      </Button>
    </aside>
  )
}
