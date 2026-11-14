import { daysInMonth, nextWeekday, weekdayOf, type Match } from './dates'
import { toInt, type Word } from './normalize'

/** Regra no formato que a API aceita (subconjunto de RRULE). */
export interface Recurrence {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
  interval: number
  /** Dias da semana, 0 (domingo) a 6 (sábado). */
  byDay: number[]
  byMonthDay: number | null
}

const RRULE_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

export function toRRule({ freq, interval, byDay, byMonthDay }: Recurrence): string {
  const parts = [`FREQ=${freq}`]
  if (interval > 1) parts.push(`INTERVAL=${interval}`)
  // Por ordem de semana a começar na segunda, como a API devolve.
  if (byDay.length > 0) {
    const ordered = [...byDay].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
    parts.push(`BYDAY=${ordered.map((day) => RRULE_DAYS[day]).join(',')}`)
  }
  if (byMonthDay !== null) parts.push(`BYMONTHDAY=${byMonthDay}`)
  return parts.join(';')
}

const rule = (freq: Recurrence['freq'], extra: Partial<Recurrence> = {}): Recurrence => ({
  freq,
  interval: 1,
  byDay: [],
  byMonthDay: null,
  ...extra,
})

const UNITS: Record<string, Recurrence['freq']> = {
  dia: 'DAILY', dias: 'DAILY', semana: 'WEEKLY', semanas: 'WEEKLY',
  mes: 'MONTHLY', meses: 'MONTHLY', ano: 'YEARLY', anos: 'YEARLY',
}

const ADVERBS: Record<string, Recurrence['freq']> = {
  diariamente: 'DAILY', semanalmente: 'WEEKLY', mensalmente: 'MONTHLY', anualmente: 'YEARLY',
}

export function matchRecurrence(words: Word[], i: number): Match<Recurrence> | null {
  const at = (offset: number) => words[i + offset]?.norm
  const first = at(0)

  if (first !== undefined && first in ADVERBS) return { length: 1, value: rule(ADVERBS[first]) }

  // [a] cada [N] dias | semanas | meses | anos
  const cada = first === 'a' && at(1) === 'cada' ? 1 : first === 'cada' ? 0 : null
  if (cada !== null) {
    const amount = toInt(at(cada + 1))
    const unit = at(cada + (amount === null ? 1 : 2))
    if (unit !== undefined && unit in UNITS && (amount === null || amount >= 1)) {
      return { length: cada + (amount === null ? 2 : 3), value: rule(UNITS[unit], { interval: amount ?? 1 }) }
    }
    return null
  }

  // todo | toda | todos | todas [o | a | os | as] …
  if (first === undefined || !/^tod[oa]s?$/.test(first)) return null
  const start = /^[oa]s?$/.test(at(1) ?? '') ? 2 : 1
  const noun = at(start)

  if (noun === 'dia' || noun === 'dias') {
    const day = toInt(at(start + 1))
    if (day !== null) {
      return day >= 1 && day <= 31
        ? { length: start + 2, value: rule('MONTHLY', { byMonthDay: day }) }
        : null
    }
    if (at(start + 1) === 'uteis') {
      return { length: start + 2, value: rule('WEEKLY', { byDay: [1, 2, 3, 4, 5] }) }
    }
    return { length: start + 1, value: rule('DAILY') }
  }

  if (noun !== undefined && noun in UNITS) return { length: start + 1, value: rule(UNITS[noun]) }

  // todas as segundas [e quartas …]
  const weekday = weekdayOf(noun)
  if (weekday === null) return null

  const byDay = [weekday]
  let length = start + 1
  while (at(length) === 'e' && weekdayOf(at(length + 1)) !== null) {
    byDay.push(weekdayOf(at(length + 1))!)
    length += 2
  }

  return { length, value: rule('WEEKLY', { byDay: [...new Set(byDay)] }) }
}

/** A primeira ocorrência em ou depois de `today`, quando não foi escrita nenhuma data. */
export function firstOccurrence({ freq, byDay, byMonthDay }: Recurrence, today: Date): Date {
  if (freq === 'WEEKLY' && byDay.length > 0) {
    const candidates = byDay.map((day) => nextWeekday(today, day, true))
    return candidates.reduce((earliest, date) => (date < earliest ? date : earliest))
  }

  if (freq === 'MONTHLY' && byMonthDay !== null) {
    // Num mês mais curto, o dia pedido cai no último dia desse mês.
    for (let offset = 0; ; offset++) {
      const month = today.getUTCMonth() + offset
      const year = today.getUTCFullYear() + Math.floor(month / 12)
      const day = Math.min(byMonthDay, daysInMonth(year, month % 12))
      const candidate = new Date(Date.UTC(year, month % 12, day))
      if (candidate >= today) return candidate
    }
  }

  return today
}
