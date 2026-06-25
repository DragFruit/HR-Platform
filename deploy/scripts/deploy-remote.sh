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

SSH_CMD=(ssh)
RSYNC_SSH=(ssh)
if [[ -n "${DEPLOY_SSH_KEY:-}" && -f "${DEPLOY_SSH_KEY}" ]]; then
  SSH_CMD+=( -i "${DEPLOY_SSH_KEY}" -o IdentitiesOnly=yes )
  RSYNC_SSH+=( -i "${DEPLOY_SSH_KEY}" -o IdentitiesOnly=yes )
elif [[ -f "${HOME}/.ssh/id_rsa" && -n "${CI:-}" ]]; then
  SSH_CMD+=( -i "${HOME}/.ssh/id_rsa" -o IdentitiesOnly=yes )
  RSYNC_SSH+=( -i "${HOME}/.ssh/id_rsa" -o IdentitiesOnly=yes )
elif [[ -f "${HOME}/.ssh/vbi_hr_deploy" ]]; then
  SSH_CMD+=( -i "${HOME}/.ssh/vbi_hr_deploy" -o IdentitiesOnly=yes )
  RSYNC_SSH+=( -i "${HOME}/.ssh/vbi_hr_deploy" -o IdentitiesOnly=yes )
fi

echo "→ ${ENV}: rsync .output → ${REMOTE}:${DEPLOY_PATH}/.output/"
"${SSH_CMD[@]}" "${REMOTE}" "mkdir -p '${DEPLOY_PATH}/.output'"
RSYNC_RSH="${RSYNC_SSH[*]}" rsync -az --delete "${OUTPUT_DIR}/" "${REMOTE}:${DEPLOY_PATH}/.output/"

echo "→ перезапуск ${SERVICE}"
"${SSH_CMD[@]}" "${REMOTE}" "sudo systemctl restart '${SERVICE}' && sudo systemctl is-active '${SERVICE}'"

echo "✓ Готово: ${ENV} на ${DEPLOY_HOST}"
