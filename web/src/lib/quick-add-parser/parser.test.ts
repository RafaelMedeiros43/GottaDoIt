import { describe, expect, it, test } from 'vitest'
import { parseQuickAdd } from './index'

// 2026-11-14 é um sábado.
const TODAY = '2026-11-14'
const parse = (input: string, opts?: { weekStart?: 0 | 1 }) => parseQuickAdd(input, TODAY, opts)

describe('exemplo completo', () => {
  const input = 'Reunião amanhã às 15h #Trabalho @urgente p1'
  const result = parse(input)

  it('extrai todos os campos', () => {
    expect(result).toMatchObject({
      title: 'Reunião',
      dueDate: '2026-11-15',
      dueTime: '15:00',
      recurrenceRule: null,
      recurrenceText: null,
      projectName: 'Trabalho',
      labelNames: ['urgente'],
      priority: 1,
    })
  })

  it('devolve a posição de cada marcador no texto original', () => {
    expect(result.tokens.map((t) => [t.kind, input.slice(t.start, t.end)])).toEqual([
      ['date', 'amanhã'],
      ['time', 'às 15h'],
      ['project', '#Trabalho'],
      ['label', '@urgente'],
      ['priority', 'p1'],
    ])
    expect(result.tokens.every((t) => t.text === input.slice(t.start, t.end))).toBe(true)
  })
})

describe('datas', () => {
  test.each([
    ['hoje', '2026-11-14'],
    ['amanhã', '2026-11-15'],
    ['amanha', '2026-11-15'],
    ['AMANHÃ', '2026-11-15'],
    ['depois de amanhã', '2026-11-16'],
    ['próxima sexta', '2026-11-20'],
    ['proxima sexta', '2026-11-20'],
    ['sexta-feira', '2026-11-20'],
    ['sexta', '2026-11-20'],
    ['domingo', '2026-11-15'],
    ['sábado', '2026-11-21'],
    ['próximo sábado', '2026-11-21'],
    ['dia 15', '2026-11-15'],
    ['dia 14', '2026-11-14'],
    ['dia 10', '2026-12-10'],
    ['dia 31', '2026-12-31'],
    ['15/03', '2027-03-15'],
    ['20/11', '2026-11-20'],
    ['05/01/2028', '2028-01-05'],
    ['15 de março', '2027-03-15'],
    ['1 de dezembro', '2026-12-01'],
    ['3 de janeiro de 2028', '2028-01-03'],
    ['daqui a 3 dias', '2026-11-17'],
    ['daqui a 2 semanas', '2026-11-28'],
    ['próxima semana', '2026-11-16'],
  ])('"%s" → %s', (phrase, expected) => {
    const result = parse(`Entregar relatório ${phrase}`)
    expect(result.dueDate).toBe(expected)
    expect(result.title).toBe('Entregar relatório')
  })

  it('próxima semana respeita o início de semana do utilizador', () => {
    expect(parse('rever próxima semana', { weekStart: 0 }).dueDate).toBe('2026-11-15')
    expect(parse('rever próxima semana', { weekStart: 1 }).dueDate).toBe('2026-11-16')
  })

  it('absorve a preposição antes da data', () => {
    expect(parse('Reunião na sexta').title).toBe('Reunião')
    expect(parse('Entregar até amanhã').title).toBe('Entregar')
    expect(parse('Jantar no dia 20').title).toBe('Jantar')
    expect(parse('Enviar para amanhã')).toMatchObject({ title: 'Enviar', dueDate: '2026-11-15' })
  })

  it('ignora datas impossíveis', () => {
    expect(parse('reunião 31/02')).toMatchObject({ title: 'reunião 31/02', dueDate: null })
    expect(parse('sala dia 40')).toMatchObject({ title: 'sala dia 40', dueDate: null })
  })

  it('atravessa o fim do ano', () => {
    expect(parseQuickAdd('x amanhã', '2026-12-31').dueDate).toBe('2027-01-01')
    expect(parseQuickAdd('x segunda', '2026-12-31').dueDate).toBe('2027-01-04')
  })

  it('aceita pontuação a seguir ao marcador', () => {
    expect(parse('Ligar amanhã, sem falta')).toMatchObject({ title: 'Ligar , sem falta', dueDate: '2026-11-15' })
  })
})

