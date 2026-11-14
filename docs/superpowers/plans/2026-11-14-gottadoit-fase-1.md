# GottaDoIt Fase 1 — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o esquema SQL completo, a API REST (documentada toda, implementada para "Hoje" e "Quick Add"), o parser de linguagem natural em português e o frontend com "Hoje" e "Quick Add" a funcionar de ponta a ponta.

**Architecture:** Dois projetos no mesmo repositório. `api/` é Laravel com Sanctum (tokens Bearer) sobre PostgreSQL, com RLS aplicado através de um papel próprio e de uma variável de sessão por pedido. `web/` é React (Vite) que fala só com a API, com TanStack Query para atualizações otimistas.

**Tech Stack:** PHP 8.3, Laravel 13, Sanctum 4, PostgreSQL 16 · Node 22, React 19, Vite, TypeScript, Tailwind 4, Shadcn/UI (Radix), TanStack Query 5, React Router, Sonner, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-14-gottadoit-design.md`

## Global Constraints

- Prefixo da API: `/api/v1`. JSON. `Authorization: Bearer <token>`. Erros de validação: 422 com mensagens por campo.
- Chaves primárias UUID em todas as tabelas. Todas as tabelas de dados têm `user_id`.
- A API liga-se com o papel `gottadoit_app` (sem `BYPASSRLS`, não dono das tabelas). As migrações correm com a ligação `pgsql_admin`.
- `users` e `personal_access_tokens` não têm RLS; todas as outras tabelas têm `ENABLE` + `FORCE ROW LEVEL SECURITY`.
- `due_date` é `date`, `due_time` é `time`, ambos no fuso do utilizador. "Hoje" calcula-se com `users.timezone` (por omissão `Europe/Lisbon`).
- Prioridade é inteiro 1 a 4 (1 = P1, a mais alta; 4 por omissão).
- Apagar tarefa é apagar suave (`deleted_at`).
- Interface e mensagens em português de Portugal. Identificadores de código em inglês.
- Sem dependências além das listadas em Tech Stack, salvo as que os geradores oficiais instalam.
- Cada commit termina com as linhas de atribuição da sessão.

## Review Focus

1. Recorrência mensal no dia 29–31 em meses curtos: deve cair no último dia do mês e voltar ao dia pedido no mês seguinte (teste na Tarefa 4).
2. `project_id`, `section_id`, `parent_task_id` ou `label_ids` de outro utilizador num pedido: 422, nunca associar (teste na Tarefa 5).
3. Texto parecido com marcadores dentro de palavras, e-mails ou URLs (`ana@mail.com`, `C#`, `http://x.pt/#topo`, `p10`, `sp1`): não é interpretado (teste na Tarefa 7).
4. Quick Add só com marcadores (`amanhã p1`), sem título: não submete e mostra "Escreve um título para a tarefa." (teste na Tarefa 10).
5. Falha do servidor depois de uma atualização otimista (concluir, apagar, criar): a lista volta ao estado anterior e aparece um aviso de erro (teste na Tarefa 9).

---

## Estrutura de ficheiros

```
scripts/dev-db.sh                    arranca PostgreSQL local, cria papel e bases de dados
scripts/e2e.sh                       arranca api + web e corre o teste de browser
docs/api.md                          todos os endpoints com exemplos JSON
api/
  database/sql/001_schema.sql        esquema completo (entrega n.º 1)
  database/migrations/..._schema.php executa o ficheiro SQL
  app/Http/Middleware/SetRlsContext.php
  app/Support/RlsContext.php
  app/Support/Recurrence.php
  app/Models/{User,Project,Label,Task,ActivityLog}.php
  app/Http/Controllers/Api/V1/{Auth,Me,Project,Label,Task,TaskCompletion}Controller.php
  app/Http/Requests/...              um Form Request por escrita
  app/Http/Resources/{User,Project,Label,Task}Resource.php
  app/Services/TaskService.php       criar/editar/apagar/reagendar + registo de atividade
  routes/api.php
  tests/Feature/..., tests/Unit/RecurrenceTest.php
web/
  src/lib/api.ts, src/lib/types.ts, src/lib/dates.ts
  src/lib/quick-add-parser/{index,normalize,dates,recurrence}.ts (+ *.test.ts)
  src/components/ui/                 componentes Shadcn
  src/components/layout/{AppShell,Sidebar,ThemeToggle}.tsx, src/components/theme-provider.tsx
  src/features/auth/{AuthProvider,LoginPage}.tsx
  src/features/tasks/{queries.ts,TodayPage.tsx,TaskItem.tsx,undo-toast.ts}
  src/features/quick-add/{QuickAddDialog,HighlightedInput}.tsx, useQuickAddShortcut.ts
  e2e/smoke.mjs
```

---

### Task 1: Base de dados local, esqueleto da API e esquema SQL

