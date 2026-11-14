# GottaDoIt — desenho da primeira fase

Data: 2026-11-14

## Intenção

Uma aplicação web de tarefas, agenda e lembretes ao estilo Todoist: criar
tarefas depressa, ver o que há para hoje, e confiar que os dados ficam
guardados. Esta primeira fase entrega a fundação e as duas peças de uso
diário, a funcionar de ponta a ponta.

## Objetivos desta fase

1. Esquema SQL completo (todas as entidades do pedido, chaves estrangeiras,
   índices, RLS).
2. API REST documentada na totalidade, com exemplos JSON; a parte necessária
   para "Hoje" e "Quick Add" implementada e testada.
3. Parser de linguagem natural em TypeScript, em português, com testes.
4. Frontend com a vista "Hoje" e o modal "Quick Add" funcionais, com
   atualizações otimistas e "Desfazer".

## Fora desta fase

Ficam desenhados no esquema e na documentação da API, mas sem código:
drag-and-drop, vista "Em breve", quadro Kanban, filtros avançados, painel de
detalhes da tarefa, envio de lembretes (Web Push, e-mail, resumo diário),
modo offline, navegação completa por teclado.

## O que seria um fracasso

- Um utilizador conseguir ler ou alterar dados de outro.
- Concluir uma tarefa recorrente e perder o histórico ou a próxima data.
- "Hoje" mostrar o dia errado por causa do fuso horário.
- A criação de tarefas parecer lenta (esperar pelo servidor para aparecer).

## Abordagens consideradas

| Opção | Como funciona | Custo |
|---|---|---|
| **1. Laravel Sanctum + Supabase como PostgreSQL** (escolhida pelo utilizador) | Login e tokens no Laravel. RLS como segunda barreira. | Recuperação de palavra-passe e login social ficam por nossa conta. |
| 2. Supabase Auth + Laravel a validar tokens | Login social e e-mails prontos. | Utilizadores em dois sítios; a API depende do Supabase. |
| 3. React direto ao Supabase | O mais rápido de montar. | Deixa de haver API REST com validação própria. |

Stack decidida pelo utilizador: React, Laravel, PostgreSQL no Supabase,
opção 1 para o login.

## Arquitetura

```
web/   React + Vite + TypeScript + Tailwind + Shadcn/UI + TanStack Query
api/   Laravel + Sanctum (tokens Bearer) + PostgreSQL
docs/  api.md (todos os endpoints), este documento
```

O frontend fala só com a API. A API é a única coisa que fala com a base de
dados.

### Base de dados

- O esquema vive num único ficheiro SQL (`api/database/sql/001_schema.sql`),
  que uma migração Laravel executa. É a entrega n.º 1 e a única fonte de
  verdade.
- Tabelas: `users`, `projects`, `sections`, `tasks`, `labels`, `task_labels`,
  `reminders`, `activity_log`, `push_subscriptions`, mais
  `personal_access_tokens` do Sanctum.
- Chaves primárias UUID. Todas as tabelas de dados têm `user_id`, para o RLS
  e para os índices por utilizador.
- `tasks.due_date` é `date` e `tasks.due_time` é `time`, ambos no fuso do
  utilizador. "Hoje" calcula-se com `users.timezone`.
- Apagar uma tarefa é um apagar suave (`deleted_at`), para o "Desfazer".
- Índices principais: tarefas abertas por utilizador e data; por projeto,
  secção e posição; por tarefa-mãe; lembretes por enviar ordenados por hora.

### RLS

- A API liga-se com um papel próprio (`gottadoit_app`), sem privilégio de
  ignorar RLS. As migrações correm com o papel de administração.
- Em cada pedido autenticado, um middleware abre uma transação e define
  `app.user_id`. As políticas comparam `user_id` com esse valor.
- `users` e `personal_access_tokens` não têm RLS: são consultadas antes de se
  saber quem é o utilizador (login, validação do token).
- Os papéis públicos do Supabase (`anon`, `authenticated`) não recebem
  nenhuma política, por isso a API de dados automática do Supabase não expõe
  nada.

### API

Prefixo `/api/v1`, JSON, autenticação `Authorization: Bearer <token>`,
validação com Form Requests, erros 422 com mensagens por campo.

