# VBI HR: свой тип уведомлений в Битриксе

Цель: в расширенных настройках уведомлений одна строка **VBI HR → Заявки на отпуск**, без галки «Неопознанные».

## Почему не хватает REST

`im.notify.system.add` не принимает `NOTIFY_MODULE` / `NOTIFY_EVENT` — уведомление остаётся «неопознанным».  
Нужны: (1) схема в UI, (2) отправка через `CIMNotify::Add` на коробке.

## Установка на `crm.vbi.ru` (админ коробки)

1. Скопировать папку на портал:

```text
/local/vbi-hr/notify-schema.php
/local/vbi-hr/vacation-notify.php
/local/vbi-hr/bridge.secret   # одна строка-секрет, chmod 600
```

2. В `/local/php_interface/init.php` добавить:

```php
<?php
require_once $_SERVER['DOCUMENT_ROOT'] . '/local/vbi-hr/notify-schema.php';
```

3. Проверить UI: Мессенджер → Настройки → Уведомления → **Расширенные** → блок **VBI HR** → **Заявки на отпуск**.

4. На HR-сервере (`/etc/vbi-hr/bitrix-production.env` или `.env`):

```env
BITRIX_VACATION_NOTIFY_BRIDGE_URL=https://crm.vbi.ru/local/vbi-hr/vacation-notify.php
BITRIX_VACATION_NOTIFY_BRIDGE_SECRET=тот_же_секрет_что_в_bridge.secret
```

5. Перезапустить `vbi-hr` (или дождаться деплоя с кодом моста).

## Что сказать Ксении после установки

1. Выключить **«Неопознанные уведомления»** (если из‑за них шум).
2. Включить только **VBI HR → Заявки на отпуск** (сайт/пуш — да, почту можно оставить выкл.).
3. SMS чатов/задач — выключить отдельно, если ещё включены.

## Ручной тест моста

```bash
curl -sS -X POST 'https://crm.vbi.ru/local/vbi-hr/vacation-notify.php' \
  -H 'Content-Type: application/json' \
  -d '{"secret":"...","USER_ID":848,"MESSAGE":"[VBI HR тест] типизированный колокольчик","TAG":"VBI_HR_PROBE_SCHEMA"}'
```

Ожидание: `{"ok":true,"notifyId":…,"module":"vbihr","event":"vacation"}`.
