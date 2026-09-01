#!/usr/bin/env bash
# Прогрев RAG после деплоя (тот же хост, loopback).
set -eu
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${ROOT}"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

PORT="${NITRO_PORT:-3300}"
SECRET="${CRON_SECRET:-}"
if [[ -z "${SECRET}" ]]; then
  echo "knowledge-rag-reindex: CRON_SECRET пуст — пропуск (прогрев всё равно на старте Nitro)"
  exit 0
fi

echo "→ knowledge-rag-reindex на 127.0.0.1:${PORT}"
curl -sS -m 600 -X POST \
  -H "X-Cron-Token: ${SECRET}" \
  -H "Content-Type: application/json" \
  "http://127.0.0.1:${PORT}/api/cron/knowledge-rag-reindex" \
  || echo "knowledge-rag-reindex: curl failed (индекс догонит warm-plugin или первый запрос)"