Implementado nesta fase:

- `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`
- `GET /me`, `PATCH /me`
- `GET /projects`, `POST /projects`
- `GET /labels`, `POST /labels`
- `GET /tasks?view=today|inbox`, `POST /tasks`, `PATCH /tasks/{id}`,
  `DELETE /tasks/{id}`, `POST /tasks/{id}/restore`
- `POST /tasks/{id}/complete`, `POST /tasks/{id}/reopen`
- `POST /tasks/reschedule` (em massa, para "Reagendar para hoje")

Só documentado: secções, reordenação, subtarefas, lembretes, filtros,
registo de atividade, subscrições push, vista "Em breve".

### Tarefas recorrentes

- A regra guarda-se em formato RRULE reduzido (`FREQ`, `INTERVAL`, `BYDAY`,
  `BYMONTHDAY`), mais o texto original que o utilizador escreveu.
- Concluir uma tarefa recorrente não a fecha: regista a conclusão no
  `activity_log` (com a data da ocorrência) e avança `due_date` para a
  próxima ocorrência futura.
- "Desfazer" repõe a data anterior, lida do registo.
- O cálculo é feito no Laravel, numa classe pequena e testada.

### Parser (TypeScript, no frontend)

Função pura `parseQuickAdd(texto, agora, opções)` que devolve título limpo,
data, hora, regra de recorrência, projeto, etiquetas, prioridade e as
posições de cada pedaço reconhecido (para os realçar no campo).

Reconhece:

- Datas: `hoje`, `amanhã`, `depois de amanhã`, dias da semana (`sexta`,
  `sexta-feira`, `próxima sexta`), `dia 15`, `15/03`, `15 de março`,
  `daqui a 3 dias`, `próxima semana`.
- Horas: `às 15h`, `15h30`, `15:30`, `às 9 da manhã`, `ao meio-dia`.
- Recorrência: `todos os dias`, `toda segunda-feira`, `todas as segundas`,
  `a cada 2 dias`, `todas as semanas`, `todos os meses`, `todo dia 1`.
- `#Projeto`, `@etiqueta` (várias), `p1` a `p4`.

Aceita texto com ou sem acentos. Respeita o início de semana do utilizador.

### Frontend

- Ecrã de login/registo, layout com barra lateral, vista "Hoje".
- "Hoje": secção "Em atraso" com o botão "Reagendar para hoje", depois as
  tarefas de hoje ordenadas por hora e prioridade. Marcar como concluída e
  apagar são instantâneos, com aviso "Desfazer" durante 5 segundos.
- "Quick Add": abre com `Q` ou `Ctrl/Cmd+K`. O texto é analisado enquanto se
  escreve; os pedaços reconhecidos ficam realçados e aparecem como etiquetas
  por baixo do campo. `Enter` cria, `Esc` fecha.
- Tema claro e escuro, seguindo o sistema, com opção manual.
- Interface em português de Portugal.

## Decisões minhas (podem ser corrigidas)

- Dois projetos no mesmo repositório (`web/` e `api/`).
- Um `#projeto` ou `@etiqueta` que não exista é criado ao submeter, e o
  modal mostra-o como "novo".
- A próxima ocorrência conta a partir da data de vencimento, não da data de
  conclusão.
- Cálculo de recorrência próprio, em vez de uma biblioteca, por só cobrir
  quatro campos da regra.
- Registo aberto (qualquer pessoa pode criar conta), sem verificação de
  e-mail nesta fase.

## Testes

- API: testes de funcionalidade contra PostgreSQL real, incluindo um teste
  que prova que o RLS bloqueia dados de outro utilizador mesmo sem o filtro
  da aplicação, e testes de fuso horário para "Hoje".
- Recorrência: testes unitários da classe de cálculo.
- Parser: testes unitários (Vitest) para cada expressão acima.
- Frontend: um teste no browser (Playwright) que faz login, cria uma tarefa
  pelo Quick Add, conclui-a e desfaz.

## Deixado ao construtor

Nomes de classes e componentes, estrutura interna das pastas, estilos
visuais dentro do Shadcn/UI, formato exato das mensagens de erro.
