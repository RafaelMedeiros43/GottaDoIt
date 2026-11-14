import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { QuickAddDialog } from './QuickAddDialog'
import { useQuickAddShortcut } from './useQuickAddShortcut'
import { tokenStore } from '@/lib/api'
import { fakeApi } from '@/test/fake-api'
import { renderApp } from '@/test/render'

const TODAY = '2026-11-14'
const USER = { id: 'u1', name: 'Ana', email: 'ana@example.com', timezone: 'Europe/Lisbon', week_start: 1, theme: 'system' }

function Harness() {
  const [open, setOpen] = useState(false)
  useQuickAddShortcut(() => setOpen(true))

  return (
    <>
      <input aria-label="Outro campo" />
      <QuickAddDialog open={open} onOpenChange={setOpen} />
    </>
  )
}

function setup(overrides: Parameters<typeof fakeApi>[0] = {}) {
  tokenStore.set('tok')
  const server = fakeApi({
    'GET /me': { data: USER },
    'GET /tasks?view=today': { data: [], meta: { today: TODAY } },
    'GET /projects': { data: [{ id: 'p1', name: 'Trabalho', color: '#808080' }] },
    'GET /labels': { data: [{ id: 'l1', name: 'urgente', color: '#808080' }] },
    'POST /tasks': ({ body }) => ({ status: 201, body: { data: body } }),
    ...overrides,
  })
  renderApp(<Harness />)

  return server
}

const dialog = () => screen.queryByRole('dialog', { name: 'Adicionar tarefa' })
const field = () => screen.findByRole('textbox', { name: 'Tarefa' })

async function openWithShortcut() {
  await userEvent.keyboard('q')
  return field()
}

describe('QuickAddDialog', () => {
  it('abre com Q, mas não quando se está a escrever noutro campo', async () => {
    setup()

    await userEvent.click(screen.getByLabelText('Outro campo'))
    await userEvent.keyboard('q')
    expect(dialog()).not.toBeInTheDocument()
    expect(screen.getByLabelText('Outro campo')).toHaveValue('q')

    await userEvent.click(document.body)
    await userEvent.keyboard('q')
    expect(await field()).toHaveValue('')
  })

  it('abre com Ctrl+K mesmo a partir de outro campo', async () => {
    setup()

    await userEvent.click(screen.getByLabelText('Outro campo'))
    await userEvent.keyboard('{Control>}k{/Control}')

    expect(await field()).toHaveFocus()
  })

  it('não abre com Q acompanhado de modificadores', async () => {
    setup()

    await userEvent.keyboard('{Control>}q{/Control}{Alt>}q{/Alt}')

    expect(dialog()).not.toBeInTheDocument()
  })

  it('mostra o que reconheceu e assinala o que é novo', async () => {
    setup()
    await userEvent.type(await openWithShortcut(), 'Pagar renda amanhã às 9h #Casa @urgente @banco p1')

    const recognized = screen.getByRole('list', { name: 'Reconhecido' })
    await waitFor(() => expect(recognized).toHaveTextContent('#Casanovo'))
    expect(recognized).toHaveTextContent('Amanhã')
    expect(recognized).toHaveTextContent('09:00')
    expect(recognized).toHaveTextContent('@banconovo')
    expect(recognized).toHaveTextContent('P1')
    expect(recognized).not.toHaveTextContent('@urgentenovo')
  })

  it('não assinala como novo um projeto que já existe, sem distinguir maiúsculas', async () => {
    setup()
    await userEvent.type(await openWithShortcut(), 'Relatório #trabalho')

    const recognized = screen.getByRole('list', { name: 'Reconhecido' })
    await waitFor(() => expect(recognized).toHaveTextContent('#trabalho'))
    expect(recognized).not.toHaveTextContent('novo')
  })

  it('Enter cria a tarefa com os campos extraídos e fecha', async () => {
    const server = setup()
    await userEvent.type(await openWithShortcut(), 'Pagar renda amanhã #Casa p1{Enter}')

    await waitFor(() => expect(server.callsTo('POST /tasks')).toHaveLength(1))
    expect(server.callsTo('POST /tasks')[0].body).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      title: 'Pagar renda',
      due_date: '2026-11-15',
      due_time: null,
      recurrence_rule: null,
      recurrence_text: null,
      priority: 1,
      project_name: 'Casa',
      label_names: [],
    })
    await waitFor(() => expect(dialog()).not.toBeInTheDocument())
    expect(await screen.findByText('Tarefa adicionada')).toBeInTheDocument()
  })

  it('envia recorrência, hora e etiquetas, com prioridade 4 por omissão', async () => {
    const server = setup()
    await userEvent.type(await openWithShortcut(), 'Relatório toda segunda-feira às 9h @urgente{Enter}')

    await waitFor(() => expect(server.callsTo('POST /tasks')).toHaveLength(1))
    expect(server.callsTo('POST /tasks')[0].body).toMatchObject({
      title: 'Relatório',
      due_date: '2026-11-16',
      due_time: '09:00',
      recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO',
      recurrence_text: 'toda segunda-feira',
      priority: 4,
      project_name: null,
      label_names: ['urgente'],
    })
  })

  it('não cria uma tarefa sem título', async () => {
    const server = setup()
    await userEvent.type(await openWithShortcut(), 'amanhã p1{Enter}')

    expect(await screen.findByText('Escreve um título para a tarefa.')).toBeInTheDocument()
    expect(server.callsTo('POST /tasks')).toHaveLength(0)
    expect(dialog()).toBeInTheDocument()

    await userEvent.type(await field(), ' Ligar')
    expect(screen.queryByText('Escreve um título para a tarefa.')).not.toBeInTheDocument()
  })

  it('Esc fecha sem criar e o texto não fica para a próxima vez', async () => {
    const server = setup()
    await userEvent.type(await openWithShortcut(), 'Rascunho{Escape}')

    await waitFor(() => expect(dialog()).not.toBeInTheDocument())
    expect(server.callsTo('POST /tasks')).toHaveLength(0)
    expect(await openWithShortcut()).toHaveValue('')
  })

  it('se criar falhar, reabre com o texto escrito', async () => {
    setup({ 'POST /tasks': () => ({ status: 500, body: { message: 'Server Error' } }) })
    await userEvent.type(await openWithShortcut(), 'Comprar pão hoje{Enter}')

    expect(await screen.findByText('Não foi possível guardar. Tenta de novo.')).toBeInTheDocument()
    expect(await field()).toHaveValue('Comprar pão hoje')
  })
})