**Files:**
- Create: `scripts/dev-db.sh`, `api/` (via `composer create-project laravel/laravel api`), `api/database/sql/001_schema.sql`, `api/database/migrations/2026_11_14_000000_schema.php`, `api/tests/Feature/SchemaTest.php`
- Modify: `api/config/database.php`, `api/.env.example`, `api/phpunit.xml`, `api/tests/TestCase.php`
- Delete: as migrações de origem do Laravel (`users`, `cache`, `jobs`) e a do Sanctum; `CACHE_STORE=file`, `SESSION_DRIVER=array`, `QUEUE_CONNECTION=sync`.

**Interfaces — Produces:**
- `scripts/dev-db.sh`: PostgreSQL na porta `54329`, papel `gottadoit_app` (palavra-passe `secret`, só local), bases `gottadoit` e `gottadoit_test`. Idempotente.
- Ligações Laravel: `pgsql` (papel `gottadoit_app`, por omissão) e `pgsql_admin` (variáveis `DB_ADMIN_USERNAME`/`DB_ADMIN_PASSWORD`). Migrar: `php artisan migrate --database=pgsql_admin`.
- `tests/TestCase.php`: corre `migrate:fresh --database=pgsql_admin` uma vez por processo; cada teste corre numa transação em `pgsql` que é revertida.
- Tabelas e colunas (nomes exatos):
  - `users`: `id, name, email, password, timezone ('Europe/Lisbon'), week_start smallint (0 domingo | 1 segunda, por omissão 1), theme ('system'|'light'|'dark'), notification_settings jsonb ({"push":true,"email":false,"daily_digest":false,"daily_digest_time":"08:00"}), created_at, updated_at`; índice único em `lower(email)`.
  - `projects`: `id, user_id, parent_id→projects (cascade), name, color (check ^#[0-9a-fA-F]{6}$, por omissão '#808080'), icon, view ('list'|'board'), is_favorite, position int, created_at, updated_at`.
  - `sections`: `id, user_id, project_id→projects (cascade), name, position, created_at, updated_at`.
  - `tasks`: `id, user_id, project_id→projects (cascade), section_id→sections (set null), parent_task_id→tasks (cascade), title, description, due_date, due_time, recurrence_rule, recurrence_text, priority smallint (check 1..4, por omissão 4), is_completed, completed_at, position, deleted_at, created_at, updated_at`; checks: `due_time` exige `due_date`; `recurrence_rule` exige `due_date`.
  - `labels`: `id, user_id, name, color, created_at, updated_at`; único `(user_id, lower(name))`.
  - `task_labels`: `task_id→tasks (cascade), label_id→labels (cascade), user_id`; PK `(task_id, label_id)`.
  - `reminders`: `id, user_id, task_id→tasks (cascade), type ('absolute'|'relative'), remind_at timestamptz, minutes_before int, fire_at timestamptz, is_sent, sent_at, created_at`; check: `absolute` exige `remind_at`, `relative` exige `minutes_before >= 0`.
  - `activity_log`: `id, user_id, task_id→tasks (set null), action ('created'|'updated'|'completed'|'reopened'|'deleted'|'restored'|'rescheduled'), payload jsonb, created_at`.
  - `push_subscriptions`: `id, user_id, endpoint (único), p256dh, auth, user_agent, created_at`.
  - `personal_access_tokens`: colunas do Sanctum com `tokenable_id uuid`.
- Índices: `tasks (user_id, due_date, due_time) where not is_completed and deleted_at is null`; `tasks (user_id, project_id, section_id, position) where deleted_at is null`; `tasks (parent_task_id)`; `tasks (user_id, completed_at) where is_completed`; `projects (user_id, parent_id, position)`; `sections (project_id, position)`; `task_labels (label_id)`; `reminders (fire_at) where not is_sent`; `reminders (task_id)`; `activity_log (user_id, created_at desc)`; `activity_log (task_id, created_at desc)`.
- Política por tabela com RLS, nome `<tabela>_owner`, `FOR ALL TO gottadoit_app`, `USING` e `WITH CHECK`: `user_id = nullif(current_setting('app.user_id', true), '')::uuid`. `GRANT select, insert, update, delete` em todas as tabelas a `gottadoit_app`.

- [ ] **Step 1:** Escrever `scripts/dev-db.sh` e correr. Verificar: `psql -h 127.0.0.1 -p 54329 -U gottadoit_app gottadoit -c 'select 1'` devolve 1.
- [ ] **Step 2:** Criar o projeto Laravel, instalar Sanctum (`php artisan install:api`), configurar as duas ligações e o `TestCase`.
- [ ] **Step 3:** Escrever `SchemaTest` (falha): `test_all_tables_exist` (as 10 tabelas acima); `test_rls_is_forced_on_data_tables` (`pg_class.relrowsecurity` e `relforcerowsecurity` verdadeiros para as 8 tabelas de dados, falsos para `users` e `personal_access_tokens`); `test_app_role_cannot_bypass_rls` (`pg_roles.rolbypassrls = false` e `rolsuper = false` para `current_user`); `test_task_checks_reject_time_without_date`.
- [ ] **Step 4:** Correr `php artisan test --filter=SchemaTest`. Esperado: FAIL (tabelas em falta).
- [ ] **Step 5:** Escrever `001_schema.sql` e a migração que o executa com `DB::unprepared`.
- [ ] **Step 6:** Correr de novo. Esperado: PASS.
- [ ] **Step 7:** Commit `feat(api): scaffold Laravel API and full SQL schema with RLS`.

