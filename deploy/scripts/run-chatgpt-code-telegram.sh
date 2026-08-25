#!/usr/bin/env bash
# Раз в 2 минуты: коды ChatGPT с корпоративной почты → Telegram-канал.
# Вызов: POST /api/cron/chatgpt-code-telegram (нужен запущенный Nuxt/Nitro).
set -euo pipefail

ENV_FILE="${1:-/etc/vbi-hr/bitrix-production.env}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi
if [[ -f /var/www/vbi-hr/.env ]]; then
  set -a
  # shellcheck disable=SC1091
  source /var/www/vbi-hr/.env
  set +a
fi

TOKEN="${CRON_SECRET:-}"
if [[ -z "$TOKEN" ]]; then
  echo "CRON_SECRET не задан" >&2
  exit 1
fi

PORT="${NITRO_PORT:-3300}"
# staging часто 3301
if [[ "${2:-}" == "staging" ]]; then
  PORT="${NITRO_PORT:-3301}"
fi

curl -fsS -X POST \
  -H "X-Cron-Token: ${TOKEN}" \
  "http://127.0.0.1:${PORT}/api/cron/chatgpt-code-telegram"
echo
