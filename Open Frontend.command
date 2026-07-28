#!/bin/zsh
set -e

# Локальный запуск как на production: только отпуска + демо «Тестировщики».
PROJECT_DIR="$(cd "$(dirname "$0")/frontend" && pwd)"
PORT=3300
URL="http://127.0.0.1:$PORT/vacations"

export NUXT_PUBLIC_APP_ENV=development
export NUXT_PUBLIC_LAUNCH_SCOPE=vacations
export NUXT_PUBLIC_ORG_LINKS_ENABLED=false
export NUXT_PUBLIC_QA_TEST_DEPARTMENT=1

for p in 3000 3300; do
  lsof -ti tcp:$p | xargs kill -9 2>/dev/null || true
done

cd "$PROJECT_DIR"

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

echo "Building frontend (отпуска, демо QA)..."
rm -rf .output
npm run build

echo "Starting VIBE VBI..."
NODE_ENV=development NITRO_PORT="$PORT" NITRO_HOST="127.0.0.1" node .output/server/index.mjs &
DEV_PID=$!

sleep 3
open "$URL"

echo ""
echo "Отпуска: $URL"
echo "Демо-сотрудник: katya@vbi.local / employee123 (Даша Тестова)"
echo "Демо-руководитель: kostya@vbi.local / manager123"
echo "Закройте это окно терминала, чтобы остановить сервер."
wait $DEV_PID
