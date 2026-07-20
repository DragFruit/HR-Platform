# VBI HR: модуль уведомлений на коробке Bitrix24

Цель: в расширенных настройках строка **VBI HR → Заявки на отпуск**, без «Нераспознанные».

**`init.php` не трогаем.** Файл `notify-schema.php` на портал **не копировать**.

---

## Что проверяли / что починили перед выкладкой

| Риск | Статус |
|------|--------|
| `notify-schema.php` при `require` из `init.php` слал HTTP 410 на каждую страницу → портал «лёг» | исправлено: файл теперь только `return;` |
| Обработчик схемы мог уронить сайт исключением | `try/catch`, пустой массив при ошибке |
| Повторная установка модуля | проверка `IsModuleInstalled` |
| Мост без try/catch | обёрнут; понятные JSON-ошибки |
| `php -l` по всем PHP модуля | без синтаксических ошибок |

---

## Что копировать по FTP (и что нельзя)

### Копировать

Из репозитория:

```text
scripts/bitrix/vbi-hr/module/vbihr/
```

На портал (document root обычно `/home/bitrix/www`):

```text
/home/bitrix/www/local/modules/vbihr/
```

Должно получиться так:

```text
/home/bitrix/www/local/modules/vbihr/include.php
/home/bitrix/www/local/modules/vbihr/install/index.php
/home/bitrix/www/local/modules/vbihr/install/version.php
/home/bitrix/www/local/modules/vbihr/install/step.php
/home/bitrix/www/local/modules/vbihr/install/unstep.php
/home/bitrix/www/local/modules/vbihr/lang/ru/install/index.php
/home/bitrix/www/local/modules/vbihr/lib/NotifySchema.php
/home/bitrix/www/local/modules/vbihr/tools/vacation-notify.php
```

### НЕ копировать / НЕ трогать

- `/local/php_interface/init.php` — **не открывать, не править**
- `scripts/bitrix/vbi-hr/notify-schema.php` — **не заливать**
- `*.zip`, `.ocr`, любые другие файлы репо
- Не класть `vacation-notify.php` внутрь `init.php`

---

## Чеклист установки (по шагам)

### A. Подготовка

- [ ] Есть откат / бэкап (как в пятницу) или окно, когда можно откатить FTP
- [ ] Document root известен (часто `/home/bitrix/www`)
- [ ] В FTP видна папка `/local/modules/` (если нет — создать `local`, потом `modules`)

### B. Заливка модуля

- [ ] Залить **только** каталог `vbihr` → `/local/modules/vbihr/`
- [ ] Проверить, что `include.php` и `install/index.php` на месте
- [ ] **Пока не создавать** `bridge.secret` и не трогать HR env (сначала модуль)

### C. Установка в админке Bitrix

- [ ] Войти админом на `crm.vbi.ru`
- [ ] **Настройки → Настройки продукта → Модули**
- [ ] Найти **VBI HR** (`vbihr`) → **Установить**
- [ ] Портал после установки открывается (главная / чат) — если нет, сразу откат: удалить `/local/modules/vbihr/` и снять модуль из списка при возможности

### D. Проверка схемы (без моста)

- [ ] Мессенджер → Настройки → Уведомления → **Расширенные**
- [ ] Есть блок **VBI HR** → строка **Заявки на отпуск**
- [ ] Пока отпуска по-прежнему могут идти через старый REST («Нераспознанные») — это нормально до шага F

### E. Мост + секрет

При установке модуль копирует endpoint в `/local/vbi-hr/vacation-notify.php`. Если файла нет — скопировать вручную:

```text
/local/modules/vbihr/tools/vacation-notify.php
  → /local/vbi-hr/vacation-notify.php
```

Секрет:

```text
/home/bitrix/www/local/vbi-hr/bridge.secret
```

Одна строка (например `openssl rand -hex 24`), права по возможности `600`.

- [ ] Файл `vacation-notify.php` открывается только POST (GET → `POST_ONLY`)
- [ ] Без секрета → `FORBIDDEN`

Тест:

```bash
curl -sS -X POST 'https://crm.vbi.ru/local/vbi-hr/vacation-notify.php' \
  -H 'Content-Type: application/json' \
  -d '{"secret":"ВАШ_СЕКРЕТ","USER_ID":848,"MESSAGE":"[VBI HR тест] тип vbihr|vacation","TAG":"VBI_HR_PROBE_SCHEMA"}'
```

Ожидание: `{"ok":true,"notifyId":…,"module":"vbihr","event":"vacation"}`.

### F. Включить мост на HR-сервере

В `/etc/vbi-hr/bitrix-production.env` или `.env` прода:

```env
BITRIX_VACATION_NOTIFY_BRIDGE_URL=https://crm.vbi.ru/local/vbi-hr/vacation-notify.php
BITRIX_VACATION_NOTIFY_BRIDGE_SECRET=тот_же_секрет
```

- [ ] Код с `bitrixVacationNotify.ts` (bridge) задеплоен на prod/staging
- [ ] Перезапуск сервиса `vbi-hr`
- [ ] В логе `server/data/bitrix-notify.log` строка с `vbihr.vacation-notify`

### G. Ксения / остальные

- [ ] Выключить **Нераспознанные**
- [ ] Включить **VBI HR → Заявки на отпуск** (веб и/или push)
- [ ] Тестовая заявка → колокольчик без смс из чатов

---

## Откат, если снова «легло»

1. FTP: удалить или переименовать `/local/modules/vbihr/` → например `vbihr.bak`
2. Удалить `/local/vbi-hr/` если мешает (опционально)
3. В админке снять модуль, если список ещё открывается
4. **Не** править `init.php` при откате, если вы его не трогали

---

## Почему в пятницу могло упасть

Частый сценарий: в `init.php` подключили файл, который на **каждый** хит сайта делает `echo` / `http_response_code` (старый stub `notify-schema.php`) — Битрикс отдаёт мусор вместо страниц.  
Текущая инструкция это исключает: только модуль через админку, `init.php` не трогаем.
