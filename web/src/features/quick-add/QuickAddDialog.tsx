import { CalendarDays, Clock, Flag, Repeat } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { toast } from 'sonner'
import { HighlightedInput } from './HighlightedInput'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/features/auth/AuthProvider'
import { useCreateTask, useLabels, useProjects, useTodayTasks } from '@/features/tasks/queries'
import { taskToastId } from '@/features/tasks/undo-toast'
import { formatDayLabel, todayInTimezone } from '@/lib/dates'
import { parseQuickAdd } from '@/lib/quick-add-parser'
import { cn } from '@/lib/utils'

const PRIORITY_COLOR = { 1: 'text-p1', 2: 'text-p2', 3: 'text-p3', 4: 'text-p4' } as const

const sameName = (a: string, b: string) => a.localeCompare(b, 'pt', { sensitivity: 'accent' }) === 0

interface QuickAddDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function QuickAddDialog({ open, onOpenChange }: QuickAddDialogProps) {
  const { user } = useAuth()
  const { todayDate } = useTodayTasks()
  const { data: projects = [] } = useProjects()
  const { data: labels = [] } = useLabels()
  const createTask = useCreateTask()

  const [text, setText] = useState('')
  const [missingTitle, setMissingTitle] = useState(false)

  // A data de hoje é a do fuso do utilizador, não a do relógio do browser.
  const today = todayDate ?? todayInTimezone(user?.timezone ?? 'Europe/Lisbon')
  const parsed = parseQuickAdd(text, today, { weekStart: user?.week_start ?? 1 })

  function close() {
    onOpenChange(false)
    setText('')
    setMissingTitle(false)
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()

    if (parsed.title === '') {
      setMissingTitle(true)
      return
    }

    const id = crypto.randomUUID()
    const written = text

    createTask.mutate(
      {
        id,
        title: parsed.title,
        due_date: parsed.dueDate,
        due_time: parsed.dueTime,
        recurrence_rule: parsed.recurrenceRule,
        recurrence_text: parsed.recurrenceText,
        priority: parsed.priority ?? 4,
        project_name: parsed.projectName,
        label_names: parsed.labelNames,
      },
      {
        // Se o servidor recusar, o texto volta para não se perder.
        onError: () => {
          setText(written)
          onOpenChange(true)
        },
      },
    )

    // O que vence hoje aparece logo na lista; o resto só se vê por este aviso.
    if (parsed.dueDate === null || parsed.dueDate > today) {
      toast('Tarefa adicionada', {
        id: taskToastId(id),
        description: parsed.dueDate ? formatDayLabel(parsed.dueDate, today) : 'Sem data',
      })
    }

    close()
  }

  const isNew = (name: string, existing: { name: string }[]) => !existing.some((item) => sameName(item.name, name))
  const newMark = <span className="rounded-sm bg-background/70 px-1 text-[10px] font-semibold uppercase">novo</span>

  const chips: { key: string; className: string; content: ReactNode }[] = []
  if (parsed.dueDate) {
    chips.push({
      key: 'date',
      className: 'bg-token-date',
      content: (
        <>
          <CalendarDays />
          {formatDayLabel(parsed.dueDate, today)}
        </>
      ),
    })
  }
  if (parsed.dueTime) {
    chips.push({
      key: 'time',
      className: 'bg-token-time',
      content: (
        <>
          <Clock />
          {parsed.dueTime}
        </>
      ),
    })
  }
  if (parsed.recurrenceText) {
    chips.push({
      key: 'recurrence',
      className: 'bg-token-recurrence',
      content: (
        <>
          <Repeat />
          {parsed.recurrenceText}
        </>
      ),
    })
  }
  if (parsed.projectName) {
    chips.push({
      key: 'project',
      className: 'bg-token-project',
      content: (
        <>
          #{parsed.projectName}
          {isNew(parsed.projectName, projects) && newMark}
        </>
      ),
    })
  }
  for (const name of parsed.labelNames) {
    chips.push({
      key: `label-${name}`,
      className: 'bg-token-label',
      content: (
        <>
          @{name}
          {isNew(name, labels) && newMark}
        </>
      ),
    })
  }
  if (parsed.priority) {
    chips.push({
      key: 'priority',
      className: 'bg-token-priority',
      content: (
        <>
          <Flag className={PRIORITY_COLOR[parsed.priority]} />P{parsed.priority}
        </>
      ),
    })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent>
        <DialogTitle className="sr-only">Adicionar tarefa</DialogTitle>
        <DialogDescription className="sr-only">
          Escreve a tarefa. Datas, horas, #projeto, @etiqueta e p1 a p4 são reconhecidos automaticamente.
        </DialogDescription>

        <form onSubmit={onSubmit}>
          <HighlightedInput
            value={text}
            tokens={parsed.tokens}
            onValueChange={(value) => {
              setText(value)
              setMissingTitle(false)
            }}
            aria-label="Tarefa"
            aria-invalid={missingTitle || undefined}
            aria-describedby={missingTitle ? 'quick-add-error' : 'quick-add-hint'}
            placeholder="Ex.: Pagar renda amanhã às 15h #Casa @urgente p1"
            autoComplete="off"
            autoFocus
          />

          <div className="mt-2 min-h-7">
            {missingTitle ? (
              <p id="quick-add-error" role="alert" className="text-sm text-destructive">
                Escreve um título para a tarefa.
              </p>
            ) : (
              <ul aria-label="Reconhecido" className="flex flex-wrap gap-1.5">
                {chips.map((chip) => (
                  <li key={chip.key}>
                    <Badge className={cn('px-2 py-1', chip.className)}>{chip.content}</Badge>
                  </li>
                ))}
              </ul>
            )}
            {!missingTitle && chips.length === 0 && (
              <p id="quick-add-hint" className="text-xs text-muted-foreground">
                Experimenta: <span className="font-medium">amanhã às 15h</span>,{' '}
                <span className="font-medium">toda segunda-feira</span>, <span className="font-medium">#projeto</span>,{' '}
                <span className="font-medium">@etiqueta</span>, <span className="font-medium">p1</span>
              </p>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 border-t pt-3">
            <p className="text-xs text-muted-foreground">
              <kbd className="rounded border px-1">Enter</kbd> para criar · <kbd className="rounded border px-1">Esc</kbd>{' '}
              para fechar
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={close}>
                Cancelar
              </Button>
              <Button type="submit" size="sm">
                Adicionar tarefa
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
