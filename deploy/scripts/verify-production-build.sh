#!/usr/bin/env bash
# Перед выкладкой на бой: артефакт должен быть собран с production + vacations.
# Ломает сценарий «npm run build локально → deploy-remote.sh production» без env.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUTPUT_DIR="${1:-${ROOT}/frontend/.output}"

if [[ ! -d "${OUTPUT_DIR}" ]]; then
  echo "verify-production-build: нет каталога ${OUTPUT_DIR}" >&2
  exit 1
fi

# "appEnv": "production"  |  appEnv:"production"  |  экранированные варианты
# find + grep по файлам: deploy:production крутится на Alpine (BusyBox grep без --include).
extract_field() {
  local field="$1"
  while IFS= read -r -d '' f; do
    grep -ho "${field}[\"']\?:[[:space:]]*[\"'][^\"']*[\"']" "$f" 2>/dev/null || true
  done < <(
    find "${OUTPUT_DIR}" -type f \( -name '*.mjs' -o -name '*.js' -o -name '*.json' \) \
      ! -path '*/node_modules/*' -print0 2>/dev/null
  ) \
    | sed -E "s/.*[\"']([^\"']+)[\"'][[:space:]]*$/\1/" \
    | sort -u || true
}

APP_ENVS="$(extract_field appEnv)"
SCOPES="$(extract_field launchScope)"

echo "→ appEnv в артефакте: ${APP_ENVS:-«не найдено»}"
echo "→ launchScope в артефакте: ${SCOPES:-«не найдено»}"

if [[ -z "${APP_ENVS}" || -z "${SCOPES}" ]]; then
  echo "verify-production-build: не найден runtimeConfig (appEnv/launchScope) в ${OUTPUT_DIR}" >&2
  echo "Соберите через: bash deploy/scripts/build-and-deploy.sh production" >&2
  exit 1
fi

if echo "${APP_ENVS}" | grep -qw development; then
  echo "✗ ABORT: в артефакте appEnv=development — нельзя на бой (откроются черновики разделов)" >&2
  echo "  Нужно: NUXT_PUBLIC_APP_ENV=production NUXT_PUBLIC_LAUNCH_SCOPE=vacations npm run build" >&2
  exit 1
fi

if ! echo "${APP_ENVS}" | grep -qw production; then
  echo "✗ ABORT: нет appEnv=production в артефакте" >&2
  exit 1
fi

if echo "${SCOPES}" | grep -qw full; then
  echo "✗ ABORT: в артефакте launchScope=full — нельзя на бой (снимаются замки меню)" >&2
  echo "  Нужно: NUXT_PUBLIC_LAUNCH_SCOPE=vacations" >&2
  exit 1
fi

if ! echo "${SCOPES}" | grep -qw vacations; then
  echo "✗ ABORT: нет launchScope=vacations в артефакте" >&2
  exit 1
fi

echo "✓ production build OK (appEnv=production, launchScope=vacations)"
