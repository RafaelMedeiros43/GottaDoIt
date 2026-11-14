import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { SAVE_ERROR, taskToastId } from './undo-toast'
import { api } from '@/lib/api'
import type { Label, NewTask, Project, Task } from '@/lib/types'

export interface TodayResponse {
  data: Task[]
  /** `today` é a data de hoje no fuso do utilizador. */
  meta: { today: string }
}

export const TODAY_KEY = ['tasks', 'today'] as const
const MUTATION_KEY = ['tasks'] as const

/** A mesma ordem da API: data, hora (sem hora no fim), prioridade, posição. */
export function sortTasks(tasks: Task[]): Task[] {
  const text = (a: string | null, b: string | null) => (a ?? '￿').localeCompare(b ?? '￿')

  return [...tasks].sort(
    (a, b) =>
      text(a.due_date, b.due_date) ||
      text(a.due_time, b.due_time) ||
      a.priority - b.priority ||
      a.position - b.position,
  )
}

export function useTodayTasks() {
  const query = useQuery({
    queryKey: TODAY_KEY,
    queryFn: () => api<TodayResponse>('/tasks?view=today'),
  })

  const tasks = query.data?.data ?? []
  const todayDate = query.data?.meta.today ?? null

  return {
    overdue: tasks.filter((task) => todayDate !== null && task.due_date !== null && task.due_date < todayDate),
    today: tasks.filter((task) => todayDate === null || task.due_date === null || task.due_date >= todayDate),
    todayDate,
    isLoading: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
  }
}

export function useProjects() {
  return useQuery({ queryKey: ['projects'], queryFn: () => api<{ data: Project[] }>('/projects'), select: (r) => r.data })
}

export function useLabels() {
  return useQuery({ queryKey: ['labels'], queryFn: () => api<{ data: Label[] }>('/labels'), select: (r) => r.data })
}

interface OptimisticOptions<V> {
  mutationFn: (variables: V) => Promise<unknown>
  /** Como a lista de "Hoje" fica depois da alteração, antes de o servidor responder. */
  apply: (tasks: Task[], variables: V, today: string) => Task[]
  /** O aviso que um erro deve substituir (o "Desfazer" da mesma tarefa). */
  toastId?: (variables: V) => string
  /** Outras listas a recarregar no fim. */
  alsoInvalidate?: readonly (readonly string[])[]
}

/**
 * Uma escrita que aparece de imediato no ecrã. Se o servidor falhar, a lista
 * volta ao que era e aparece um aviso. As escritas seguem para o servidor
 * uma de cada vez, pela ordem em que foram feitas.
 */
export function useOptimisticTaskMutation<V>({ mutationFn, apply, toastId, alsoInvalidate = [] }: OptimisticOptions<V>) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: MUTATION_KEY,
    scope: { id: 'tasks' },
    mutationFn,
    onMutate: async (variables: V) => {
      await queryClient.cancelQueries({ queryKey: TODAY_KEY })
      const previous = queryClient.getQueryData<TodayResponse>(TODAY_KEY)

      if (previous) {
        queryClient.setQueryData<TodayResponse>(TODAY_KEY, {
          ...previous,
          data: sortTasks(apply(previous.data, variables, previous.meta.today)),
        })
      }

      return { previous }
    },
    onError: (_error, variables, context) => {
      if (context?.previous) queryClient.setQueryData(TODAY_KEY, context.previous)
      toast.error(SAVE_ERROR, { id: toastId?.(variables) })
    },
    onSettled: () => {
      // Só recarrega quando já não há mais escritas a caminho, para não
      // mostrar por instantes um estado antigo.
      if (queryClient.isMutating({ mutationKey: MUTATION_KEY }) === 1) {
        queryClient.invalidateQueries({ queryKey: TODAY_KEY })
        alsoInvalidate.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }))
      }
    },
  })
}

const without = (tasks: Task[], task: Task) => tasks.filter((other) => other.id !== task.id)
const withTask = (tasks: Task[], task: Task) => [...without(tasks, task), task]
const toastOf = (task: Task) => taskToastId(task.id)

export function useCompleteTask() {
  return useOptimisticTaskMutation<Task>({
    mutationFn: (task) => api(`/tasks/${task.id}/complete`, { method: 'POST' }),
    apply: without,
    toastId: toastOf,
  })
}

export function useReopenTask() {
  return useOptimisticTaskMutation<Task>({
    mutationFn: (task) => api(`/tasks/${task.id}/reopen`, { method: 'POST' }),
    apply: withTask,
    toastId: toastOf,
  })
}

export function useDeleteTask() {
  return useOptimisticTaskMutation<Task>({
    mutationFn: (task) => api(`/tasks/${task.id}`, { method: 'DELETE' }),
    apply: without,
    toastId: toastOf,
  })
}

export function useRestoreTask() {
  return useOptimisticTaskMutation<Task>({
    mutationFn: (task) => api(`/tasks/${task.id}/restore`, { method: 'POST' }),
    apply: withTask,
    toastId: toastOf,
  })
}

export function useRescheduleTasks() {
  return useOptimisticTaskMutation<{ taskIds: string[]; dueDate: string }>({
    mutationFn: ({ taskIds, dueDate }) =>
      api('/tasks/reschedule', { method: 'POST', body: { task_ids: taskIds, due_date: dueDate } }),
    apply: (tasks, { taskIds, dueDate }) =>
      tasks.map((task) => (taskIds.includes(task.id) ? { ...task, due_date: dueDate } : task)),
  })
}

/** A tarefa tal como aparece no ecrã antes de o servidor responder. */
function optimisticTask(input: NewTask): Task {
  const now = new Date().toISOString()

  return {
    id: input.id,
    title: input.title,
    description: null,
    due_date: input.due_date,
    due_time: input.due_time,
    recurrence_rule: input.recurrence_rule,
    recurrence_text: input.recurrence_text,
    priority: input.priority,
    is_completed: false,
    completed_at: null,
    position: Number.MAX_SAFE_INTEGER,
    project_id: null,
    section_id: null,
    parent_task_id: null,
    label_ids: [],
    created_at: now,
    updated_at: now,
  }
}

export function useCreateTask() {
  return useOptimisticTaskMutation<NewTask>({
    mutationFn: (input) => api('/tasks', { method: 'POST', body: input }),
    // Só entra em "Hoje" o que vence hoje ou já está em atraso.
    apply: (tasks, input, today) =>
      input.due_date !== null && input.due_date <= today ? [...tasks, optimisticTask(input)] : tasks,
    toastId: (input) => taskToastId(input.id),
    // O Quick Add pode ter criado um projeto ou etiquetas.
    alsoInvalidate: [['projects'], ['labels']],
  })
}