### Task 2: Contexto RLS e autenticação

**Files:**
- Create: `api/app/Support/RlsContext.php`, `api/app/Http/Middleware/SetRlsContext.php`, `api/app/Http/Controllers/Api/V1/{AuthController,MeController}.php`, `api/app/Http/Requests/{RegisterRequest,LoginRequest,UpdateMeRequest}.php`, `api/app/Http/Resources/UserResource.php`, `api/database/factories/UserFactory.php` (ajustar), `api/tests/Feature/{AuthTest,RlsIsolationTest}.php`
- Modify: `api/app/Models/User.php` (`HasUuids`, `HasApiTokens`), `api/routes/api.php`, `api/bootstrap/app.php`, `api/config/cors.php` (origem `FRONTEND_URL`)

**Interfaces:**
- Consumes: esquema e ligações da Tarefa 1.
- Produces:
  - `RlsContext::set(string $userId): void` — `select set_config('app.user_id', ?, true)`.
  - Middleware `rls` (alias): abre transação em `pgsql`, chama `RlsContext::set` com o utilizador autenticado, faz commit no fim (rollback em exceção). Grupo de rotas protegidas: `['auth:sanctum', 'rls']`.
  - `TestCase::actingAsUser(User $u): static` — `Sanctum::actingAs` + `RlsContext::set`.
  - `POST /auth/register` `{name, email, password (mín. 8), timezone?}` → 201 `{data: User, token}`. `POST /auth/login` `{email, password}` → 200 `{data: User, token}`; credenciais erradas → 422 em `email`. `POST /auth/logout` → 204 (revoga o token atual). `GET /me` → `{data: User}`. `PATCH /me` `{name?, timezone? (identificador IANA válido), week_start? (0|1), theme?, notification_settings?}`.
  - `User` JSON: `id, name, email, timezone, week_start, theme, notification_settings`.

- [ ] **Step 1:** Escrever `AuthTest` (falha): registo devolve token e utilizador; e-mail duplicado (ignorando maiúsculas) → 422; login com palavra-passe errada → 422; `/me` sem token → 401; `PATCH /me` com `timezone: "Marte/Olimpo"` → 422; logout invalida o token.
- [ ] **Step 2:** Escrever `RlsIsolationTest` (falha): com o contexto do utilizador A, inserir um projeto; mudar o contexto para B; `DB::table('projects')->count()` (sem nenhum `where`) é 0 e um `insert` com `user_id` de A lança `QueryException`; sem contexto definido, a contagem é 0.
- [ ] **Step 3:** Correr `php artisan test --filter='AuthTest|RlsIsolationTest'`. Esperado: FAIL.
- [ ] **Step 4:** Implementar os ficheiros acima.
- [ ] **Step 5:** Correr de novo. Esperado: PASS.
- [ ] **Step 6:** Commit `feat(api): Sanctum auth and per-request RLS context`.

### Task 3: Projetos e etiquetas

**Files:**
- Create: `api/app/Models/{Project,Label}.php`, `api/app/Http/Controllers/Api/V1/{ProjectController,LabelController}.php`, `api/app/Http/Requests/{StoreProjectRequest,StoreLabelRequest}.php`, `api/app/Http/Resources/{ProjectResource,LabelResource}.php`, factories, `api/tests/Feature/{ProjectTest,LabelTest}.php`
- Modify: `api/routes/api.php`

**Interfaces — Produces:**
- `GET /projects` → `{data: Project[]}` por `position`. `POST /projects` `{name (máx. 120), color?, icon?, view?, is_favorite?, parent_id?}` → 201; `position` = último + 1.
- `GET /labels` → `{data: Label[]}` por nome. `POST /labels` `{name (máx. 60, sem espaços), color?}` → 201; nome repetido (ignorando maiúsculas) → 422.
- `Project` JSON: `id, parent_id, name, color, icon, view, is_favorite, position`. `Label` JSON: `id, name, color`.
- Todos os modelos de dados usam `HasUuids` e preenchem `user_id` com o utilizador autenticado.

- [ ] **Step 1:** Escrever os testes (falha): criar e listar; a lista de A não contém projetos de B; `color: "vermelho"` → 422; `parent_id` de outro utilizador → 422; etiqueta duplicada → 422.
- [ ] **Step 2:** Correr `php artisan test --filter='ProjectTest|LabelTest'`. Esperado: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Correr. Esperado: PASS.
- [ ] **Step 5:** Commit `feat(api): projects and labels endpoints`.

