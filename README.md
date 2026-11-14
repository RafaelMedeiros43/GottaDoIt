# GottaDoIt

Aplicação web de tarefas, agenda e lembretes. Esta é a primeira fase: a
fundação (base de dados, API, parser) e as duas peças de uso diário, a vista
**Hoje** e o **Quick Add**.

| Pasta | O que é |
|---|---|
| `api/` | API REST em Laravel 13 com Sanctum, sobre PostgreSQL |
| `web/` | Frontend em React 19 (Vite, TypeScript, Tailwind, TanStack Query) |
| `docs/api.md` | Todos os endpoints, com exemplos JSON |
| `api/database/sql/001_schema.sql` | Esquema SQL completo, com índices e RLS |
| `web/src/lib/quick-add-parser/` | Parser de linguagem natural em português |
| `docs/superpowers/` | Desenho e plano de implementação desta fase |

## Arrancar localmente

Precisa de PHP 8.3+, Composer, Node 22+ e PostgreSQL 15+.

```bash
scripts/dev-db.sh
```

Arranca um PostgreSQL local na porta 54329 e cria o papel `gottadoit_app` e
as bases `gottadoit` e `gottadoit_test`. Se já tiveres um PostgreSQL, cria-os
à mão (ver "Supabase" abaixo) e ajusta `api/.env`.

```bash
cd api && composer install && cp .env.example .env && php artisan key:generate
```

```bash
cd api && php artisan migrate --database=pgsql_admin
```

```bash
cd api && php artisan serve
```

```bash
cd web && npm install && npm run dev
```

Abre http://localhost:5173. O Vite encaminha `/api` para a API em
`http://127.0.0.1:8000`.

## Testes

```bash
cd api && php artisan test
```

```bash
cd web && npm test -- --run
```

```bash
scripts/e2e.sh
```

O último conduz um browser pela aplicação inteira (criar conta, Quick Add,
concluir, desfazer). Usa a base `gottadoit_test`, que é apagada e recriada.

## Como os dados ficam isolados por utilizador

Há duas barreiras. A API só consulta dados do utilizador autenticado. E a
própria base de dados recusa o resto, com Row-Level Security:

- A API liga-se com o papel `gottadoit_app`, que não é dono das tabelas nem
  tem `BYPASSRLS`. As migrações correm com outro papel (`pgsql_admin`).
- Cada pedido autenticado corre numa transação que começa por definir
  `app.user_id`. As políticas comparam `user_id` com esse valor.
- Sem esse valor definido, não se vê nenhuma linha.

`api/tests/Feature/RlsIsolationTest.php` prova isto com consultas sem
nenhum filtro por utilizador.

## Usar o Supabase

O Supabase entra só como PostgreSQL alojado; o login é do Laravel (Sanctum).

1. No SQL Editor do Supabase, cria o papel da aplicação com uma palavra-passe tua:

   ```sql
   CREATE ROLE gottadoit_app LOGIN PASSWORD '<palavra-passe>' NOSUPERUSER NOBYPASSRLS;
   ```

2. Em `api/.env`, aponta para o projeto:

   ```
   DB_HOST=<host do projeto ou do pooler>
   DB_PORT=5432
   DB_DATABASE=postgres
   DB_USERNAME=gottadoit_app
   DB_PASSWORD=<palavra-passe>
   DB_ADMIN_USERNAME=postgres
   DB_ADMIN_PASSWORD=<palavra-passe do projeto>
   DB_SSLMODE=require
   ```

   Com o pooler, o nome de utilizador leva o sufixo do projeto
   (`gottadoit_app.<ref>`), e tanto o modo sessão como o modo transação
   funcionam, porque o contexto RLS é definido dentro de cada transação.

3. Corre as migrações com o papel de administração:

   ```bash
   cd api && php artisan migrate --database=pgsql_admin
   ```

Usa o Session pooler (botão Connect no painel): a ligação direta
`db.<ref>.supabase.co` só funciona por IPv6.

Os papéis públicos do Supabase (`anon`, `authenticated`) não recebem nenhuma
política, e o esquema retira-lhes as permissões que o Supabase dá por omissão
às tabelas de `public`. Assim a API de dados automática não expõe nada,
incluindo `users` e `personal_access_tokens`, que não têm RLS.

Testado contra um projeto Supabase (PostgreSQL 17, Session pooler): registo,
criação e leitura de tarefas.

## Quick Add

Abre com `Q` ou `Ctrl/Cmd + K`. O texto é interpretado enquanto se escreve:

| Escreves | Fica |
|---|---|
| `amanhã`, `sexta`, `próxima semana`, `dia 15`, `15/03`, `15 de março`, `daqui a 3 dias` | data |
| `às 15h`, `15h30`, `15:30`, `às 9 da manhã`, `ao meio-dia` | hora |
| `todos os dias`, `toda segunda-feira`, `a cada 2 dias`, `todo dia 1`, `todos os dias úteis` | recorrência |
| `#Trabalho` | projeto (criado se não existir) |
| `@urgente` | etiqueta (criada se não existir) |
| `p1` a `p4` | prioridade |

Funciona com ou sem acentos. Regras a saber:

- Um dia da semana aponta sempre para a próxima ocorrência depois de hoje
  ("sexta" numa sexta-feira é a da semana seguinte).
- Uma hora sem data fica para hoje.
- "segunda" a "sexta" sozinhas só contam como data no fim da frase ou antes
  de outro marcador, para "Pedir segunda via" não ganhar uma data. Com
  "-feira", "na" ou "próxima" contam em qualquer posição.
- "1h" a "6h" sem "às" são lidas como duração ("Estudar 2h"), não como hora.

## O que ainda não existe

Está desenhado no esquema e em `docs/api.md` (marcado como **Planeado**), mas
sem código: Em Breve no frontend, quadro Kanban,
drag-and-drop, filtros, painel de detalhes e subtarefas na interface, envio
de lembretes (Web Push, e-mail, resumo diário), modo offline, navegação
completa por teclado, recuperação de palavra-passe.
