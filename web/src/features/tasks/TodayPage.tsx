import { CircleCheckBig } from 'lucide-react'
import { TaskItem } from './TaskItem'
import {
  useCompleteTask,
  useDeleteTask,
  useLabels,
  useProjects,
  useReopenTask,
  useRescheduleTasks,
  useRestoreTask,
  useTodayTasks,
} from './queries'
import { showUndoToast, taskToastId } from './undo-toast'
import { Button } from '@/components/ui/button'
import { formatLongDate } from '@/lib/dates'
import type { Task } from '@/lib/types'

export function TodayPage() {
  const { overdue, today, todayDate, isLoading, isError, refetch } = useTodayTasks()
  const { data: projects = [] } = useProjects()
  const { data: labels = [] } = useLabels()

  const complete = useCompleteTask()
  const reopen = useReopenTask()
  const remove = useDeleteTask()
  const restore = useRestoreTask()
  const reschedule = useRescheduleTasks()

  function onComplete(task: Task) {
    complete.mutate(task)
    showUndoToast('Tarefa concluída', () => reopen.mutate(task), taskToastId(task.id))
  }

  function onDelete(task: Task) {
    remove.mutate(task)
    showUndoToast('Tarefa apagada', () => restore.mutate(task), taskToastId(task.id))
  }

  const renderList = (tasks: Task[]) => (
    <ul className="border-t">
      {tasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          today={todayDate!}
          project={projects.find((project) => project.id === task.project_id)}
          labels={labels.filter((label) => task.label_ids.includes(label.id))}
          onComplete={onComplete}
          onDelete={onDelete}
        />
      ))}
    </ul>
  )

  return (
    <>
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Hoje</h1>
        {todayDate && <p className="mt-1 text-sm text-muted-foreground">{formatLongDate(todayDate)}</p>}
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

      {todayDate && !isError && (
        <div className="space-y-10">
          {overdue.length > 0 && (
            <section aria-labelledby="overdue-heading">
              <div className="mb-2 flex items-center justify-between gap-4">
                <h2 id="overdue-heading" className="text-sm font-semibold text-destructive">
                  Em atraso
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-primary"
                  onClick={() => reschedule.mutate({ taskIds: overdue.map((task) => task.id), dueDate: todayDate })}
                >
                  Reagendar para hoje
                </Button>
              </div>
              {renderList(overdue)}
            </section>
          )}

          <section aria-label="Hoje">
            {overdue.length > 0 && today.length > 0 && <h2 className="mb-2 text-sm font-semibold">Hoje</h2>}

            {today.length > 0 && renderList(today)}

            {today.length === 0 && overdue.length === 0 && (
              <div className="grid justify-items-center gap-3 py-16 text-center">
                <CircleCheckBig className="size-10 text-primary" strokeWidth={1.5} aria-hidden="true" />
                <p className="font-medium">Tudo feito por hoje.</p>
                <p className="text-sm text-muted-foreground">
                  Carrega em <kbd className="rounded border px-1 text-xs">Q</kbd> para adicionar uma tarefa.
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  )
}