### Task 4: Cálculo de recorrência

**Files:**
- Create: `api/app/Support/Recurrence.php`, `api/tests/Unit/RecurrenceTest.php`

**Interfaces — Produces:**
- `Recurrence::isValid(string $rule): bool`
- `Recurrence::next(string $rule, CarbonImmutable $due, CarbonImmutable $today): CarbonImmutable` — a primeira ocorrência que seja posterior a `$due` e não anterior a `$today`.
- Gramática: pares `CHAVE=VALOR` separados por `;`. `FREQ` obrigatório (`DAILY|WEEKLY|MONTHLY|YEARLY`); `INTERVAL` inteiro ≥ 1 (por omissão 1); `BYDAY` (lista de `MO,TU,WE,TH,FR,SA,SU`) só com `WEEKLY`; `BYMONTHDAY` (1..31) só com `MONTHLY`. Qualquer outra chave torna a regra inválida.
- `WEEKLY` com `INTERVAL > 1`: semanas contadas a partir da semana (segunda a domingo) de `$due`. `MONTHLY` sem `BYMONTHDAY` usa o dia de `$due`. Dia inexistente no mês cai no último dia desse mês, sem alterar o dia pedido nos meses seguintes.

- [ ] **Step 1:** Escrever `RecurrenceTest` (falha), cada linha um caso `(regra, due, today) → esperado`:
  - `FREQ=DAILY`, 2026-11-14, 2026-11-14 → 2026-11-15
  - `FREQ=DAILY;INTERVAL=2`, 2026-11-14, 2026-11-14 → 2026-11-16
  - `FREQ=DAILY`, 2026-11-01, 2026-11-14 → 2026-11-14 (em atraso salta para hoje)
  - `FREQ=WEEKLY;BYDAY=MO`, 2026-11-16, 2026-11-16 → 2026-11-23
  - `FREQ=WEEKLY;BYDAY=MO,TH`, 2026-11-16, 2026-11-16 → 2026-11-19
  - `FREQ=WEEKLY;INTERVAL=2;BYDAY=FR`, 2026-11-13, 2026-11-13 → 2026-11-27
  - `FREQ=MONTHLY;BYMONTHDAY=1`, 2026-12-01, 2026-12-01 → 2027-01-01
  - `FREQ=MONTHLY;BYMONTHDAY=31`, 2027-01-31, 2027-01-31 → 2027-02-28; e a partir de 2027-02-28 → 2027-03-31
  - `FREQ=YEARLY`, 2028-02-29, 2028-02-29 → 2029-02-28
  - `isValid`: falso para `""`, `FREQ=HOURLY`, `FREQ=DAILY;INTERVAL=0`, `FREQ=DAILY;BYDAY=MO`, `FREQ=WEEKLY;BYDAY=XX`, `FREQ=DAILY;COUNT=3`.
- [ ] **Step 2:** Correr `php artisan test --filter=RecurrenceTest`. Esperado: FAIL.
- [ ] **Step 3:** Implementar `Recurrence`.
- [ ] **Step 4:** Correr. Esperado: PASS.
- [ ] **Step 5:** Commit `feat(api): recurrence rule calculator`.

### Task 5: Tarefas — listar, criar, editar, apagar, restaurar, reagendar

**Files:**
- Create: `api/app/Models/{Task,ActivityLog}.php`, `api/app/Services/TaskService.php`, `api/app/Http/Controllers/Api/V1/TaskController.php`, `api/app/Http/Requests/{StoreTaskRequest,UpdateTaskRequest,RescheduleTasksRequest}.php`, `api/app/Http/Resources/TaskResource.php`, factory, `api/tests/Feature/{TaskCrudTest,TodayViewTest}.php`
- Modify: `api/routes/api.php`

