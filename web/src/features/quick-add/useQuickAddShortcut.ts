import { useEffect, useRef } from 'react'

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

/**
 * Atalhos globais do Quick Add: `Q` (fora de campos de texto) e
 * `Ctrl/Cmd + K` (em qualquer lado).
 */
export function useQuickAddShortcut(open: () => void): void {
  const openRef = useRef(open)
  openRef.current = open

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase()
      const commandK = key === 'k' && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey
      const plainQ = key === 'q' && !event.ctrlKey && !event.metaKey && !event.altKey && !isTyping(event.target)

      if (commandK || plainQ) {
        // Evita que a letra seja escrita no campo que vai receber o foco.
        event.preventDefault()
        openRef.current()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
