import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TodayPage } from './TodayPage'
import type { Task } from '@/lib/types'
import { makeTask } from '@/test/factories'
import { fakeApi } from '@/test/fake-api'
import { renderApp } from '@/test/render'

const TODAY = '2026-11-14'

/** Um servidor falso com estado: o que se conclui ou apaga deixa de vir na lista. */
function serve(initial: Task[], overrides: Parameters<typeof fakeApi>[0] = {}) {
  let tasks = [...initial]
  const find = (path: string) => initial.find((task) => task.id === path.split('/')[2])!

  return fakeApi({
    'GET /tasks?view=today': () => ({ body: { data: tasks, meta: { today: TODAY } } }),
    'GET /projects': { data: [{ id: 'p1', name: 'Casa', color: '#808080' }] },
    'GET /labels': { data: [{ id: 'l1', name: 'urgente', color: '#808080' }] },
    ...Object.fromEntries(
      initial.flatMap((task) => [
        [
          `POST /tasks/${task.id}/complete`,
          ({ path }: { path: string }) => {
            tasks = tasks.filter((t) => t.id !== find(path).id)
            return { body: { data: { ...find(path), is_completed: true }, meta: { recurred: false } } }
          },
        ],
        [
          `POST /tasks/${task.id}/reopen`,
          ({ path }: { path: string }) => {
            tasks = [...tasks, find(path)]
            return { body: { data: find(path) } }
          },
        ],
        [
          `DELETE /tasks/${task.id}`,
          ({ path }: { path: string }) => {
            tasks = tasks.filter((t) => t.id !== find(path).id)
            return { status: 204 }
          },
        ],
        [
          `POST /tasks/${task.id}/restore`,
          ({ path }: { path: string }) => {
            tasks = [...tasks, find(path)]
            return { body: { data: find(path) } }
          },
        ],
      ]),
    ),
    'POST /tasks/reschedule': ({ body }) => {
      const { task_ids, due_date } = body as { task_ids: string[]; due_date: string }
      tasks = tasks.map((task) => (task_ids.includes(task.id) ? { ...task, due_date } : task))
      return { body: { data: tasks.filter((task) => task_ids.includes(task.id)) } }
    },
    ...overrides,
  })
}

const overdueSection = () => screen.getByRole('region', { name: 'Em atraso' })
const todaySection = () => screen.getByRole('region', { name: 'Hoje' })