**Interfaces:**
- Consumes: `Recurrence::isValid`, modelos `Project`, `Label`.
- Produces:
  - `Task` JSON: `id, title, description, due_date ("YYYY-MM-DD"|null), due_time ("HH:MM"|null), recurrence_rule, recurrence_text, priority, is_completed, completed_at, position, project_id, section_id, parent_task_id, label_ids, created_at, updated_at`.
  - `GET /tasks?view=today|inbox` → `{data: Task[], meta: {today: "YYYY-MM-DD"}}`. `today`: abertas, não apagadas, `due_date <= hoje` no fuso do utilizador, ordenadas por `due_date`, `due_time` (nulos no fim), `priority`, `position`. `inbox`: abertas, não apagadas, sem `project_id` e sem `parent_task_id`, por `position`. `view` em falta ou outro valor → 422.
  - `POST /tasks` `{id? (uuid gerado no cliente), title (obrigatório, máx. 500), description?, due_date?, due_time?, recurrence_rule?, recurrence_text?, priority?, project_id?, section_id?, parent_task_id?, label_ids?, project_name?, label_names?}` → 201 `{data: Task}`. `project_name` e `label_names` procuram por nome ignorando maiúsculas e criam o que não existir; `project_id` e `project_name` juntos → 422. Tudo numa transação.
  - `PATCH /tasks/{id}` (mesmos campos, todos opcionais, sem `id`, `project_name`, `label_names`) → 200. `DELETE /tasks/{id}` → 204. `POST /tasks/{id}/restore` → 200. `POST /tasks/reschedule` `{task_ids (1..200 uuids), due_date}` → `{data: Task[]}`; mantém `due_time`.
  - Tarefa inexistente, apagada (exceto em `restore`) ou de outro utilizador → 404.
  - `TaskService` escreve em `activity_log`: `created`, `updated` (payload `{changes: {campo: [antes, depois]}}`), `deleted`, `restored`, `rescheduled` (payload `{previous_due_date, due_date}`).

- [ ] **Step 1:** Escrever `TaskCrudTest` (falha): criar com todos os campos; criar com `id` do cliente devolve esse `id`; `project_name: "casa"` reutiliza o projeto "Casa" existente e `label_names: ["Urgente","novo"]` reutiliza uma e cria outra; `due_time` sem `due_date` → 422; `recurrence_rule: "FREQ=HOURLY"` → 422; `priority: 5` → 422; **`project_id`, `section_id`, `parent_task_id` e `label_ids` de outro utilizador → 422 cada**; editar regista `updated` com as alterações; apagar esconde da lista e `restore` repõe; `PATCH` em tarefa de outro utilizador → 404; reagendar três tarefas muda as datas, mantém as horas e ignora (422) ids alheios.
- [ ] **Step 2:** Escrever `TodayViewTest` (falha): utilizador com `timezone: Pacific/Auckland` e relógio fixo em `2026-11-14T12:00:00Z` vê `meta.today = "2026-11-15"` e a tarefa de 15; utilizador com `America/Los_Angeles` e relógio em `2026-11-14T03:00:00Z` vê `meta.today = "2026-11-13"`; tarefas em atraso entram, concluídas e apagadas não; ordem conforme a regra acima; `inbox` exclui tarefas com projeto.
- [ ] **Step 3:** Correr `php artisan test --filter='TaskCrudTest|TodayViewTest'`. Esperado: FAIL.
- [ ] **Step 4:** Implementar.
- [ ] **Step 5:** Correr. Esperado: PASS.
- [ ] **Step 6:** Commit `feat(api): task endpoints with today and inbox views`.

### Task 6: Concluir e reabrir, com recorrência, e documentação da API

**Files:**
- Create: `api/app/Http/Controllers/Api/V1/TaskCompletionController.php`, `api/tests/Feature/TaskCompletionTest.php`, `docs/api.md`, `api/tests/Feature/ApiDocsTest.php`
- Modify: `api/app/Services/TaskService.php`, `api/routes/api.php`

**Interfaces:**
- Consumes: `Recurrence::next`, `TaskService`, `Task`, `ActivityLog`.
- Produces:
  - `POST /tasks/{id}/complete` → `{data: Task, meta: {recurred: bool}}`. Sem regra: `is_completed = true`, `completed_at = agora`, registo `completed` com `{occurrence_date}`. Com regra: a tarefa fica aberta, `due_date` passa a `Recurrence::next(regra, due_date, hoje do utilizador)`, registo `completed` com `{occurrence_date, previous_due_date, next_due_date}`, `recurred = true`. Concluir uma tarefa já concluída devolve 200 sem novo registo.
  - `POST /tasks/{id}/reopen` → `{data: Task}`. Sem regra: limpa `is_completed` e `completed_at`. Com regra: se o registo mais recente da tarefa entre `completed`/`reopened` for `completed`, repõe `previous_due_date`. Em ambos os casos regista `reopened`; se não houver nada para desfazer, devolve 200 sem alterar nem registar.
  - `docs/api.md`: uma secção por recurso (Autenticação, Perfil, Projetos, Secções, Tarefas, Subtarefas e reordenação, Etiquetas, Lembretes, Filtros, Em Breve, Registo de atividade, Subscrições push). Cada endpoint tem método, caminho, exemplo de pedido e de resposta em JSON, códigos de erro e a marca **Implementado** ou **Planeado**. Inclui a gramática dos filtros (`prioridade:P1 & #Trabalho & sem_data`) e o contrato do worker de lembretes (lê `reminders` com `fire_at <= now()` e `is_sent = false`).

