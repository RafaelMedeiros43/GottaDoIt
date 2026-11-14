#!/usr/bin/env bash
# Corre o teste de ponta a ponta: arranca a base de dados, a API e o
# frontend, e conduz um browser pela aplicação. Usa a base `gottadoit_test`,
# que é apagada e recriada; os dados de desenvolvimento não são tocados.
set -euo pipefail
cd "$(dirname "$0")/.."

scripts/dev-db.sh >/dev/null

export DB_DATABASE=gottadoit_test
(cd api && php artisan migrate:fresh --database=pgsql_admin --force >/dev/null)

LOGS=$(mktemp -d)
(cd api && exec php artisan serve --host=127.0.0.1 --port=8000 >"$LOGS/api.log" 2>&1) &
API_PID=$!
(cd web && exec npx vite --host 127.0.0.1 --port 5173 --strictPort >"$LOGS/web.log" 2>&1) &
WEB_PID=$!
trap 'kill $API_PID $WEB_PID 2>/dev/null || true' EXIT

for url in http://127.0.0.1:8000/up http://127.0.0.1:5173; do
  for _ in $(seq 1 60); do
    curl -fsS --noproxy '*' -o /dev/null "$url" 2>/dev/null && continue 2
    sleep 0.5
  done
  echo "Não arrancou: $url" >&2
  cat "$LOGS"/*.log >&2
  exit 1
done

node web/e2e/smoke.mjs