describe('TodayPage', () => {
  it('separa as tarefas em atraso das de hoje', async () => {
    serve([
      makeTask({ title: 'Antiga', due_date: '2026-11-10' }),
      makeTask({ title: 'De hoje', due_date: TODAY }),
    ])
    renderApp(<TodayPage />)

    await screen.findByText('Antiga')
    expect(within(overdueSection()).getByText('Antiga')).toBeInTheDocument()
    expect(within(overdueSection()).getByText('10 nov')).toBeInTheDocument()
    expect(within(todaySection()).getByText('De hoje')).toBeInTheDocument()
    expect(within(todaySection()).queryByText('Antiga')).not.toBeInTheDocument()
    expect(screen.getByText('sábado, 14 de novembro')).toBeInTheDocument()
  })

  it('mostra hora, projeto, etiquetas e recorrência', async () => {
    serve([
      makeTask({
        title: 'Pagar renda',
        due_date: TODAY,
        due_time: '09:30',
        project_id: 'p1',
        label_ids: ['l1'],
        recurrence_rule: 'FREQ=MONTHLY;BYMONTHDAY=1',
        recurrence_text: 'todo dia 1',
        priority: 1,
      }),
    ])
    renderApp(<TodayPage />)

    const row = (await screen.findByText('Pagar renda')).closest('li')!
    expect(within(row).getByText('09:30')).toBeInTheDocument()
    expect(await within(row).findByText('Casa')).toBeInTheDocument()
    expect(within(row).getByText('@urgente')).toBeInTheDocument()
    expect(within(row).getByLabelText('Repete: todo dia 1')).toBeInTheDocument()
    expect(within(row).getByRole('checkbox', { name: 'Concluir "Pagar renda"' })).toHaveAttribute('data-priority', '1')
  })

  it('não mostra "Em atraso" quando não há tarefas atrasadas', async () => {
    serve([makeTask({ title: 'De hoje', due_date: TODAY })])
    renderApp(<TodayPage />)

    await screen.findByText('De hoje')
    expect(screen.queryByRole('region', { name: 'Em atraso' })).not.toBeInTheDocument()
  })

  it('mostra o estado vazio', async () => {
    serve([])
    renderApp(<TodayPage />)

    expect(await screen.findByText('Tudo feito por hoje.')).toBeInTheDocument()
  })

  it('concluir remove a tarefa de imediato e permite desfazer', async () => {
    const task = makeTask({ title: 'Comprar pão', due_date: TODAY })
    const server = serve([task])
    renderApp(<TodayPage />)

    await userEvent.click(await screen.findByRole('checkbox', { name: 'Concluir "Comprar pão"' }))

    expect(screen.queryByText('Comprar pão')).not.toBeInTheDocument()
    expect(await screen.findByText('Tarefa concluída')).toBeInTheDocument()
    await waitFor(() => expect(server.callsTo(`POST /tasks/${task.id}/complete`)).toHaveLength(1))

    await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }))

    expect(await screen.findByText('Comprar pão')).toBeInTheDocument()
    await waitFor(() => expect(server.callsTo(`POST /tasks/${task.id}/reopen`)).toHaveLength(1))
  })

  it('apagar remove a tarefa de imediato e permite desfazer', async () => {
    const task = makeTask({ title: 'Comprar pão', due_date: TODAY })
    const server = serve([task])
    renderApp(<TodayPage />)

    await userEvent.click(await screen.findByRole('button', { name: 'Apagar "Comprar pão"' }))

    expect(screen.queryByText('Comprar pão')).not.toBeInTheDocument()
    expect(await screen.findByText('Tarefa apagada')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }))

    expect(await screen.findByText('Comprar pão')).toBeInTheDocument()
    await waitFor(() => expect(server.callsTo(`POST /tasks/${task.id}/restore`)).toHaveLength(1))
  })

  it('reagenda todas as tarefas em atraso para hoje', async () => {
    const [a, b] = [
      makeTask({ title: 'Antiga A', due_date: '2026-11-10' }),
      makeTask({ title: 'Antiga B', due_date: '2026-11-12' }),
    ]
    const server = serve([a, b, makeTask({ title: 'De hoje', due_date: TODAY })])
    renderApp(<TodayPage />)

    await userEvent.click(await screen.findByRole('button', { name: 'Reagendar para hoje' }))

    expect(screen.queryByRole('region', { name: 'Em atraso' })).not.toBeInTheDocument()
    expect(within(todaySection()).getByText('Antiga A')).toBeInTheDocument()
    expect(within(todaySection()).getByText('Antiga B')).toBeInTheDocument()
    await waitFor(() =>
      expect(server.callsTo('POST /tasks/reschedule')[0].body).toEqual({ task_ids: [a.id, b.id], due_date: TODAY }),
    )
  })

  it('se concluir falhar, a tarefa volta e aparece um aviso', async () => {
    const task = makeTask({ title: 'Comprar pão', due_date: TODAY })
    serve([task], { [`POST /tasks/${task.id}/complete`]: () => ({ status: 500, body: { message: 'Server Error' } }) })
    renderApp(<TodayPage />)

    await userEvent.click(await screen.findByRole('checkbox', { name: 'Concluir "Comprar pão"' }))

    expect(await screen.findByText('Não foi possível guardar. Tenta de novo.')).toBeInTheDocument()
    expect(await screen.findByText('Comprar pão')).toBeInTheDocument()
    expect(screen.queryByText('Tarefa concluída')).not.toBeInTheDocument()
  })

  it('se apagar falhar, a tarefa volta e aparece um aviso', async () => {
    const task = makeTask({ title: 'Comprar pão', due_date: TODAY })
    serve([task], { [`DELETE /tasks/${task.id}`]: () => ({ status: 500, body: { message: 'Server Error' } }) })
    renderApp(<TodayPage />)

    await userEvent.click(await screen.findByRole('button', { name: 'Apagar "Comprar pão"' }))

    expect(await screen.findByText('Não foi possível guardar. Tenta de novo.')).toBeInTheDocument()
    expect(await screen.findByText('Comprar pão')).toBeInTheDocument()
  })

  it('se reagendar falhar, as tarefas voltam a "Em atraso"', async () => {
    serve([makeTask({ title: 'Antiga', due_date: '2026-11-10' })], {
      'POST /tasks/reschedule': () => ({ status: 500, body: { message: 'Server Error' } }),
    })
    renderApp(<TodayPage />)

    await userEvent.click(await screen.findByRole('button', { name: 'Reagendar para hoje' }))

    expect(await screen.findByText('Não foi possível guardar. Tenta de novo.')).toBeInTheDocument()
    expect(await within(await screen.findByRole('region', { name: 'Em atraso' })).findByText('Antiga')).toBeInTheDocument()
  })

  it('mostra um erro com nova tentativa quando a lista não carrega', async () => {
    let fail = true
    serve([makeTask({ title: 'De hoje', due_date: TODAY })], {
      'GET /tasks?view=today': () =>
        fail
          ? { status: 500, body: { message: 'Server Error' } }
          : { body: { data: [makeTask({ title: 'Recuperada', due_date: TODAY })], meta: { today: TODAY } } },
    })
    renderApp(<TodayPage />)

    expect(await screen.findByText('Não foi possível carregar as tarefas.')).toBeInTheDocument()

    fail = false
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))

    expect(await screen.findByText('Recuperada')).toBeInTheDocument()
  })
})
