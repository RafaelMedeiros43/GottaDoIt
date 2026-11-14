import { fromISO, matchDate, matchTime, toISO } from './dates'
import { normalize, splitWords, type Word } from './normalize'
import { firstOccurrence, matchRecurrence, toRRule, type Recurrence } from './recurrence'

export type TokenKind = 'date' | 'time' | 'recurrence' | 'project' | 'label' | 'priority'

/** Um pedaço reconhecido do texto, com a posição no texto original. */
export interface Token {
  kind: TokenKind
  start: number
  end: number
  text: string
}

export interface ParsedQuickAdd {
  /** O texto sem os pedaços reconhecidos. */
  title: string
  /** YYYY-MM-DD */
  dueDate: string | null
  /** HH:MM */
  dueTime: string | null
  /** Subconjunto de RRULE, por exemplo "FREQ=WEEKLY;BYDAY=MO". */
  recurrenceRule: string | null
  /** O que o utilizador escreveu, por exemplo "toda segunda-feira". */
  recurrenceText: string | null
  projectName: string | null
  labelNames: string[]
  priority: 1 | 2 | 3 | 4 | null
  /** Por ordem de posição. */
  tokens: Token[]
}

export interface ParseOptions {
  /** Primeiro dia da semana: 0 domingo, 1 segunda (por omissão). */
  weekStart?: 0 | 1
}

type Value = Date | string | number | Recurrence

interface Found {
  kind: TokenKind
  first: number
  length: number
  value: Value
}

const NAME = String.raw`[\p{L}\p{N}_-]+`
const PROJECT = new RegExp(`^#(${NAME})$`, 'u')
const LABEL = new RegExp(`^@(${NAME})$`, 'u')
const PRIORITY = /^p([1-4])$/i

/** Tenta reconhecer um marcador a começar na palavra `i`. A ordem importa. */
function matchAt(words: Word[], i: number, today: Date, weekStart: 0 | 1): Omit<Found, 'first'> | null {
  const raw = words[i].raw

  const project = PROJECT.exec(raw)
  if (project) return { kind: 'project', length: 1, value: project[1] }

  const label = LABEL.exec(raw)
  if (label) return { kind: 'label', length: 1, value: label[1] }

  const priority = PRIORITY.exec(raw)
  if (priority) return { kind: 'priority', length: 1, value: Number(priority[1]) }

  // Recorrência antes de data: "todo dia 1" contém "dia 1".
  const recurrence = matchRecurrence(words, i)
  if (recurrence) return { kind: 'recurrence', ...recurrence }

  const date = matchDate(words, i, today, weekStart)
  if (date) return { kind: 'date', ...date }

  const time = matchTime(words, i)
  if (time) return { kind: 'time', ...time }

  return null
}

/**
 * Extrai data, hora, recorrência, #projeto, @etiquetas e prioridade de um
 * texto em português.
 *
 * @param today a data de hoje no fuso do utilizador, "YYYY-MM-DD"
 */
export function parseQuickAdd(input: string, today: string, opts: ParseOptions = {}): ParsedQuickAdd {
  const todayDate = fromISO(today)
  const words = splitWords(input)
  const found: Found[] = []

  for (let i = 0; i < words.length; ) {
    const match = matchAt(words, i, todayDate, opts.weekStart ?? 1)
    if (match) found.push({ ...match, first: i })
    i += match?.length ?? 1
  }

  // De cada tipo vale o último; os anteriores ficam como texto. As etiquetas acumulam.
  const kept = found.filter(
    (item, index) => item.kind === 'label' || !found.slice(index + 1).some((later) => later.kind === item.kind),
  )
  const valueOf = <T extends Value>(kind: TokenKind) => kept.find((item) => item.kind === kind)?.value as T | undefined

  const tokens: Token[] = kept.map(({ kind, first, length }) => {
    const [start, end] = [words[first].start, words[first + length - 1].end]
    return { kind, start, end, text: input.slice(start, end) }
  })

  let title = ''
  let cursor = 0
  for (const token of tokens) {
    title += input.slice(cursor, token.start)
    cursor = token.end
  }
  title = (title + input.slice(cursor)).replace(/\s+/g, ' ').trim()

  const recurrence = valueOf<Recurrence>('recurrence')
  const date = valueOf<Date>('date')
  const time = valueOf<string>('time')
  const dueDate = date ?? (recurrence ? firstOccurrence(recurrence, todayDate) : time ? todayDate : null)

  const labelNames: string[] = []
  for (const item of kept) {
    const name = item.value as string
    if (item.kind === 'label' && !labelNames.some((existing) => normalize(existing) === normalize(name))) {
      labelNames.push(name)
    }
  }

  return {
    title,
    dueDate: dueDate ? toISO(dueDate) : null,
    dueTime: time ?? null,
    recurrenceRule: recurrence ? toRRule(recurrence) : null,
    recurrenceText: tokens.find((token) => token.kind === 'recurrence')?.text ?? null,
    projectName: valueOf<string>('project') ?? null,
    labelNames,
    priority: (valueOf<number>('priority') as ParsedQuickAdd['priority']) ?? null,
    tokens,
  }
}
