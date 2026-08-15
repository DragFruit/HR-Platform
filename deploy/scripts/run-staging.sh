#!/bin/sh
set -eu
cd "$(dirname "$0")"
export NITRO_HOST="${NITRO_HOST:-127.0.0.1}"
export NITRO_PORT="${NITRO_PORT:-3301}"
# QA-отдел «Тестировщики» на стейдже (демо-логины, в т.ч. Алина для большой команды)
export NUXT_PUBLIC_QA_TEST_DEPARTMENT="${NUXT_PUBLIC_QA_TEST_DEPARTMENT:-1}"
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi
mkdir -p server/data
exec /usr/bin/node .output/server/index.mjs
