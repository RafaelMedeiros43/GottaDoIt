import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { SAVE_ERROR, taskToastId } from './undo-toast'
import { api } from '@/lib/api'
import type { Label, NewTask, Project, Task } from '@/lib/types'

export interface TaskListResponse {
  data: Task[]
  /** `today` é a data de hoje no fuso do utilizador. */
  meta: { today: string }
}

export const TODAY_KEY = ['tasks', 'today'] as const
export const INBOX_KEY = ['tasks', 'inbox'] as const
const ALL_TASKS_KEY = ['tasks'] as const
const MUTATION_KEY = ['tasks'] as const

const text = (a: string | null, b: string | null) => (a ?? '￿').localeCompare(b ?? '￿')

/** A ordem de "Hoje" na API: data, hora (sem hora no fim), prioridade, posição. */
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort(
    (a, b) =>
      text(a.due_date, b.due_date) ||
      text(a.due_time, b.due_time) ||
      a.priority - b.priority ||
      a.position - b.position,
  )
}

/** A ordem da Caixa de Entrada na API: posição e, em caso de empate, a mais antiga primeiro. */
export function sortInboxTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => a.position - b.position || text(a.created_at, b.created_at))
}

/** O que decide em que listas uma tarefa aparece. */
type Placement = Pick<Task, 'due_date' | 'project_id' | 'parent_task_id'>

interface TaskList {
  key: readonly string[]
  holds: (task: Placement, today: string) => boolean
  sort: (tasks: Task[]) => Task[]
}

/** As listas em cache que uma escrita tem de manter atualizadas. */
const TASK_LISTS: TaskList[] = [
  // "Hoje": o que vence hoje ou já está em atraso.
  { key: TODAY_KEY, holds: (task, today) => task.due_date !== null && task.due_date <= today, sort: sortTasks },
  // Caixa de Entrada: o que não tem projeto nem é subtarefa, com ou sem data.
  { key: INBOX_KEY, holds: (task) => task.project_id === null && task.parent_task_id === null, sort: sortInboxTasks },
]

export function useTodayTasks() {
  const query = useQuery({
    queryKey: TODAY_KEY,
    queryFn: () => api<TaskListResponse>('/tasks?view=today'),
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

export function useInboxTasks() {
  const query = useQuery({
    queryKey: INBOX_KEY,
    queryFn: () => api<TaskListResponse>('/tasks?view=inbox'),
  })

  return {
    tasks: query.data?.data ?? [],
    todayDate: query.data?.meta.today ?? null,
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
  /**
   * Como uma lista fica depois da alteração, antes de o servidor responder.
   * `holds` diz se uma tarefa pertence à lista que está a ser atualizada.
   */
  apply: (tasks: Task[], variables: V, holds: (task: Placement) => boolean) => Task[]
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
      await queryClient.cancelQueries({ queryKey: ALL_TASKS_KEY })

      // Só as listas já carregadas; as outras vão buscar o estado novo ao servidor.
      const previous = TASK_LISTS.flatMap((list) => {
        const data = queryClient.getQueryData<TaskListResponse>(list.key)
        return data ? [{ list, data }] : []
      })

      previous.forEach(({ list, data }) => {
        const today = data.meta.today
        queryClient.setQueryData<TaskListResponse>(list.key, {
          ...data,
          data: list.sort(apply(data.data, variables, (task) => list.holds(task, today))),
        })
      })

      return { previous }
    },
    onError: (_error, variables, context) => {
      context?.previous.forEach(({ list, data }) => queryClient.setQueryData(list.key, data))
      toast.error(SAVE_ERROR, { id: toastId?.(variables) })
    },
    onSettled: () => {
      // Só recarrega quando já não há mais escritas a caminho, para não
      // mostrar por instantes um estado antigo.
      if (queryClient.isMutating({ mutationKey: MUTATION_KEY }) === 1) {
        queryClient.invalidateQueries({ queryKey: ALL_TASKS_KEY })
        alsoInvalidate.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }))
      }
    },
  })
}

const without = (tasks: Task[], task: Task) => tasks.filter((other) => other.id !== task.id)
const withTask = (tasks: Task[], task: Task, holds: (task: Placement) => boolean) =>
  holds(task) ? [...without(tasks, task), task] : tasks
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
    // Com projeto no texto, a tarefa não vai para a Caixa de Entrada; o id do
    // projeto ainda não se conhece, por isso o nome faz as vezes dele.
    apply: (tasks, input, holds) =>
      holds({ due_date: input.due_date, project_id: input.project_name, parent_task_id: null })
        ? [...tasks, optimisticTask(input)]
        : tasks,
    toastId: (input) => taskToastId(input.id),
    // O Quick Add pode ter criado um projeto ou etiquetas.
    alsoInvalidate: [['projects'], ['labels']],
  })
}
