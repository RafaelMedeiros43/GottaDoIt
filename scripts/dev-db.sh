#!/usr/bin/env bash
# Arranca um PostgreSQL local para desenvolvimento e testes (porta 54329),
# cria o papel da aplicação e as bases de dados. Pode correr várias vezes.
#
# O papel `gottadoit_app` não é superutilizador, não é dono das tabelas e não
# tem BYPASSRLS: é com ele que a API se liga, para o RLS se aplicar sempre.
# As migrações correm com o superutilizador `postgres`.
set -euo pipefail

PORT=${GOTTADOIT_PG_PORT:-54329}
DATA=${GOTTADOIT_PG_DATA:-/var/lib/postgresql/gottadoit-dev}
BIN=$(dirname "$(ls /usr/lib/postgresql/*/bin/pg_ctl 2>/dev/null | sort -V | tail -1)")
[ -x "$BIN/pg_ctl" ] || { echo "PostgreSQL não encontrado em /usr/lib/postgresql" >&2; exit 1; }

# O PostgreSQL recusa correr como root: nesse caso usa o utilizador `postgres`.
as_pg() { if [ "$(id -u)" = 0 ]; then runuser -u postgres -- "$@"; else "$@"; fi; }

if [ ! -f "$DATA/PG_VERSION" ]; then
  mkdir -p "$DATA"
  [ "$(id -u)" = 0 ] && chown postgres:postgres "$DATA"
  as_pg "$BIN/initdb" -D "$DATA" -U postgres --auth-local=trust --auth-host=scram-sha-256 -E UTF8 >/dev/null
fi

if ! as_pg "$BIN/pg_isready" -q -h 127.0.0.1 -p "$PORT"; then
  as_pg "$BIN/pg_ctl" -D "$DATA" -o "-p $PORT -c listen_addresses=127.0.0.1 -k /tmp" -l "$DATA/server.log" -w start >/dev/null
fi

psql_admin() { as_pg "$BIN/psql" -h /tmp -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -qtA "$@"; }

psql_admin -d postgres <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gottadoit_app') THEN
    CREATE ROLE gottadoit_app LOGIN PASSWORD 'secret' NOSUPERUSER NOBYPASSRLS NOCREATEDB;
  END IF;
END $$;
ALTER ROLE postgres PASSWORD 'postgres';
SQL

for db in gottadoit gottadoit_test; do
  exists=$(psql_admin -d postgres -c "SELECT 1 FROM pg_database WHERE datname = '$db'")
  [ "$exists" = 1 ] || psql_admin -d postgres -c "CREATE DATABASE $db OWNER postgres"
done

echo "PostgreSQL pronto em 127.0.0.1:$PORT (bases: gottadoit, gottadoit_test)"