- [ ] **Step 1:** Escrever `TaskCompletionTest` (falha): concluir tarefa simples retira-a de `view=today`; concluir duas vezes cria um só registo `completed`; tarefa com `FREQ=MONTHLY;BYMONTHDAY=1` e `due_date` 2026-12-01 concluída em 2026-12-01 fica aberta com `due_date` 2027-01-01, `recurred = true` e registo com as três datas; `reopen` a seguir repõe 2026-12-01 e um segundo `reopen` não altera nada; `reopen` de tarefa simples volta a mostrá-la em `today`; tarefa de outro utilizador → 404.
- [ ] **Step 2:** Escrever `ApiDocsTest` (falha): cada rota de `php artisan route:list --path=api/v1` aparece em `docs/api.md` como `MÉTODO /caminho` marcada **Implementado**.
- [ ] **Step 3:** Correr `php artisan test --filter='TaskCompletionTest|ApiDocsTest'`. Esperado: FAIL.
- [ ] **Step 4:** Implementar o controlador e escrever `docs/api.md`.
- [ ] **Step 5:** Correr `php artisan test` (suite completa). Esperado: PASS.
- [ ] **Step 6:** Commit `feat(api): complete/reopen with recurrence; document REST API`.

### Task 7: Parser de linguagem natural

**Files:**
- Create: `web/` (via `npm create vite@latest web -- --template react-ts`), Vitest, `web/src/lib/quick-add-parser/{index,normalize,dates,recurrence}.ts`, `web/src/lib/quick-add-parser/parser.test.ts`

**Interfaces — Produces:**

```ts
export type TokenKind = 'date' | 'time' | 'recurrence' | 'project' | 'label' | 'priority'
export interface Token { kind: TokenKind; start: number; end: number; text: string }
export interface ParsedQuickAdd {
  title: string
  dueDate: string | null        // YYYY-MM-DD
  dueTime: string | null        // HH:MM
  recurrenceRule: string | null // gramática da Tarefa 4
  recurrenceText: string | null
  projectName: string | null
  labelNames: string[]
  priority: 1 | 2 | 3 | 4 | null
  tokens: Token[]               // posições no texto original, por ordem
}
export function parseQuickAdd(input: string, today: string, opts?: { weekStart?: 0 | 1 }): ParsedQuickAdd
```

Regras:
- A comparação ignora maiúsculas e acentos; as posições referem-se ao texto original.
- Um marcador só conta no início do texto ou depois de espaço, e termina em espaço ou fim. `#` e `@` aceitam letras, dígitos, `_` e `-`. Prioridade é exatamente `p1`..`p4`. Se houver vários do mesmo tipo (exceto etiquetas), vale o último e os anteriores ficam no título.
- `title` é o texto sem os marcadores, com espaços normalizados.
- Dia da semana simples ou com "próxima/o": a próxima ocorrência estritamente depois de hoje. `dia N` ou `DD/MM` já passados: mês ou ano seguinte. `próxima semana`: primeiro dia da semana seguinte segundo `weekStart` (por omissão 1).
- Hora sem data: `dueDate = today`. Recorrência sem data: primeira ocorrência em ou depois de hoje.
- Mapa de recorrência: `todos os dias`/`diariamente` → `FREQ=DAILY`; `a cada N dias|semanas|meses` → `INTERVAL=N`; `toda(s) (a/as) segunda(-feira)(s)` → `FREQ=WEEKLY;BYDAY=MO`; `todas as semanas` → `FREQ=WEEKLY`; `todos os meses` → `FREQ=MONTHLY`; `todo dia N`/`todos os dias N` → `FREQ=MONTHLY;BYMONTHDAY=N`; `todos os anos` → `FREQ=YEARLY`.

- [ ] **Step 1:** Escrever `parser.test.ts` (falha) com `today = '2026-11-14'` (sábado):
  - `Reunião amanhã às 15h #Trabalho @urgente p1` → título `Reunião`, `2026-11-15`, `15:00`, projeto `Trabalho`, etiquetas `['urgente']`, prioridade 1, seis tokens com posições corretas.
  - `amanha` (sem acento) = `amanhã`; `hoje` → 14; `depois de amanhã` → 16.
  - `próxima sexta` e `sexta-feira` → `2026-11-20`; `sábado` → `2026-11-21`.
  - `dia 15` → `2026-11-15`; `dia 10` → `2026-12-10`; `15/03` → `2027-03-15`; `15 de março` → `2027-03-15`; `daqui a 3 dias` → `2026-11-17`; `próxima semana` → `2026-11-16`, e com `weekStart: 0` → `2026-11-15`.
  - Horas: `15h30`, `15:30`, `às 9 da manhã` → `09:00`, `às 9 da noite` → `21:00`, `ao meio-dia` → `12:00`; `ligar às 15h` → `dueDate` hoje.
  - `Treinar a cada 2 dias` → `FREQ=DAILY;INTERVAL=2`, `2026-11-14`, `recurrenceText` `a cada 2 dias`.
  - `Pagar renda todo dia 1` → `FREQ=MONTHLY;BYMONTHDAY=1`, `2026-12-01`.
  - `Relatório toda segunda-feira às 9h` → `FREQ=WEEKLY;BYDAY=MO`, `2026-11-16`, `09:00`.
  - `todos os dias`, `todas as semanas`, `todos os meses`, `todas as sextas` → regras do mapa.
  - Várias etiquetas: `x @casa @urgente` → ambas.
  - **Não interpretar:** `escrever a ana@mail.com`, `estudar C#`, `ver http://x.pt/#topo`, `comprar p10`, `sp1 instalar`, `hojeira` → sem tokens e título igual ao texto.
  - Só marcadores: `amanhã p1` → `title === ''`.
  - Texto vazio → tudo nulo, `tokens` vazio.
