#!/bin/sh
set -eu
cd "$(dirname "$0")"
export NITRO_HOST="${NITRO_HOST:-127.0.0.1}"
export NITRO_PORT="${NITRO_PORT:-3300}"
export NUXT_PUBLIC_APP_ENV="${NUXT_PUBLIC_APP_ENV:-production}"
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi
mkdir -p server/data
exec /usr/bin/node .output/server/index.mjs
