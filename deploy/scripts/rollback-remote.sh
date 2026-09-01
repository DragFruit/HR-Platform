#!/usr/bin/env bash
# Откат последнего деплоя: .output.prev → .output + restart.
# Использование: DEPLOY_HOST=… DEPLOY_USER=deploy bash deploy/scripts/rollback-remote.sh staging|production
set -euo pipefail

ENV="${1:?Укажите окружение: staging или production}"

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
if [[ -n "${DEPLOY_SSH_KEY:-}" && -f "${DEPLOY_SSH_KEY}" ]]; then
  SSH_CMD+=( -i "${DEPLOY_SSH_KEY}" -o IdentitiesOnly=yes )
elif [[ -f "${HOME}/.ssh/vbi_hr_deploy" ]]; then
  SSH_CMD+=( -i "${HOME}/.ssh/vbi_hr_deploy" -o IdentitiesOnly=yes )
fi

echo "→ rollback ${ENV}: ${REMOTE}:${DEPLOY_PATH}/.output.prev → .output"
"${SSH_CMD[@]}" "${REMOTE}" bash -s -- "${DEPLOY_PATH}" "${SERVICE}" <<'REMOTE'
set -euo pipefail
DEPLOY_PATH="$1"
SERVICE="$2"
if [[ ! -f "${DEPLOY_PATH}/.output.prev/server/index.mjs" ]]; then
  echo "Нет ${DEPLOY_PATH}/.output.prev — откатывать нечего" >&2
  exit 1
fi
# Текущий битый/новый артефакт прячем, предыдущий возвращаем.
rm -rf "${DEPLOY_PATH}/.output.failed"
if [[ -d "${DEPLOY_PATH}/.output" ]]; then
  mv "${DEPLOY_PATH}/.output" "${DEPLOY_PATH}/.output.failed"
fi
mv "${DEPLOY_PATH}/.output.prev" "${DEPLOY_PATH}/.output"
sudo systemctl restart "${SERVICE}"
sudo systemctl is-active "${SERVICE}"
echo "✓ откат выполнен; прежний (откатанный) артефакт в .output.failed"
REMOTE

echo "✓ Готово: rollback ${ENV} на ${DEPLOY_HOST}"