describe('horas', () => {
  test.each([
    ['15h', '15:00'],
    ['15h30', '15:30'],
    ['15:30', '15:30'],
    ['9h', '09:00'],
    ['às 15h', '15:00'],
    ['as 15h', '15:00'],
    ['às 9 da manhã', '09:00'],
    ['às 9 da noite', '21:00'],
    ['às 3 da tarde', '15:00'],
    ['8h da noite', '20:00'],
    ['ao meio-dia', '12:00'],
    ['meio-dia', '12:00'],
    ['à meia-noite', '00:00'],
  ])('"%s" → %s', (phrase, expected) => {
    const result = parse(`ligar ${phrase}`)
    expect(result.dueTime).toBe(expected)
    expect(result.title).toBe('ligar')
  })

  it('hora sem data marca para hoje', () => {
    expect(parse('ligar às 15h').dueDate).toBe('2026-11-14')
  })

  it('ignora horas impossíveis e números soltos', () => {
    expect(parse('aberto 24h')).toMatchObject({ title: 'aberto 24h', dueTime: null, dueDate: null })
    expect(parse('rever as 3 tarefas')).toMatchObject({ title: 'rever as 3 tarefas', dueTime: null })
    expect(parse('reunião 15:75').dueTime).toBeNull()
  })
})

