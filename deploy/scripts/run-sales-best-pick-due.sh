#!/usr/bin/env bash
# Ежедневный вызов: 29-го (МСК) — уведомление админу выбрать лучшего ОП.
set -euo pipefail

ENV_FILE="${1:-/etc/vbi-hr/bitrix-production.env}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

TOKEN="${CRON_SECRET:-}"
if [[ -z "$TOKEN" ]]; then
  echo "CRON_SECRET не задан" >&2
  exit 1
fi

PORT="${NITRO_PORT:-3300}"
curl -fsS -X POST \
  -H "X-Cron-Token: ${TOKEN}" \
  "http://127.0.0.1:${PORT}/api/cron/sales-best-pick-due"
echo
