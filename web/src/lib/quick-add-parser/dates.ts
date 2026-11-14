import { toInt, type Word } from './normalize'

/** Resultado de um reconhecedor: quantas palavras consumiu e o valor extraído. */
export interface Match<T> {
  length: number
  value: T
  /**
   * A palavra também tem outro sentido ("segunda via", "quarta versão"):
   * só conta como data no fim da frase ou antes de outro marcador.
   */
  ambiguous?: boolean
}

/** Dias da semana que também são numerais ordinais. */
const ORDINAL_WEEKDAYS = new Set(['segunda', 'terca', 'quarta', 'quinta', 'sexta'])

// As datas são tratadas como dias de calendário em UTC, sem horas nem fusos.

export function fromISO(date: string): Date {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

export function toISO(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000)
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

/** Data válida, ou null (31/02 não existe). */
function makeDate(year: number, month: number, day: number): Date | null {
  if (month < 0 || month > 11 || day < 1 || day > daysInMonth(year, month)) return null
  return new Date(Date.UTC(year, month, day))
}

const WEEKDAYS: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  terca: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sabado: 6,
}

/** "segunda", "segunda-feira", "segundas", "sábados" → 0 (domingo) a 6 (sábado). */
export function weekdayOf(norm: string | undefined): number | null {
  if (norm === undefined) return null
  const base = norm.replace(/-feiras?$/, '')
  return WEEKDAYS[base] ?? WEEKDAYS[base.replace(/s$/, '')] ?? null
}

const MONTHS: Record<string, number> = {
  janeiro: 0, jan: 0, fevereiro: 1, fev: 1, marco: 2, mar: 2, abril: 3, abr: 3, maio: 4, mai: 4,
  junho: 5, jun: 5, julho: 6, jul: 6, agosto: 7, ago: 7, setembro: 8, set: 8, outubro: 9, out: 9,
  novembro: 10, nov: 10, dezembro: 11, dez: 11,
}

/** O próximo dia da semana `weekday`; `inclusive` aceita o próprio dia. */
export function nextWeekday(from: Date, weekday: number, inclusive: boolean): Date {
  const ahead = (weekday - from.getUTCDay() + 7) % 7
  return addDays(from, ahead === 0 && !inclusive ? 7 : ahead)
}

/** O próximo dia `day` do mês, a contar de hoje (inclusive). Salta meses que não o têm. */
export function nextMonthDay(from: Date, day: number): Date | null {
  if (day < 1 || day > 31) return null

  for (let offset = 0; offset < 13; offset++) {
    const month = from.getUTCMonth() + offset
    const candidate = makeDate(from.getUTCFullYear() + Math.floor(month / 12), month % 12, day)
    if (candidate && candidate >= from) return candidate
  }

  return null
}

const DATE_PREPOSITIONS = new Set(['na', 'no', 'em', 'para', 'pra', 'ate'])

function matchBareDate(words: Word[], i: number, today: Date, weekStart: 0 | 1): Match<Date> | null {
  const [a, b, c, d, e] = [0, 1, 2, 3, 4].map((offset) => words[i + offset]?.norm)

  if (a === 'hoje') return { length: 1, value: today }
  if (a === 'amanha') return { length: 1, value: addDays(today, 1) }
  if (a === 'depois' && b === 'de' && c === 'amanha') return { length: 3, value: addDays(today, 2) }

  const isNext = a === 'proxima' || a === 'proximo'

  if (isNext && b === 'semana') return { length: 2, value: nextWeekday(today, weekStart, false) }

  const weekday = weekdayOf(isNext ? b : a)
  if (weekday !== null) {
    return {
      length: isNext ? 2 : 1,
      value: nextWeekday(today, weekday, false),
      ambiguous: !isNext && ORDINAL_WEEKDAYS.has(a!),
    }
  }

  if (a === 'dia') {
    const date = nextMonthDay(today, toInt(b) ?? 0)
    return date && { length: 2, value: date }
  }

  // 15/03 ou 15/03/2027
  const slash = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/.exec(a ?? '')
  if (slash) {
    const [day, month] = [Number(slash[1]), Number(slash[2]) - 1]
    const date = slash[3] ? makeDate(Number(slash[3]), month, day) : nextYearly(today, month, day)
    return date && { length: 1, value: date }
  }

  // 15 de março [de 2027]
  const day = toInt(a)
  if (day !== null && b === 'de' && c !== undefined && c in MONTHS) {
    const year = d === 'de' && /^\d{4}$/.test(e ?? '') ? Number(e) : null
    const date = year ? makeDate(year, MONTHS[c], day) : nextYearly(today, MONTHS[c], day)
    return date && { length: year ? 5 : 3, value: date }
  }

  // daqui a 3 dias | semanas | meses
  if (a === 'daqui' && b === 'a') {
    const amount = toInt(c)
    if (amount !== null && /^dias?$/.test(d ?? '')) return { length: 4, value: addDays(today, amount) }
    if (amount !== null && /^semanas?$/.test(d ?? '')) return { length: 4, value: addDays(today, amount * 7) }
  }

  return null
}