describe('recorrência', () => {
  test.each([
    ['Treinar a cada 2 dias', 'Treinar', 'FREQ=DAILY;INTERVAL=2', '2026-11-14', 'a cada 2 dias'],
    ['Pagar renda todo dia 1', 'Pagar renda', 'FREQ=MONTHLY;BYMONTHDAY=1', '2026-12-01', 'todo dia 1'],
    ['Renda todos os dias 20', 'Renda', 'FREQ=MONTHLY;BYMONTHDAY=20', '2026-11-20', 'todos os dias 20'],
    ['Relatório toda segunda-feira', 'Relatório', 'FREQ=WEEKLY;BYDAY=MO', '2026-11-16', 'toda segunda-feira'],
    ['Lixo todas as sextas', 'Lixo', 'FREQ=WEEKLY;BYDAY=FR', '2026-11-20', 'todas as sextas'],
    ['Feira todos os sábados', 'Feira', 'FREQ=WEEKLY;BYDAY=SA', '2026-11-14', 'todos os sábados'],
    ['Ginásio todas as segundas e quartas', 'Ginásio', 'FREQ=WEEKLY;BYDAY=MO,WE', '2026-11-16', 'todas as segundas e quartas'],
    ['Meditar todos os dias', 'Meditar', 'FREQ=DAILY', '2026-11-14', 'todos os dias'],
    ['Meditar diariamente', 'Meditar', 'FREQ=DAILY', '2026-11-14', 'diariamente'],
    ['Rever todas as semanas', 'Rever', 'FREQ=WEEKLY', '2026-11-14', 'todas as semanas'],
    ['Contas todos os meses', 'Contas', 'FREQ=MONTHLY', '2026-11-14', 'todos os meses'],
    ['IRS todos os anos', 'IRS', 'FREQ=YEARLY', '2026-11-14', 'todos os anos'],
    ['Regar a cada 2 semanas', 'Regar', 'FREQ=WEEKLY;INTERVAL=2', '2026-11-14', 'a cada 2 semanas'],
    ['Filtro a cada 3 meses', 'Filtro', 'FREQ=MONTHLY;INTERVAL=3', '2026-11-14', 'a cada 3 meses'],
    ['Standup todos os dias úteis', 'Standup', 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', '2026-11-16', 'todos os dias úteis'],
  ])('"%s"', (input, title, rule, dueDate, text) => {
    expect(parse(input)).toMatchObject({ title, recurrenceRule: rule, dueDate, recurrenceText: text })
  })

  it('combina recorrência com hora', () => {
    expect(parse('Relatório toda segunda-feira às 9h')).toMatchObject({
      title: 'Relatório',
      recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO',
      dueDate: '2026-11-16',
      dueTime: '09:00',
    })
  })

  it('uma data explícita define a primeira ocorrência', () => {
    expect(parse('Treinar a cada 2 dias amanhã')).toMatchObject({
      recurrenceRule: 'FREQ=DAILY;INTERVAL=2',
      dueDate: '2026-11-15',
    })
  })

  it('dia do mês inexistente cai no último dia do mês', () => {
    expect(parseQuickAdd('Fecho todo dia 31', '2027-02-10')).toMatchObject({
      recurrenceRule: 'FREQ=MONTHLY;BYMONTHDAY=31',
      dueDate: '2027-02-28',
    })
  })
})

describe('projetos, etiquetas e prioridade', () => {
  it('aceita várias etiquetas e remove duplicadas', () => {
    expect(parse('x @casa @urgente @Casa').labelNames).toEqual(['casa', 'urgente'])
  })

  it('aceita letras acentuadas, dígitos, _ e -', () => {
    expect(parse('x #Inglês-B2 @não_esquecer')).toMatchObject({
      title: 'x',
      projectName: 'Inglês-B2',
      labelNames: ['não_esquecer'],
    })
  })

  it('aceita prioridade em maiúsculas e em qualquer posição', () => {
    expect(parse('P2 comprar pão')).toMatchObject({ title: 'comprar pão', priority: 2 })
  })

  it('quando há vários do mesmo tipo vale o último e os outros ficam no título', () => {
    expect(parse('a #Casa b #Trabalho p1 p3')).toMatchObject({
      title: 'a #Casa b p1',
      projectName: 'Trabalho',
      priority: 3,
    })
    expect(parse('comprar hoje para entregar amanhã')).toMatchObject({
      title: 'comprar hoje para entregar',
      dueDate: '2026-11-15',
    })
  })
})

describe('texto que não deve ser interpretado', () => {
  test.each([
    'escrever a ana@mail.com',
    'estudar C#',
    'ver http://x.pt/#topo',
    'comprar p10',
    'sp1 instalar',
    'hojeira',
    'issue #',
    'falar com @',
    'p5',
    'amanhãs que cantam',
    'ler 1984',
  ])('"%s"', (input) => {
    const result = parse(input)
    expect(result.tokens).toEqual([])
    expect(result.title).toBe(input)
    expect(result).toMatchObject({ dueDate: null, dueTime: null, projectName: null, labelNames: [], priority: null })
  })
})

describe('casos limite', () => {
  it('só marcadores deixa o título vazio', () => {
    expect(parse('amanhã p1')).toMatchObject({ title: '', dueDate: '2026-11-15', priority: 1 })
  })

  it('texto vazio', () => {
    expect(parse('   ')).toEqual({
      title: '',
      dueDate: null,
      dueTime: null,
      recurrenceRule: null,
      recurrenceText: null,
      projectName: null,
      labelNames: [],
      priority: null,
      tokens: [],
    })
  })

  it('normaliza os espaços do título', () => {
    expect(parse('  Comprar   pão   amanhã  ').title).toBe('Comprar pão')
  })
})

describe('palavras ambíguas', () => {
  it('um dia da semana a meio da frase é texto ("segunda via")', () => {
    for (const input of ['Pedir segunda via da fatura', 'Rever quarta versão do contrato', 'sexta tentativa de ligar']) {
      expect(parse(input)).toMatchObject({ title: input, dueDate: null, tokens: [] })
    }
  })

  it('um dia da semana conta no fim da frase ou antes de outro marcador', () => {
    expect(parse('Reunião segunda')).toMatchObject({ title: 'Reunião', dueDate: '2026-11-16' })
    expect(parse('Reunião segunda às 15h')).toMatchObject({ title: 'Reunião', dueDate: '2026-11-16', dueTime: '15:00' })
    expect(parse('Dentista quarta #Saúde p2')).toMatchObject({ title: 'Dentista', dueDate: '2026-11-18' })
  })

  it('as formas sem ambiguidade contam em qualquer posição', () => {
    expect(parse('segunda-feira rever plano')).toMatchObject({ title: 'rever plano', dueDate: '2026-11-16' })
    expect(parse('na sexta rever plano')).toMatchObject({ title: 'rever plano', dueDate: '2026-11-20' })
    expect(parse('próxima terça rever plano')).toMatchObject({ title: 'rever plano', dueDate: '2026-11-17' })
    expect(parse('domingo limpar a casa')).toMatchObject({ title: 'limpar a casa', dueDate: '2026-11-15' })
  })

  it('poucas horas sem "às" são uma duração, não uma hora', () => {
    expect(parse('Estudar 2h')).toMatchObject({ title: 'Estudar 2h', dueTime: null, dueDate: null })
    expect(parse('Caminhada 1h #Saúde')).toMatchObject({ title: 'Caminhada 1h', dueTime: null })
  })

  it('mas contam com "às", com minutos ou a partir das 7h', () => {
    expect(parse('Acordar às 6h').dueTime).toBe('06:00')
    expect(parse('Treino 6h30').dueTime).toBe('06:30')
    expect(parse('Reunião 15h').dueTime).toBe('15:00')
    expect(parse('Pequeno-almoço 7h').dueTime).toBe('07:00')
    expect(parse('Voo 5 da manhã').dueTime).toBe('05:00')
  })
})
