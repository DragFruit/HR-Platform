#!/bin/zsh
set -e

# Запуск полной платформы VIBE VBI (вход, главная, задачи, отпуска, структура…)
PROJECT_DIR="$(cd "$(dirname "$0")/frontend" && pwd)"
PORT=3300
URL="http://127.0.0.1:$PORT/"

for p in 3000 3300; do
  lsof -ti tcp:$p | xargs kill -9 2>/dev/null || true
done

cd "$PROJECT_DIR"

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

echo "Building frontend..."
npm run build

echo "Starting VIBE VBI..."
NITRO_PORT="$PORT" NITRO_HOST="127.0.0.1" node .output/server/index.mjs &
DEV_PID=$!

sleep 3
open "$URL"

echo ""
echo "Платформа: $URL"
echo "Демо-вход: stas@vbi.local / admin123 (админ)"
echo "Закройте это окно терминала, чтобы остановить сервер."
wait $DEV_PID
