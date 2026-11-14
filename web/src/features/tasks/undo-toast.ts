import { toast } from 'sonner'

export const SAVE_ERROR = 'Não foi possível guardar. Tenta de novo.'

/** O aviso de uma tarefa tem sempre o mesmo id, para um erro substituir o "Desfazer". */
export const taskToastId = (taskId: string) => `task-${taskId}`

/** Aviso com o botão "Desfazer", visível durante 5 segundos. */
export function showUndoToast(message: string, onUndo: () => void, id?: string): void {
  toast(message, {
    id,
    duration: 5000,
    action: { label: 'Desfazer', onClick: onUndo },
  })
}
