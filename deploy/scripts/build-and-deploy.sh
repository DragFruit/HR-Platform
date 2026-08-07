#!/usr/bin/env bash
# Локальная сборка и выкладка на сервер (без GitLab CI).
set -euo pipefail

ENV="${1:?Укажите окружение: staging или production}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

case "$ENV" in
  staging) APP_ENV=staging; ORG_LINKS=true; LAUNCH_SCOPE=full ;;
  production) APP_ENV=production; ORG_LINKS=true; LAUNCH_SCOPE=vacations ;;
  *) echo "Неизвестное окружение: $ENV" >&2; exit 1 ;;
esac

echo "→ npm ci && build (${APP_ENV}, scope=${LAUNCH_SCOPE})"
cd "${ROOT}/frontend"
npm ci
NUXT_PUBLIC_APP_ENV="${APP_ENV}" NUXT_PUBLIC_LAUNCH_SCOPE="${LAUNCH_SCOPE}" NUXT_PUBLIC_ORG_LINKS_ENABLED="${ORG_LINKS}" npm run build

echo "→ deploy"
cd "${ROOT}"
bash deploy/scripts/deploy-remote.sh "${ENV}"
