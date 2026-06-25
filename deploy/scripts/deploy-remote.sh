#!/usr/bin/env bash
# Выкладка артефакта .output на сервер (из GitLab CI или вручную после локальной сборки).
set -euo pipefail

ENV="${1:?Укажите окружение: staging или production}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUTPUT_DIR="${ROOT}/frontend/.output"

if [[ ! -f "${OUTPUT_DIR}/server/index.mjs" ]]; then
  echo "Не найден ${OUTPUT_DIR}/server/index.mjs — сначала выполните npm run build в frontend/" >&2
  exit 1
fi

: "${DEPLOY_HOST:?Задайте DEPLOY_HOST}"
: "${DEPLOY_USER:?Задайте DEPLOY_USER}"

case "$ENV" in
  staging)
    DEPLOY_PATH="${DEPLOY_PATH_STAGING:-/var/www/vbi-hr-staging}"
    SERVICE="${SYSTEMD_SERVICE_STAGING:-vbi-hr-staging}"
    ;;
  production)
    DEPLOY_PATH="${DEPLOY_PATH_PRODUCTION:-/var/www/vbi-hr}"
    SERVICE="${SYSTEMD_SERVICE_PRODUCTION:-vbi-hr}"
    ;;
  *)
    echo "Неизвестное окружение: $ENV" >&2
    exit 1
    ;;
esac

REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"

echo "→ ${ENV}: rsync .output → ${REMOTE}:${DEPLOY_PATH}/.output/"
ssh "${REMOTE}" "mkdir -p '${DEPLOY_PATH}/.output'"
rsync -az --delete "${OUTPUT_DIR}/" "${REMOTE}:${DEPLOY_PATH}/.output/"

echo "→ перезапуск ${SERVICE}"
ssh "${REMOTE}" "sudo systemctl restart '${SERVICE}' && sudo systemctl is-active '${SERVICE}'"

echo "✓ Готово: ${ENV} на ${DEPLOY_HOST}"