- [ ] **Step 2:** Correr `npm test -- --run` em `web/`. Esperado: FAIL.
- [ ] **Step 3:** Implementar o parser.
- [ ] **Step 4:** Correr. Esperado: PASS.
- [ ] **Step 5:** Commit `feat(web): Portuguese natural-language quick add parser`.

### Task 8: Base do frontend — cliente da API, autenticação, tema, layout

**Files:**
- Create: `web/src/lib/{api,types,dates}.ts`, `web/src/components/ui/*`, `web/src/components/theme-provider.tsx`, `web/src/components/layout/{AppShell,Sidebar,ThemeToggle}.tsx`, `web/src/features/auth/{AuthProvider,LoginPage}.tsx`, `web/src/lib/api.test.ts`, `web/src/features/auth/LoginPage.test.tsx`
- Modify: `web/src/{main,App}.tsx`, `web/vite.config.ts` (proxy `/api` → `http://127.0.0.1:8000`), `web/src/index.css`

**Interfaces:**
- Consumes: endpoints de autenticação (Tarefa 2).
- Produces:
  - `api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T>` — prefixa `/api/v1`, envia o token de `localStorage['gottadoit.token']`, lança `ApiError { status: number; message: string; errors?: Record<string, string[]> }`; num 401 limpa o token e redireciona para `/login`.
  - `types.ts`: `User`, `Project`, `Label`, `Task` com os campos JSON das Tarefas 2, 3 e 5.
  - `useAuth(): { user: User | null; login(email, password): Promise<void>; register(name, email, password): Promise<void>; logout(): Promise<void> }`. O registo envia o fuso do browser (`Intl.DateTimeFormat().resolvedOptions().timeZone`).
  - Rotas: `/login`, `/hoje` (protegida; `/` redireciona para `/hoje`). `AppShell` desenha a barra lateral (Caixa de Entrada, Hoje, Em breve — só "Hoje" ativa nesta fase; as outras desativadas com "Em breve"), o botão "Adicionar tarefa" e o `ThemeToggle` (Sistema, Claro, Escuro; guardado em `localStorage['gottadoit.theme']`).
  - Componentes Shadcn: `button`, `input`, `label`, `checkbox`, `dialog`, `badge`, `sonner`. Instalar com `npx shadcn@latest add`; se o registo não estiver acessível, escrever os mesmos ficheiros à mão sobre Radix em `src/components/ui/`.
  - Testes de componentes com `@testing-library/react` e `jsdom`.

- [ ] **Step 1:** Escrever os testes (falha): `api` envia o cabeçalho Bearer e converte um 422 em `ApiError` com `errors`; `LoginPage` mostra a mensagem do campo `email` quando o login devolve 422 e alterna entre "Entrar" e "Criar conta".
- [ ] **Step 2:** Correr `npm test -- --run`. Esperado: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Correr testes e `npm run build`. Esperado: PASS e build sem erros.
- [ ] **Step 5:** Commit `feat(web): app shell, auth and theming`.

### Task 9: Vista "Hoje"

**Files:**
- Create: `web/src/features/tasks/{queries.ts,TodayPage.tsx,TaskItem.tsx,undo-toast.ts}`, `web/src/features/tasks/TodayPage.test.tsx`

**Interfaces:**
- Consumes: `api`, tipos, endpoints das Tarefas 5 e 6.
- Produces (em `queries.ts`): chave `['tasks', 'today']`; `useTodayTasks()` → `{ overdue: Task[]; today: Task[]; todayDate: string }` (separação por `due_date < meta.today`); `useCreateTask()`, `useCompleteTask()`, `useReopenTask()`, `useDeleteTask()`, `useRestoreTask()`, `useRescheduleTasks()`. Todas as mutações atualizam a cache antes da resposta, repõem o estado anterior em caso de erro (com aviso "Não foi possível guardar. Tenta de novo.") e invalidam a chave no fim.
- `showUndoToast(message: string, onUndo: () => void): void` — Sonner, 5000 ms, botão "Desfazer".
- Ecrã: título "Hoje" com a data por extenso; secção "Em atraso" (só se houver) com o botão "Reagendar para hoje" e a data original de cada tarefa a vermelho; secção de hoje. Cada linha: caixa redonda com a cor da prioridade (P1 vermelho, P2 laranja, P3 azul, P4 cinzento), título, hora, projeto, etiquetas, ícone de recorrência, botão apagar. Estado vazio: "Tudo feito por hoje." Concluir → aviso "Tarefa concluída" com Desfazer (chama `reopen`); apagar → "Tarefa apagada" com Desfazer (chama `restore`).

