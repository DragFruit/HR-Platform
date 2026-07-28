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
SCP_CMD=(scp -o IdentitiesOnly=yes)
if [[ -n "${DEPLOY_SSH_KEY:-}" && -f "${DEPLOY_SSH_KEY}" ]]; then
  SSH_CMD+=( -i "${DEPLOY_SSH_KEY}" -o IdentitiesOnly=yes )
  RSYNC_SSH+=( -i "${DEPLOY_SSH_KEY}" -o IdentitiesOnly=yes )
  SCP_CMD=(scp -i "${DEPLOY_SSH_KEY}" -o IdentitiesOnly=yes)
elif [[ -f "${HOME}/.ssh/id_rsa" && -n "${CI:-}" ]]; then
  SSH_CMD+=( -i "${HOME}/.ssh/id_rsa" -o IdentitiesOnly=yes )
  RSYNC_SSH+=( -i "${HOME}/.ssh/id_rsa" -o IdentitiesOnly=yes )
  SCP_CMD=(scp -i "${HOME}/.ssh/id_rsa" -o IdentitiesOnly=yes)
elif [[ -f "${HOME}/.ssh/vbi_hr_deploy" ]]; then
  SSH_CMD+=( -i "${HOME}/.ssh/vbi_hr_deploy" -o IdentitiesOnly=yes )
  RSYNC_SSH+=( -i "${HOME}/.ssh/vbi_hr_deploy" -o IdentitiesOnly=yes )
  SCP_CMD=(scp -i "${HOME}/.ssh/vbi_hr_deploy" -o IdentitiesOnly=yes)
fi

echo "→ ${ENV}: rsync .output → ${REMOTE}:${DEPLOY_PATH}/.output/"
"${SSH_CMD[@]}" "${REMOTE}" "sudo chown -R '${DEPLOY_USER}:www-data' '${DEPLOY_PATH}'"
"${SSH_CMD[@]}" "${REMOTE}" "mkdir -p '${DEPLOY_PATH}/.output' '${DEPLOY_PATH}/server/data'"
RSYNC_RSH="${RSYNC_SSH[*]}" rsync -az --delete "${OUTPUT_DIR}/" "${REMOTE}:${DEPLOY_PATH}/.output/"

SEED_DATA_DIR="${ROOT}/frontend/server/data"
MERGE_SCRIPT="${ROOT}/deploy/scripts/merge-employees-seed.mjs"
REMOTE_DATA="${DEPLOY_PATH}/server/data"
REMOTE_MANAGERS="${REMOTE_DATA}/employee-managers.json"

"${SSH_CMD[@]}" "${REMOTE}" "test -f '${REMOTE_MANAGERS}' || printf '%s\\n' '{\"byId\":{},\"byName\":{}}' > '${REMOTE_MANAGERS}'"

for seed in adaptation-track.json employees.json vacations.json ideas.json; do
  if [[ ! -f "${SEED_DATA_DIR}/${seed}" ]]; then
    continue
  fi

  if [[ "${seed}" == "employees.json" ]] && "${SSH_CMD[@]}" "${REMOTE}" "test -f '${REMOTE_DATA}/${seed}'"; then
    echo "→ merge ${seed} (production — данные с сервера, +новые из репо, руководители из overlay)"
    INCOMING="${REMOTE_DATA}/.employees-incoming.json"
    "${SCP_CMD[@]}" "${SEED_DATA_DIR}/${seed}" "${REMOTE}:${INCOMING}"
    "${SCP_CMD[@]}" "${MERGE_SCRIPT}" "${REMOTE}:${DEPLOY_PATH}/merge-employees-seed.mjs"
    "${SSH_CMD[@]}" "${REMOTE}" "node '${DEPLOY_PATH}/merge-employees-seed.mjs' '${REMOTE_DATA}/${seed}' '${INCOMING}' '${REMOTE_MANAGERS}' && rm -f '${INCOMING}'"
    continue
  fi

  if [[ "${seed}" == "vacations.json" ]] && "${SSH_CMD[@]}" "${REMOTE}" "test -f '${REMOTE_DATA}/${seed}'"; then
    echo "→ skip ${seed} (заявки и primaryYear остаются с сервера)"
    continue
  fi

  if [[ "${seed}" == "ideas.json" ]] && "${SSH_CMD[@]}" "${REMOTE}" "test -f '${REMOTE_DATA}/${seed}'"; then
    echo "→ skip ${seed} (очередь идей остаётся с сервера)"
    continue
  fi

  echo "→ seed ${seed} → ${REMOTE_DATA}/"
  "${SCP_CMD[@]}" "${SEED_DATA_DIR}/${seed}" "${REMOTE}:${REMOTE_DATA}/${seed}"
done

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
  "${SCP_CMD[@]}" "${RUN_SCRIPT}" "${REMOTE}:${DEPLOY_PATH}/run.sh"
  "${SSH_CMD[@]}" "${REMOTE}" "chmod +x '${DEPLOY_PATH}/run.sh'"
fi

echo "→ перезапуск ${SERVICE}"
"${SSH_CMD[@]}" "${REMOTE}" "sudo systemctl restart '${SERVICE}' && sudo systemctl is-active '${SERVICE}'"

echo "✓ Готово: ${ENV} на ${DEPLOY_HOST}"
