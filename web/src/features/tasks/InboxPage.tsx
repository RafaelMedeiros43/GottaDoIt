import { Inbox } from 'lucide-react'
import { TaskItem } from './TaskItem'
import { useInboxTasks, useLabels } from './queries'
import { useTaskActions } from './useTaskActions'
import { Button } from '@/components/ui/button'

/** As tarefas que ainda não têm projeto, com ou sem data. */
export function InboxPage() {
  const { tasks, todayDate, isLoading, isError, refetch } = useInboxTasks()
  const { data: labels = [] } = useLabels()
  const { onComplete, onDelete } = useTaskActions()

  return (
    <>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Caixa de Entrada</h1>
        <p className="mt-1 text-sm text-muted-foreground">Tarefas sem projeto.</p>
      </header>

      {isLoading && (
        <p role="status" className="text-sm text-muted-foreground">
          A carregar…
        </p>
      )}

      {isError && (
        <div role="alert" className="space-y-3 text-sm">
          <p>Não foi possível carregar as tarefas.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Tentar de novo
          </Button>
        </div>
      )}

      {todayDate && !isError && tasks.length > 0 && (
        <ul className="border-t">
          {tasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              today={todayDate}
              labels={labels.filter((label) => task.label_ids.includes(label.id))}
              onComplete={onComplete}
              onDelete={onDelete}
              showDate
            />
          ))}
        </ul>
      )}

      {todayDate && !isError && tasks.length === 0 && (
        <div className="grid justify-items-center gap-3 py-16 text-center">
          <Inbox className="size-10 text-primary" strokeWidth={1.5} aria-hidden="true" />
          <p className="font-medium">A Caixa de Entrada está vazia.</p>
          <p className="text-sm text-muted-foreground">
            Carrega em <kbd className="rounded border px-1 text-xs">Q</kbd> para adicionar uma tarefa.
          </p>
        </div>
      )}
    </>
  )
}
