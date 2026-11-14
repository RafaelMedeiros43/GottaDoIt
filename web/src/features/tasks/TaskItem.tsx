import { Repeat, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { formatDayLabel } from '@/lib/dates'
import type { Label, Project, Task } from '@/lib/types'
import { cn } from '@/lib/utils'

const PRIORITY_COLOR = { 1: 'text-p1', 2: 'text-p2', 3: 'text-p3', 4: 'text-p4' } as const

interface TaskItemProps {
  task: Task
  today: string
  project?: Project
  labels: Label[]
  onComplete: (task: Task) => void
  onDelete: (task: Task) => void
  /** Mostra a data de todas as tarefas, e não só das que estão em atraso. */
  showDate?: boolean
}

export function TaskItem({ task, today, project, labels, onComplete, onDelete, showDate = false }: TaskItemProps) {
  const overdue = task.due_date !== null && task.due_date < today
  const dated = task.due_date !== null && (overdue || showDate)
  const hasDetails = dated || task.due_time || task.recurrence_rule || project || labels.length > 0

  return (
    <li className="group flex items-start gap-3 border-b py-2.5">
      <Checkbox
        checked={false}
        onCheckedChange={() => onComplete(task)}
        aria-label={`Concluir "${task.title}"`}
        data-priority={task.priority}
        className={cn('mt-0.5', PRIORITY_COLOR[task.priority])}
      />

      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug break-words">{task.title}</p>

        {hasDetails && (
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
            {dated && (
              <span className={cn(overdue && 'font-medium text-destructive')}>
                {formatDayLabel(task.due_date!, today)}
              </span>
            )}
            {task.due_time && <span className={cn(overdue && 'text-destructive')}>{task.due_time}</span>}
            {task.recurrence_rule && (
              <Repeat
                role="img"
                aria-label={`Repete: ${task.recurrence_text ?? task.recurrence_rule}`}
                className="size-3.5"
              />
            )}
            {project && (
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full" style={{ backgroundColor: project.color }} aria-hidden="true" />
                {project.name}
              </span>
            )}
            {labels.map((label) => (
              <Badge key={label.id} className="font-normal text-muted-foreground">
                @{label.name}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => onDelete(task)}
        aria-label={`Apagar "${task.title}"`}
        className="grid size-7 shrink-0 place-content-center rounded-md text-muted-foreground outline-none transition-opacity hover:bg-accent hover:text-destructive focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring md:opacity-0 md:group-hover:opacity-100"
      >
        <Trash2 className="size-4" />
      </button>
    </li>
  )
}
