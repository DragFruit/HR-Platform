@echo off
chcp 65001 >nul
setlocal

cd /d "%~dp0frontend"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js не найден. Установите LTS с https://nodejs.org/ и запустите снова.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

echo Building frontend...
call npm run build
if errorlevel 1 (
  echo Build failed.
  pause
  exit /b 1
)

set NITRO_PORT=3300
set NITRO_HOST=127.0.0.1
set URL=http://127.0.0.1:3300/

echo.
echo Starting VBI HR platform...
echo Open in browser: %URL%
echo Demo login: kostya@vbi.local / manager123
echo Close this window to stop the server.
echo.

start "" %URL%

node .output/server/index.mjs

pause
