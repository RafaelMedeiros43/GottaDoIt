import { useCompleteTask, useDeleteTask, useReopenTask, useRestoreTask } from './queries'
import { showUndoToast, taskToastId } from './undo-toast'
import type { Task } from '@/lib/types'

/** Concluir e apagar uma tarefa, cada um com o seu "Desfazer". */
export function useTaskActions() {
  const complete = useCompleteTask()
  const reopen = useReopenTask()
  const remove = useDeleteTask()
  const restore = useRestoreTask()

  return {
    onComplete(task: Task) {
      complete.mutate(task)
      showUndoToast('Tarefa concluída', () => reopen.mutate(task), taskToastId(task.id))
    },
    onDelete(task: Task) {
      remove.mutate(task)
      showUndoToast('Tarefa apagada', () => restore.mutate(task), taskToastId(task.id))
    },
  }
}
