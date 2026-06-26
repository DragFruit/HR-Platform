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
"${SSH_CMD[@]}" "${REMOTE}" "sudo chown -R '${DEPLOY_USER}:www-data' '${DEPLOY_PATH}'"
"${SSH_CMD[@]}" "${REMOTE}" "mkdir -p '${DEPLOY_PATH}/.output'"
RSYNC_RSH="${RSYNC_SSH[*]}" rsync -az --delete "${OUTPUT_DIR}/" "${REMOTE}:${DEPLOY_PATH}/.output/"

case "$ENV" in
  staging)
    BITRIX_ENV_SRC="${BITRIX_ENV_STAGING:-/etc/vbi-hr/bitrix.env}"
    RUN_SCRIPT="${ROOT}/deploy/scripts/run-staging.sh"
    ;;
  production)
    BITRIX_ENV_SRC="${BITRIX_ENV_PRODUCTION:-/etc/vbi-hr/bitrix-production.env}"
    RUN_SCRIPT="${ROOT}/deploy/scripts/run-production.sh"
    ;;
esac

if "${SSH_CMD[@]}" "${REMOTE}" "test -r '${BITRIX_ENV_SRC}'"; then
  echo "→ копирование ${BITRIX_ENV_SRC} → ${DEPLOY_PATH}/.env"
  "${SSH_CMD[@]}" "${REMOTE}" "cp '${BITRIX_ENV_SRC}' '${DEPLOY_PATH}/.env' && chmod 600 '${DEPLOY_PATH}/.env'"
fi

if [[ -f "${RUN_SCRIPT}" ]]; then
  echo "→ установка $(basename "${RUN_SCRIPT}")"
  SCP_CMD=(scp -o IdentitiesOnly=yes)
  if [[ -n "${DEPLOY_SSH_KEY:-}" && -f "${DEPLOY_SSH_KEY}" ]]; then
    SCP_CMD=(scp -i "${DEPLOY_SSH_KEY}" -o IdentitiesOnly=yes)
  elif [[ -f "${HOME}/.ssh/vbi_hr_deploy" ]]; then
    SCP_CMD=(scp -i "${HOME}/.ssh/vbi_hr_deploy" -o IdentitiesOnly=yes)
  fi
  "${SCP_CMD[@]}" "${RUN_SCRIPT}" "${REMOTE}:${DEPLOY_PATH}/run.sh"
  "${SSH_CMD[@]}" "${REMOTE}" "chmod +x '${DEPLOY_PATH}/run.sh'"
fi

echo "→ перезапуск ${SERVICE}"
"${SSH_CMD[@]}" "${REMOTE}" "sudo systemctl restart '${SERVICE}' && sudo systemctl is-active '${SERVICE}'"

echo "✓ Готово: ${ENV} на ${DEPLOY_HOST}"
