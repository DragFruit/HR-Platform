# Коды ChatGPT → корпоративный Telegram

Параллельно кнопке **«Код ChatGPT»** в `/vpn`: тот же IMAP, отдельный пайплайн в канал/чат через бота. UI `/vpn` не отключается.

## Схема

1. systemd timer / cron каждые **2 минуты** дергает `POST /api/cron/chatgpt-code-telegram`.
2. Сервер читает INBOX (те же критерии, что `/api/vpn/chatgpt-code`):
   - from: `noreply@tm.openai.com`
   - маркер: `Please use the following code to help verify your identity:`
   - окно свежести: **~1 час** (`openaiChatgptMailCode.ts`)
3. Новые коды (не в state) → `sendMessage` бота в `TELEGRAM_CHAT_ID`.
4. Дедуп: `server/data/chatgpt-code-telegram-state.json` (не слать один код повторно).

## Env

| Переменная | Назначение |
|------------|------------|
| `EMAIL_LOGIN` / `EMAIL_PASSWORD` (или `PASSWORD`) | IMAP, как для `/vpn` |
| `EMAIL_IMAP_HOST` / `EMAIL_IMAP_PORT` | опционально, default Gmail 993 |
| `TELEGRAM_BOT_TOKEN` | токен от @BotFather |
| `TELEGRAM_CHAT_ID` или `TELEGRAM_CHANNEL_ID` | id канала/чата (часто `-100…`) |
| `CRON_SECRET` | защита cron API (`X-Cron-Token`) |
| `CHATGPT_CODE_TELEGRAM_STATE_FILE` | опционально свой путь к state JSON |

Примеры без секретов: `frontend/.env.example`, `deploy/env/bitrix.env.example`, `deploy/env/bitrix-production.env.example`.

## Бот и канал (разово)

1. В Telegram: [@BotFather](https://t.me/BotFather) → `/newbot` → сохранить **token**.
2. Создать корпоративный **канал** (или группу). Добавить бота **админом** с правом публиковать сообщения.
3. Узнать `chat_id`:
   - канал: переслать пост боту [@userinfobot](https://t.me/userinfobot) / [@getidsbot](https://t.me/getidsbot), либо вызвать `getUpdates` после сообщения в канале;
   - у супергрупп/каналов id вида `-100xxxxxxxxxx`.
4. Прописать token и chat_id в env стенда (`/etc/vbi-hr/bitrix.env` или `bitrix-production.env`). Перезапуск сервиса Nuxt, чтобы подхватил env.

## Локально (тест)

Nuxt должен быть запущен (`npm run dev` в `frontend/`), в `frontend/.env` — EMAIL_* + TELEGRAM_* + `CRON_SECRET`.

```bash
# dry_run — почта + дедуп, без поста и без записи state
curl -sS -X POST -H "X-Cron-Token: $CRON_SECRET" \
  'http://127.0.0.1:3000/api/cron/chatgpt-code-telegram?dry_run=1'

# боевой прогон локально
curl -sS -X POST -H "X-Cron-Token: $CRON_SECRET" \
  'http://127.0.0.1:3000/api/cron/chatgpt-code-telegram'
```

Или скрипт (порт 3300 по умолчанию; второй аргумент `staging` → 3301):

```bash
bash deploy/scripts/run-chatgpt-code-telegram.sh /path/to.env
```

## Сервер: systemd timer (каждые 2 мин)

```bash
sudo cp deploy/systemd/vbi-hr-chatgpt-code-telegram.service \
        deploy/systemd/vbi-hr-chatgpt-code-telegram.timer \
        /etc/systemd/system/
# путь ExecStart должен совпадать с копией скрипта на VPS
# (как у других cron: часто /var/www/vbi-hr/deploy-scripts/…)
sudo systemctl daemon-reload
sudo systemctl enable --now vbi-hr-chatgpt-code-telegram.timer
systemctl list-timers vbi-hr-chatgpt-code-telegram.timer --no-pager
```

Ручной прогон:

```bash
sudo systemctl start vbi-hr-chatgpt-code-telegram.service
journalctl -u vbi-hr-chatgpt-code-telegram.service -n 50 --no-pager
```

## Альтернатива: crontab

```cron
*/2 * * * * /bin/bash /var/www/vbi-hr/deploy-scripts/run-chatgpt-code-telegram.sh /etc/vbi-hr/bitrix-production.env >>/var/log/vbi-hr-chatgpt-tg.log 2>&1
```

## Файлы

| Путь | Роль |
|------|------|
| `frontend/server/utils/openaiChatgptMailCode.ts` | IMAP + парсинг (общий с `/vpn`) |
| `frontend/server/utils/telegramBot.ts` | Bot API sendMessage |
| `frontend/server/utils/chatgptCodeTelegram.ts` | пайплайн |
| `frontend/server/utils/chatgptCodeTelegramState.ts` | дедуп JSON |
| `frontend/server/api/cron/chatgpt-code-telegram.post.ts` | cron API |
| `deploy/scripts/run-chatgpt-code-telegram.sh` | curl-раннер |
| `deploy/systemd/vbi-hr-chatgpt-code-telegram.*` | timer 2 мин |
