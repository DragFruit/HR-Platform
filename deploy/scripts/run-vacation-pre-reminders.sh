#!/usr/bin/env bash
# Ежедневный вызов напоминаний «за 3 недели до отпуска».
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

TOKEN="${VACATION_PRE_REMINDER_CRON_SECRET:-${CRON_SECRET:-}}"
if [[ -z "$TOKEN" ]]; then
  echo "VACATION_PRE_REMINDER_CRON_SECRET / CRON_SECRET не задан" >&2
  exit 1
fi

PORT="${NITRO_PORT:-3300}"
curl -fsS -X POST \
  -H "X-Cron-Token: ${TOKEN}" \
  "http://127.0.0.1:${PORT}/api/cron/vacation-pre-reminders"
echo
