import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InboxPage } from './InboxPage'
import { useCreateTask } from './queries'
import type { NewTask, Task } from '@/lib/types'
import { makeTask } from '@/test/factories'
import { fakeApi } from '@/test/fake-api'
import { renderApp } from '@/test/render'

const TODAY = '2026-11-14'

/** Um servidor falso com estado: o que se conclui sai da lista, o que se cria sem projeto entra. */
function serve(initial: Task[], overrides: Parameters<typeof fakeApi>[0] = {}) {
  let tasks = [...initial]

  return fakeApi({
    'GET /tasks?view=inbox': () => ({ body: { data: tasks, meta: { today: TODAY } } }),
    'GET /labels': { data: [{ id: 'l1', name: 'urgente', color: '#808080' }] },
    'POST /tasks': ({ body }) => {
      const input = body as NewTask
      const created = makeTask({ id: input.id, title: input.title, due_date: input.due_date, position: 1000 })
      if (input.project_name === null) tasks = [...tasks, created]
      return { status: 201, body: { data: created } }
    },
    ...Object.fromEntries(
      initial.flatMap((task) => [
        [
          `POST /tasks/${task.id}/complete`,
          () => {
            tasks = tasks.filter((other) => other.id !== task.id)
            return { body: { data: { ...task, is_completed: true }, meta: { recurred: false } } }
          },
        ],
        [
          `POST /tasks/${task.id}/reopen`,
          () => {
            tasks = [...tasks, task]
            return { body: { data: task } }
          },
        ],
      ]),
    ),
    ...overrides,
  })
}

const newTask = (overrides: Partial<NewTask>): NewTask => ({
  id: crypto.randomUUID(),
  title: 'Nova',
  due_date: null,
  due_time: null,
  recurrence_rule: null,
  recurrence_text: null,
  priority: 4,
  project_name: null,
  label_names: [],
  ...overrides,
})

/** Um botão que cria uma tarefa, como o Quick Add faz. */
function CreateButton({ input }: { input: NewTask }) {
  const create = useCreateTask()
  return <button onClick={() => create.mutate(input)}>Criar</button>
}

describe('InboxPage', () => {
  it('mostra as tarefas sem data e as com data', async () => {
    serve([
      makeTask({ title: 'Sem data', label_ids: ['l1'] }),
      makeTask({ title: 'Para amanhã', due_date: '2026-11-15' }),
      makeTask({ title: 'Atrasada', due_date: '2026-11-10' }),
    ])
    renderApp(<InboxPage />)

    const undated = (await screen.findByText('Sem data')).closest('li')!
    expect(await within(undated).findByText('@urgente')).toBeInTheDocument()
    expect(within(screen.getByText('Para amanhã').closest('li')!).getByText('Amanhã')).toBeInTheDocument()
    expect(within(screen.getByText('Atrasada').closest('li')!).getByText('10 nov')).toBeInTheDocument()
  })

  it('mostra o estado vazio', async () => {
    serve([])
    renderApp(<InboxPage />)

    expect(await screen.findByText('A Caixa de Entrada está vazia.')).toBeInTheDocument()
  })

  it('concluir remove a tarefa de imediato e permite desfazer', async () => {
    const task = makeTask({ title: 'Comprar pão' })
    const server = serve([task])
    renderApp(<InboxPage />)

    await userEvent.click(await screen.findByRole('checkbox', { name: 'Concluir "Comprar pão"' }))

    expect(screen.queryByText('Comprar pão')).not.toBeInTheDocument()
    await waitFor(() => expect(server.callsTo(`POST /tasks/${task.id}/complete`)).toHaveLength(1))

    await userEvent.click(await screen.findByRole('button', { name: 'Desfazer' }))

    expect(await screen.findByText('Comprar pão')).toBeInTheDocument()
  })

  it('uma tarefa criada sem projeto aparece de imediato', async () => {
    const server = serve([makeTask({ title: 'Já cá estava' })])
    renderApp(
      <>
        <InboxPage />
        <CreateButton input={newTask({ title: 'Acabada de criar' })} />
      </>,
    )

    await screen.findByText('Já cá estava')
    await userEvent.click(screen.getByRole('button', { name: 'Criar' }))

    // Aparece antes de o servidor responder e continua lá depois.
    expect(screen.getByText('Acabada de criar')).toBeInTheDocument()
    await waitFor(() => expect(server.callsTo('GET /tasks?view=inbox')).toHaveLength(2))
    expect(await screen.findByText('Acabada de criar')).toBeInTheDocument()
  })

  it('uma tarefa criada com projeto não entra na Caixa de Entrada', async () => {
    const server = serve([makeTask({ title: 'Já cá estava' })])
    renderApp(
      <>
        <InboxPage />
        <CreateButton input={newTask({ title: 'Do projeto', project_name: 'Trabalho' })} />
      </>,
    )

    await screen.findByText('Já cá estava')
    await userEvent.click(screen.getByRole('button', { name: 'Criar' }))

    await waitFor(() => expect(server.callsTo('POST /tasks')).toHaveLength(1))
    expect(screen.queryByText('Do projeto')).not.toBeInTheDocument()
  })

  it('mostra um erro com nova tentativa quando a lista não carrega', async () => {
    let fail = true
    serve([], {
      'GET /tasks?view=inbox': () =>
        fail
          ? { status: 500, body: { message: 'Server Error' } }
          : { body: { data: [makeTask({ title: 'Recuperada' })], meta: { today: TODAY } } },
    })
    renderApp(<InboxPage />)

    expect(await screen.findByText('Não foi possível carregar as tarefas.')).toBeInTheDocument()

    fail = false
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))

    expect(await screen.findByText('Recuperada')).toBeInTheDocument()
  })
})
