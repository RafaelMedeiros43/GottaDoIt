# GottaDoIt — API REST

Todos os endpoints, com exemplos. Cada um está marcado como **Implementado**
(existe e tem testes) ou **Planeado** (contrato definido, sem código ainda).
Um teste automático (`api/tests/Feature/ApiDocsTest.php`) garante que esta
marca corresponde às rotas reais.

## Convenções

- Base: `/api/v1`. Pedidos e respostas em JSON (`Accept: application/json`).
- Autenticação: `Authorization: Bearer <token>`, exceto registo e login.
- Identificadores: UUID.
- Datas: `due_date` é `"YYYY-MM-DD"` e `due_time` é `"HH:MM"`, ambos no fuso
  horário do utilizador. Instantes (`created_at`, `completed_at`) são ISO 8601.
- Prioridade: inteiro de 1 (P1, a mais alta) a 4 (P4, por omissão).
- Respostas: `{"data": ...}` e, quando aplicável, `{"meta": ...}`.
- Cada pedido autenticado corre numa transação: ou fica tudo guardado, ou nada.

### Erros

| Código | Significado |
|---|---|
| 401 | Token em falta, inválido ou revogado |
| 404 | O recurso não existe ou pertence a outro utilizador |
| 422 | Validação falhou |
| 429 | Demasiados pedidos |

```json
{
  "message": "Uma hora precisa de uma data.",
  "errors": { "due_time": ["Uma hora precisa de uma data."] }
}
```

### Objetos

```jsonc
// User
{
  "id": "0193a0a2-7d5c-7c1e-9d1c-2f6f6f0c1a11",
  "name": "Ana",
  "email": "ana@example.com",
  "timezone": "Europe/Lisbon",
  "week_start": 1,              // 0 domingo, 1 segunda
  "theme": "system",            // system | light | dark
  "notification_settings": {
    "push": true, "email": false, "daily_digest": false, "daily_digest_time": "08:00"
  }
}

// Project
{
  "id": "0193a0a2-8e11-7b42-8a55-6d0b7f1e2c33",
  "parent_id": null,            // sub-projetos
  "name": "Trabalho",
  "color": "#808080",
  "icon": null,
  "view": "list",               // list | board
  "is_favorite": false,
  "position": 1
}

// Section
{ "id": "…", "project_id": "…", "name": "Por fazer", "position": 1 }

// Label
{ "id": "0193a0a2-9f02-7d10-b0c4-1a2b3c4d5e66", "name": "urgente", "color": "#808080" }

// Task
{
  "id": "0193a0a3-01aa-7e3f-a1b2-c3d4e5f60789",
  "title": "Pagar renda",
  "description": "**Transferência** para o senhorio",
  "due_date": "2026-12-01",
  "due_time": "09:30",
  "recurrence_rule": "FREQ=MONTHLY;BYMONTHDAY=1",
  "recurrence_text": "todo dia 1",
  "priority": 1,
  "is_completed": false,
  "completed_at": null,
  "position": 3,
  "project_id": "0193a0a2-8e11-7b42-8a55-6d0b7f1e2c33",
  "section_id": null,
  "parent_task_id": null,
  "label_ids": ["0193a0a2-9f02-7d10-b0c4-1a2b3c4d5e66"],
  "created_at": "2026-11-14T10:00:00+00:00",
  "updated_at": "2026-11-14T10:00:00+00:00"
}

// Reminder
{
  "id": "…", "task_id": "…",
  "type": "relative",           // absolute | relative
  "remind_at": null,            // absolute: instante exato
  "minutes_before": 30,         // relative: minutos antes do vencimento
  "is_sent": false
}
```

### Regras de recorrência

Subconjunto de RRULE. Pares `CHAVE=VALOR` separados por `;`:

| Chave | Valores | Notas |
|---|---|---|
| `FREQ` | `DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY` | obrigatória |
| `INTERVAL` | inteiro ≥ 1 | por omissão 1 |
| `BYDAY` | `MO,TU,WE,TH,FR,SA,SU` | só com `WEEKLY` |
| `BYMONTHDAY` | 1 a 31 | só com `MONTHLY`; num mês mais curto cai no último dia |

Exemplos: `FREQ=DAILY;INTERVAL=2` (a cada 2 dias), `FREQ=WEEKLY;BYDAY=MO`
(todas as segundas), `FREQ=MONTHLY;BYMONTHDAY=1` (todo dia 1).

