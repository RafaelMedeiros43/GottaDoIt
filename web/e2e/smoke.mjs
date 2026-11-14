// Teste de ponta a ponta no browser: conta nova → Quick Add → concluir → desfazer.
// Correr com scripts/e2e.sh, que arranca a API e o frontend.
import { createRequire } from 'node:module'

const { chromium } = createRequire(import.meta.url)('playwright')

const BASE = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173'
const SCREENSHOTS = process.env.E2E_SCREENSHOT_DIR

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
page.setDefaultTimeout(10_000)

const shot = async (name) => SCREENSHOTS && page.screenshot({ path: `${SCREENSHOTS}/${name}.png` })
const task = page.getByRole('listitem').filter({ hasText: 'Comprar pão' })

try {
  // Sem sessão, a aplicação leva ao login.
  await page.goto(BASE)
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await page.getByLabel('Nome').fill('Ana Teste')
  await page.getByLabel('E-mail').fill(`ana-${Date.now()}@example.com`)
  await page.getByLabel('Palavra-passe').fill('segredo-123')
  await page.getByRole('button', { name: 'Criar conta' }).click()

  await page.getByRole('heading', { name: 'Hoje', level: 1 }).waitFor()
  await page.getByText('Tudo feito por hoje.').waitFor()
  await shot('1-vazio')

  // Quick Add pelo atalho de teclado.
  await page.keyboard.press('Control+k')
  const field = page.getByRole('textbox', { name: 'Tarefa' })
  await field.fill('Comprar pão hoje às 18h p2 @casa')
  const recognized = page.getByRole('list', { name: 'Reconhecido' })
  await recognized.getByText('Hoje').waitFor()
  await recognized.getByText('18:00').waitFor()
  await recognized.getByText('P2').waitFor()
  await shot('2-quick-add')
  await field.press('Enter')

  // A tarefa aparece em "Hoje" com a hora e a etiqueta criada.
  await task.waitFor()
  await task.getByText('18:00').waitFor()
  await task.getByText('@casa').waitFor()
  await shot('3-hoje')

  const complete = () => page.getByRole('checkbox', { name: 'Concluir "Comprar pão"' }).click()
  // Espera que o servidor responda, e falha se a resposta não for de sucesso.
  const saved = (path) =>
    page.waitForResponse((response) => response.url().includes(path)).then((response) => {
      if (!response.ok()) throw new Error(`${path} respondeu ${response.status()}`)
    })

  // Concluir e desfazer: a tarefa volta, e continua lá depois de recarregar.
  await Promise.all([saved('/complete'), complete()])
  await task.waitFor({ state: 'detached' })
  await page.getByText('Tarefa concluída').waitFor()
  await Promise.all([saved('/reopen'), page.getByRole('button', { name: 'Desfazer' }).click()])
  await task.waitFor()
  await page.reload()
  await task.waitFor()

  // Concluir sem desfazer: depois de recarregar, a tarefa já não está em "Hoje".
  await Promise.all([saved('/complete'), complete()])
  await page.reload()
  await page.getByText('Tudo feito por hoje.').waitFor()

  // Criar outra, apagar e desfazer.
  await page.keyboard.press('Control+k')
  await field.fill('Comprar pão hoje')
  await Promise.all([saved('/api/v1/tasks'), field.press('Enter')])
  await task.waitFor()
  await Promise.all([
    page.waitForResponse((response) => response.request().method() === 'DELETE').then((response) => {
      if (!response.ok()) throw new Error(`DELETE respondeu ${response.status()}`)
    }),
    page.getByRole('button', { name: 'Apagar "Comprar pão"' }).click(),
  ])
  await task.waitFor({ state: 'detached' })
  await Promise.all([saved('/restore'), page.getByRole('button', { name: 'Desfazer' }).click()])
  await page.reload()
  await task.waitFor()

  // O atalho Q também abre o Quick Add.
  await page.keyboard.press('q')
  await field.waitFor()
  await page.keyboard.press('Escape')
  await field.waitFor({ state: 'detached' })

  // Tema escuro.
  await page.getByRole('radio', { name: 'Escuro' }).click()
  await page.locator('html.dark').waitFor()
  if ((await page.getByRole('radio', { name: 'Escuro' }).getAttribute('aria-checked')) !== 'true') {
    throw new Error('O tema escuro não ficou selecionado.')
  }
  await page.waitForTimeout(300)
  await shot('4-escuro')

  console.log('smoke: ok')
} catch (error) {
  await shot('falha')
  console.error('smoke: falhou')
  console.error(error)
  process.exitCode = 1
} finally {
  await browser.close()
}
