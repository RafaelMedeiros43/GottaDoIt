// `due_date` é um dia de calendário ("YYYY-MM-DD"), sem hora nem fuso.
// Para o formatar, é lido como meio-dia UTC, para nunca saltar de dia.

function asDate(day: string): Date {
  return new Date(`${day}T12:00:00Z`)
}

const LONG = new Intl.DateTimeFormat('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })

/** "sábado, 14 de novembro" */
export function formatLongDate(day: string): string {
  return LONG.format(asDate(day))
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** "Hoje", "Amanhã", "Ontem", "10 nov" ou "5 jan 2027". */
export function formatDayLabel(day: string, today: string): string {
  const difference = Math.round((asDate(day).getTime() - asDate(today).getTime()) / 86_400_000)
  if (difference === 0) return 'Hoje'
  if (difference === 1) return 'Amanhã'
  if (difference === -1) return 'Ontem'

  const [year, month, date] = day.split('-').map(Number)
  const label = `${date} ${MONTHS[month - 1]}`
  return year === Number(today.slice(0, 4)) ? label : `${label} ${year}`
}

/** A data de hoje ("YYYY-MM-DD") num fuso horário IANA. */
export function todayInTimezone(timezone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(now)
}