---

## Autenticação

### POST /auth/register — Implementado

Cria a conta e devolve um token.

```json
{ "name": "Ana", "email": "ana@example.com", "password": "segredo-123", "timezone": "Europe/Lisbon" }
```

`timezone` é opcional (por omissão `Europe/Lisbon`); `password` tem no mínimo 8 caracteres.

`201`

```json
{ "data": { "id": "…", "name": "Ana", "email": "ana@example.com", "timezone": "Europe/Lisbon", "week_start": 1, "theme": "system", "notification_settings": { "push": true, "email": false, "daily_digest": false, "daily_digest_time": "08:00" } },
  "token": "1|Zk3…" }
```

`422` se o e-mail já existir (sem distinguir maiúsculas).

### POST /auth/login — Implementado

```json
{ "email": "ana@example.com", "password": "segredo-123" }
```

`200` com o mesmo formato do registo. `422` em `email` se as credenciais estiverem erradas.

### POST /auth/logout — Implementado

Revoga o token usado no pedido. `204` sem corpo.

## Perfil

### GET /me — Implementado

`200` `{ "data": User }`

### PATCH /me — Implementado

Todos os campos são opcionais. `notification_settings` é fundido com o que já existe.

```json
{ "timezone": "America/Sao_Paulo", "week_start": 0, "theme": "dark", "notification_settings": { "daily_digest": true, "daily_digest_time": "07:30" } }
```

`200` `{ "data": User }`. `422` se `timezone` não for um identificador IANA.

## Projetos

### GET /projects — Implementado

`200` `{ "data": [Project, …] }`, por `position`.

### POST /projects — Implementado

```json
{ "name": "Universidade", "color": "#4073ff", "view": "board", "is_favorite": true, "parent_id": null }
```

Só `name` é obrigatório. `201` `{ "data": Project }`; fica no fim da lista.

### PATCH /projects/{id} — Planeado

Mesmos campos, todos opcionais. `200` `{ "data": Project }`.

### DELETE /projects/{id} — Planeado

Apaga o projeto, os sub-projetos, as secções e as tarefas. `204`.

### POST /projects/reorder — Planeado

```json
{ "items": [ { "id": "…", "parent_id": null, "position": 1 }, { "id": "…", "parent_id": null, "position": 2 } ] }
```

`200` `{ "data": [Project, …] }`

## Secções

### GET /projects/{id}/sections — Planeado

`200` `{ "data": [Section, …] }`, por `position`.

### POST /projects/{id}/sections — Planeado

```json
{ "name": "Em curso" }
```

`201` `{ "data": Section }`

### PATCH /sections/{id} — Planeado

```json
{ "name": "Concluído", "position": 3 }
```

### DELETE /sections/{id} — Planeado

As tarefas da secção ficam no projeto, sem secção. `204`.

## Tarefas

### GET /tasks — Implementado

Parâmetro obrigatório `view`:

| `view` | Devolve | Ordem |
|---|---|---|
| `today` | abertas com `due_date` até hoje (inclui as em atraso) | data, hora (sem hora no fim), prioridade, posição |
| `inbox` | abertas sem projeto e sem tarefa-mãe | posição |

`200`

```json
{ "data": [Task, …], "meta": { "today": "2026-11-14" } }
```

`meta.today` é a data de hoje no fuso do utilizador. As tarefas com
`due_date` anterior estão em atraso.

Planeado para o mesmo endpoint: `view=upcoming&from=2026-11-14&to=2026-11-21`
(agenda por dia), `project_id=…` (lista de um projeto, com subtarefas),
`label_id=…`, `completed=true` (histórico) e `filter=…` (ver Filtros).

### POST /tasks — Implementado

Só `title` é obrigatório.

```json
{
  "id": "0193a0a3-01aa-7e3f-a1b2-c3d4e5f60789",
  "title": "Pagar renda",
  "description": "**Transferência** para o senhorio",
  "due_date": "2026-12-01",
  "due_time": "09:30",
  "recurrence_rule": "FREQ=MONTHLY;BYMONTHDAY=1",
  "recurrence_text": "todo dia 1",
  "priority": 1,
  "project_name": "Casa",
  "label_names": ["urgente"]
}
```