- [ ] **Step 1:** Escrever `TodayPage.test.tsx` (falha) com `fetch` simulado: separa em atraso de hoje; clicar na caixa remove a linha de imediato e mostra "Tarefa concluída"; clicar em "Desfazer" repõe a linha e chama `POST /tasks/{id}/reopen`; "Reagendar para hoje" envia todos os ids em atraso com a data de `meta.today` e a secção desaparece; **quando `complete` responde 500, a linha reaparece e mostra-se o aviso de erro; o mesmo para apagar**; lista vazia mostra "Tudo feito por hoje.".
- [ ] **Step 2:** Correr `npm test -- --run`. Esperado: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Correr. Esperado: PASS.
- [ ] **Step 5:** Commit `feat(web): Today view with optimistic updates and undo`.

### Task 10: Modal "Quick Add" e teste de ponta a ponta

**Files:**
- Create: `web/src/features/quick-add/{QuickAddDialog.tsx,HighlightedInput.tsx,useQuickAddShortcut.ts}`, `web/src/features/quick-add/QuickAddDialog.test.tsx`, `web/e2e/smoke.mjs`, `scripts/e2e.sh`, `README.md`
- Modify: `web/src/components/layout/AppShell.tsx`

**Interfaces:**
- Consumes: `parseQuickAdd`, `useCreateTask`, `useAuth` (para `week_start`), `useTodayTasks().todayDate`, `GET /projects`, `GET /labels`.
- Produces:
  - `useQuickAddShortcut(open: () => void)`: `q` (sem modificadores, fora de campos de texto) e `Ctrl/Cmd+K` (em qualquer lado).
  - `QuickAddDialog({ open, onOpenChange })`: campo com o texto realçado por tipo de token (`HighlightedInput`: camada colorida por trás de um `input` transparente); por baixo, uma etiqueta por valor reconhecido (data por extenso, hora, recorrência, `#projeto`, `@etiqueta`, `P1`), com a indicação "novo" quando o projeto ou a etiqueta não existe. Marcador de exemplo: `Ex.: Pagar renda amanhã às 15h #Casa @urgente p1`. `Enter` cria, fecha e limpa; `Esc` fecha. Título vazio: não submete e mostra "Escreve um título para a tarefa.".
  - Pedido enviado: `{id: crypto.randomUUID(), title, due_date, due_time, recurrence_rule, recurrence_text, priority: priority ?? 4, project_name, label_names}`. Se a data não for hoje nem anterior, mostra o aviso "Tarefa adicionada" com a data; caso contrário a tarefa aparece logo em "Hoje".
  - `scripts/e2e.sh`: garante a base de dados, corre `migrate:fresh`, arranca `php artisan serve` e `vite`, corre `node web/e2e/smoke.mjs`, termina os processos.
  - `README.md`: como arrancar localmente, como apontar para o Supabase (criar o papel `gottadoit_app` sem `BYPASSRLS`, usar a ligação direta ou o pooler em modo transação, correr as migrações com o utilizador `postgres`), e a lista do que está fora desta fase.

- [ ] **Step 1:** Escrever `QuickAddDialog.test.tsx` (falha): `q` abre o modal, mas não quando o foco está num `input`; `Ctrl+K` abre; escrever `Pagar renda amanhã #Casa p1` mostra as etiquetas da data, `#Casa` com "novo" e `P1`; `Enter` envia o pedido com `title: "Pagar renda"`, `project_name: "Casa"`, `priority: 1` e a data de amanhã; **`amanhã p1` + `Enter` não envia nada e mostra "Escreve um título para a tarefa."**; `Esc` fecha.
- [ ] **Step 2:** Correr `npm test -- --run`. Esperado: FAIL.
- [ ] **Step 3:** Implementar o modal e ligá-lo ao `AppShell`.
- [ ] **Step 4:** Correr. Esperado: PASS.
- [ ] **Step 5:** Escrever `web/e2e/smoke.mjs` (Playwright, Chromium): criar conta; `Ctrl+K`; escrever `Comprar pão hoje p2 @casa`; `Enter`; a tarefa aparece em "Hoje"; concluir; "Desfazer"; a tarefa volta; recarregar a página e a tarefa continua lá.
- [ ] **Step 6:** Correr `scripts/e2e.sh`. Esperado: termina com código 0 e imprime `smoke: ok`.
- [ ] **Step 7:** Escrever `README.md`. Commit `feat(web): Quick Add modal, end-to-end smoke test and README`.