/** O dia/mês deste ano se ainda não passou; senão, do ano seguinte. */
function nextYearly(today: Date, month: number, day: number): Date | null {
  const thisYear = makeDate(today.getUTCFullYear(), month, day)
  if (thisYear && thisYear >= today) return thisYear
  return makeDate(today.getUTCFullYear() + 1, month, day)
}

/** Data, com a preposição que a anteceda ("na sexta", "até amanhã", "no dia 20"). */
export function matchDate(words: Word[], i: number, today: Date, weekStart: 0 | 1): Match<Date> | null {
  if (DATE_PREPOSITIONS.has(words[i].norm) && i + 1 < words.length) {
    const match = matchBareDate(words, i + 1, today, weekStart)
    // Com preposição ("na sexta") já não há dúvida.
    if (match) return { length: match.length + 1, value: match.value }
  }

  return matchBareDate(words, i, today, weekStart)
}

const TIME_PREPOSITIONS = new Set(['as', 'a', 'ao', 'pelas'])

function formatTime(hours: number, minutes: number): string | null {
  if (hours > 23 || minutes > 59) return null
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

/** "da manhã" | "da tarde" | "da noite" a seguir à hora. */
function periodAt(words: Word[], i: number): 'manha' | 'tarde' | 'noite' | null {
  const period = words[i + 1]?.norm
  if (words[i]?.norm !== 'da') return null
  return period === 'manha' || period === 'tarde' || period === 'noite' ? period : null
}

function matchBareTime(words: Word[], i: number, afterPreposition: boolean): Match<string> | null {
  const word = words[i].norm

  if (word === 'meio-dia') return { length: 1, value: '12:00' }
  if (word === 'meia-noite') return { length: 1, value: '00:00' }

  // 15h, 15h30, 15:30 — ou um número seguido de "da manhã/tarde/noite"
  const clock = /^(\d{1,2})(?:h(\d{2})?|:(\d{2}))$/.exec(word)
  const bare = clock ? null : toInt(word)
  if (!clock && bare === null) return null

  let hours = clock ? Number(clock[1]) : bare!
  const minutes = Number(clock?.[2] ?? clock?.[3] ?? 0)
  const period = periodAt(words, i + 1)

  if (!clock && !period) return null
  if (period && hours > 12) return null
  // "Estudar 2h" é uma duração; "às 2h", "2h30" e "15h" são horas.
  const looksLikeDuration = clock !== null && clock[2] === undefined && clock[3] === undefined && hours >= 1 && hours <= 6
  if (looksLikeDuration && !period && !afterPreposition) return null

  if ((period === 'tarde' || period === 'noite') && hours < 12) hours += 12

  const value = formatTime(hours, minutes)
  return value === null ? null : { length: period ? 3 : 1, value }
}

/** Hora, com a preposição que a anteceda ("às 15h", "ao meio-dia"). */
export function matchTime(words: Word[], i: number): Match<string> | null {
  if (TIME_PREPOSITIONS.has(words[i].norm) && i + 1 < words.length) {
    const match = matchBareTime(words, i + 1, true)
    if (match) return { length: match.length + 1, value: match.value }
  }

  return matchBareTime(words, i, false)
}
