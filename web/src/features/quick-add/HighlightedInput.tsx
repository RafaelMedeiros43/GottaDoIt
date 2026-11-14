import { useRef, type ComponentProps } from 'react'
import type { Token, TokenKind } from '@/lib/quick-add-parser'
import { cn } from '@/lib/utils'

const TOKEN_COLOR: Record<TokenKind, string> = {
  date: 'bg-token-date',
  time: 'bg-token-time',
  recurrence: 'bg-token-recurrence',
  project: 'bg-token-project',
  label: 'bg-token-label',
  priority: 'bg-token-priority',
}

// A camada de realce e o campo têm de ter exatamente a mesma tipografia.
const TEXT = 'px-0 py-2 text-lg leading-7 whitespace-pre font-sans'

interface HighlightedInputProps extends Omit<ComponentProps<'input'>, 'value' | 'onChange'> {
  value: string
  tokens: Token[]
  onValueChange: (value: string) => void
}

/**
 * Campo de texto que realça os pedaços reconhecidos. O realce é uma camada
 * por trás de um campo transparente; o texto visível é o do próprio campo.
 */
export function HighlightedInput({ value, tokens, onValueChange, className, ...props }: HighlightedInputProps) {
  const backdrop = useRef<HTMLDivElement>(null)

  const segments: { text: string; kind?: TokenKind }[] = []
  let cursor = 0
  for (const token of tokens) {
    if (token.start > cursor) segments.push({ text: value.slice(cursor, token.start) })
    segments.push({ text: value.slice(token.start, token.end), kind: token.kind })
    cursor = token.end
  }
  if (cursor < value.length) segments.push({ text: value.slice(cursor) })

  return (
    <div className={cn('relative', className)}>
      <div ref={backdrop} aria-hidden="true" className={cn(TEXT, 'pointer-events-none absolute inset-0 overflow-hidden text-transparent')}>
        {segments.map((segment, index) =>
          segment.kind ? (
            <mark key={index} className={cn('rounded-sm text-transparent', TOKEN_COLOR[segment.kind])}>
              {segment.text}
            </mark>
          ) : (
            <span key={index}>{segment.text}</span>
          ),
        )}
      </div>

      <input
        {...props}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        // Em textos compridos o campo desliza; a camada de realce acompanha.
        onScroll={(event) => {
          if (backdrop.current) backdrop.current.scrollLeft = event.currentTarget.scrollLeft
        }}
        className={cn(TEXT, 'relative block w-full border-0 bg-transparent outline-none placeholder:text-muted-foreground')}
      />
    </div>
  )
}