- `id` é opcional: o cliente pode gerá-lo para mostrar a tarefa antes da resposta.
- `project_id` e `label_ids` referem registos existentes.
- `project_name` e `label_names` (usados pelo Quick Add) procuram pelo nome,
  sem distinguir maiúsculas, e criam o que não existir. `project_name` não
  pode vir junto com `project_id`.
- `section_id` tem de pertencer ao projeto da tarefa; `parent_task_id` cria uma subtarefa.

`201` `{ "data": Task }`

`422` quando: há `due_time` sem `due_date`; há `recurrence_rule` sem
`due_date` ou a regra é inválida; `priority` está fora de 1 a 4; algum
identificador não existe ou é de outro utilizador.

### PATCH /tasks/{id} — Implementado

Os mesmos campos (exceto `id`, `project_name` e `label_names`), todos
opcionais. `label_ids` substitui a lista inteira.

```json
{ "title": "Pagar renda e condomínio", "priority": 2, "due_date": "2026-12-02" }
```

`200` `{ "data": Task }`. As alterações ficam no registo de atividade.

### DELETE /tasks/{id} — Implementado

Apagar suave: a tarefa deixa de aparecer, mas pode ser restaurada. `204`.

### POST /tasks/{id}/restore — Implementado

Desfaz o apagar. `200` `{ "data": Task }`

### POST /tasks/{id}/complete — Implementado

Sem corpo. `200`

```json
{ "data": Task, "meta": { "recurred": false } }
```

- Tarefa simples: fica com `is_completed: true` e `completed_at`.
- Tarefa recorrente: **não fecha**. `due_date` avança para a ocorrência
  seguinte (a primeira depois do vencimento atual que não seja anterior a
  hoje) e `meta.recurred` é `true`. A conclusão fica no registo de atividade
  com `occurrence_date`, `previous_due_date` e `next_due_date`.
- Concluir uma tarefa já concluída devolve `200` sem efeito.

### POST /tasks/{id}/reopen — Implementado

Sem corpo. Desfaz a última conclusão: reabre uma tarefa simples, ou repõe a
data anterior de uma tarefa recorrente. Sem nada para desfazer, devolve
`200` sem efeito. `200` `{ "data": Task }`

### POST /tasks/reschedule — Implementado

Muda a data de várias tarefas de uma vez ("Reagendar para hoje"). As horas mantêm-se.

```json
{ "task_ids": ["0193a0a3-01aa-…", "0193a0a3-02bb-…"], "due_date": "2026-11-14" }
```

Entre 1 e 200 identificadores. `200` `{ "data": [Task, …] }`. `422` se algum
identificador não for do utilizador; nesse caso nada é alterado.

## Subtarefas e reordenação

### GET /tasks/{id} — Planeado

A tarefa com as subtarefas aninhadas, os lembretes e o histórico.

```json
{ "data": { "…campos de Task…": "", "subtasks": [Task, …], "reminders": [Reminder, …] } }
```

### POST /tasks/reorder — Planeado

Arrastar dentro de uma lista, entre secções (Kanban) ou entre dias ("Em breve").
Só os campos presentes em cada item são alterados.

```json
{ "items": [
  { "id": "…", "position": 1, "section_id": "…" },
  { "id": "…", "position": 2, "section_id": "…", "due_date": "2026-11-16" }
] }
```

`200` `{ "data": [Task, …] }`

## Etiquetas

### GET /labels — Implementado

`200` `{ "data": [Label, …] }`, por nome.

### POST /labels — Implementado

```json
{ "name": "urgente", "color": "#d1453b" }
```

O nome não tem espaços (letras, dígitos, `_` e `-`) e é único por
utilizador, sem distinguir maiúsculas. `201` `{ "data": Label }`

### PATCH /labels/{id} — Planeado

```json
{ "name": "importante", "color": "#eb8909" }
```

### DELETE /labels/{id} — Planeado

Remove a etiqueta de todas as tarefas. `204`.

## Lembretes

### GET /tasks/{id}/reminders — Planeado

`200` `{ "data": [Reminder, …] }`

### POST /tasks/{id}/reminders — Planeado

Vários por tarefa. Relativo (precisa de `due_date` na tarefa):

```json
{ "type": "relative", "minutes_before": 30 }
```

Absoluto:

```json
{ "type": "absolute", "remind_at": "2026-11-30T09:00:00+00:00" }
```

`201` `{ "data": Reminder }`

