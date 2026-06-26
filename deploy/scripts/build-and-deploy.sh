#!/usr/bin/env bash
# Локальная сборка и выкладка на сервер (без GitLab CI).
set -euo pipefail

ENV="${1:?Укажите окружение: staging или production}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

case "$ENV" in
  staging) APP_ENV=staging ;;
  production) APP_ENV=production ;;
  *) echo "Неизвестное окружение: $ENV" >&2; exit 1 ;;
esac

echo "→ npm ci && build (${APP_ENV})"
cd "${ROOT}/frontend"
npm ci
NUXT_PUBLIC_APP_ENV="${APP_ENV}" NUXT_PUBLIC_LAUNCH_SCOPE=full npm run build

echo "→ deploy"
cd "${ROOT}"
bash deploy/scripts/deploy-remote.sh "${ENV}"
