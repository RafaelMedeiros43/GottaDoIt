import { formatDayLabel, formatLongDate, todayInTimezone } from './dates'

describe('datas', () => {
  it('escreve a data por extenso em português', () => {
    expect(formatLongDate('2026-11-14')).toBe('sábado, 14 de novembro')
  })

  it('descreve um dia em relação a hoje', () => {
    expect(formatDayLabel('2026-11-14', '2026-11-14')).toBe('Hoje')
    expect(formatDayLabel('2026-11-15', '2026-11-14')).toBe('Amanhã')
    expect(formatDayLabel('2026-11-13', '2026-11-14')).toBe('Ontem')
    expect(formatDayLabel('2026-11-10', '2026-11-14')).toBe('10 nov')
    expect(formatDayLabel('2027-01-05', '2026-11-14')).toBe('5 jan 2027')
  })

  it('calcula a data de hoje num fuso horário', () => {
    const instant = new Date('2026-11-14T12:00:00Z')

    expect(todayInTimezone('Pacific/Auckland', instant)).toBe('2026-11-15')
    expect(todayInTimezone('America/Los_Angeles', new Date('2026-11-14T03:00:00Z'))).toBe('2026-11-13')
  })
})