### DELETE /reminders/{id} — Planeado

`204`

### Contrato do worker

Um comando agendado corre a cada minuto:

1. A API mantém `reminders.fire_at` atualizado. Para `absolute` é
   `remind_at`; para `relative` é o vencimento da tarefa (data e hora no fuso
   do utilizador; sem hora, 09:00) menos `minutes_before`. É recalculado
   quando a data da tarefa muda, incluindo ao avançar uma recorrência, altura
   em que `is_sent` volta a `false`.
2. O worker lê `reminders` com `fire_at <= now()` e `is_sent = false`
   (índice `reminders_pending_index`), ignorando tarefas concluídas ou apagadas.
3. Envia por Web Push para cada linha de `push_subscriptions` do utilizador
   e, se `notification_settings.email` estiver ativo, por e-mail.
4. Marca `is_sent = true` e `sent_at`. Subscrições que respondam 404 ou 410 são apagadas.

O resumo diário usa `notification_settings.daily_digest_time` no fuso de
cada utilizador e lista as tarefas de `view=today`.

O worker lê dados de todos os utilizadores, por isso corre com um papel de
base de dados próprio, não com o da API.

## Filtros

### GET /tasks?filter=… — Planeado

Pesquisa que combina critérios. Exemplo: `prioridade:P1 & #Trabalho & sem_data`.

| Termo | Significado |
|---|---|
| `prioridade:P1` … `prioridade:P4` | prioridade |
| `#Nome` | projeto (inclui sub-projetos) |
| `@nome` | etiqueta |
| `hoje`, `amanhã`, `em_atraso`, `sem_data` | vencimento |
| `próximos:7` | vence nos próximos 7 dias |
| `texto:"renda"` | título ou descrição contém |
| `&`, `\|`, `!`, `( )` | e, ou, não, agrupar |

`200` `{ "data": [Task, …], "meta": { "today": "2026-11-14" } }`. `422` com a
posição do erro se a expressão não for válida.

### GET /filters — Planeado

Filtros guardados. `200` `{ "data": [ { "id": "…", "name": "Urgente no trabalho", "query": "prioridade:P1 & #Trabalho", "position": 1 } ] }`

### POST /filters — Planeado

```json
{ "name": "Urgente no trabalho", "query": "prioridade:P1 & #Trabalho" }
```

## Em Breve

### GET /tasks?view=upcoming — Planeado

Parâmetros `from` e `to` (no máximo 62 dias). Para arrastar entre dias usa-se `POST /tasks/reorder`.

```json
{ "data": [Task, …], "meta": { "today": "2026-11-14", "from": "2026-11-14", "to": "2026-11-21" } }
```

As tarefas recorrentes aparecem só na próxima ocorrência.

## Registo de atividade

### GET /activity — Planeado

Parâmetros opcionais: `task_id`, `action`, `from`, `to`, `cursor`.

```json
{
  "data": [
    { "id": "…", "task_id": "…", "action": "completed",
      "payload": { "occurrence_date": "2026-12-01", "previous_due_date": "2026-12-01", "next_due_date": "2027-01-01" },
      "created_at": "2026-12-01T09:41:00+00:00" },
    { "id": "…", "task_id": "…", "action": "updated",
      "payload": { "changes": { "priority": [4, 2] } },
      "created_at": "2026-11-30T18:02:11+00:00" }
  ],
  "meta": { "next_cursor": "eyJpZCI6…" }
}
```

Ações: `created`, `updated`, `completed`, `reopened`, `deleted`, `restored`,
`rescheduled`. Já são todas gravadas; falta só o endpoint de leitura.

### GET /stats/productivity — Planeado

```json
{ "data": { "completed_today": 4, "completed_this_week": 19, "by_day": [ { "date": "2026-11-14", "completed": 4 } ] } }
```

## Subscrições push

### POST /push-subscriptions — Planeado

O corpo é o que `PushSubscription.toJSON()` devolve no browser.

```json
{ "endpoint": "https://fcm.googleapis.com/fcm/send/abc…", "keys": { "p256dh": "BNc…", "auth": "tBH…" } }
```

`201`. Repetir o mesmo `endpoint` atualiza as chaves.

### DELETE /push-subscriptions — Planeado

```json
{ "endpoint": "https://fcm.googleapis.com/fcm/send/abc…" }
```

`204`
