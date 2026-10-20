# Интеграция с Битрикс24 (коробка)

OAuth-вход и синхронизация сотрудников из **Структуры компании**.

Портал VBI: `https://crm.vbi.ru`

---

## 0. Запутались в приложениях? (шпаргалка)

Нужно **3** локальных приложения (по одному на контур). Лишние можно удалить.

| Что видите в списке | Оставить? | Для чего |
|---------------------|-----------|----------|
| **VBI HR Platform** | ✅ **Да — бой** | Сервер `:80`, ключи в `/etc/vbi-hr/bitrix-production.env` |
| **VBI HR Platform (staging)** | ✅ **Да — стейдж** | Сервер `:8080`, ключи в `/etc/vbi-hr/bitrix.env` |
| **VBI HR Platform (dev)** | ✅ **Да — Mac** | `npm run dev`, ключи только в `frontend/.env` |
| **hrVibeVbi** | ❌ Удалить | Старое/тестовое, если не пользуетесь |
| **Локальное приложение** с правами только **CRM** | ❌ Удалить | Не подходит для входа HR (нужны **Пользователи** + **Структура компании**) |

Локальная копия стейдж-ключей (не в git): `deploy/env/bitrix.env` (в `.gitignore`). Шаблон без секретов — `deploy/env/bitrix.env.example`.

### Как понять, какое приложение где

1. Откройте приложение в Битриксе → скопируйте **Код приложения (Client ID)**.
2. Сравните:
   - совпадает с `BITRIX_CLIENT_ID` в `bitrix-production.env` → это **бой**;
   - совпадает с `/etc/vbi-hr/bitrix.env` / `deploy/env/bitrix.env` → это **стейдж**;
   - совпадает с `frontend/.env` на Mac → это **локальная разработка**;
   - ни с чем не совпадает → **удалить**.

3. Поле **«Путь вашего обработчика»** (не путать с «путём первоначальной установки» — тот можно оставить пустым):
   - бой: `http://45.12.74.25/api/auth/bitrix/callback`
   - стейдж: `http://45.12.74.25:8080/api/auth/bitrix/callback`
   - Mac: `http://localhost:3000/api/auth/bitrix/callback`

**Сейчас на сервере** используется Client ID `local.6a3d853b126b27.83139285` — это почти наверняка **VBI HR Platform (113)**.  
На Mac в `.env` **не должны** быть те же ключи — иначе OAuth уводит на сервер и ошибка «Неверный state».

### Быстрый план наведения порядка

1. Оставить **VBI HR Platform** — проверить обработчик `http://45.12.74.25/api/auth/bitrix/callback`, права: Пользователи + Структура компании.
2. Создать **одно** новое: `VBI HR Platform (dev)`, обработчик `http://localhost:3000/api/auth/bitrix/callback`, те же права.
3. Вписать **новые** Client ID/Secret dev-приложения в `frontend/.env` на Mac.
4. Удалить **hrVibeVbi** и **Локальное приложение (CRM)** — если не используете для других задач.

---

## 1. OAuth — локальное приложение (для входа)

Нужно создать приложение в Битриксе **для каждого стенда** — отдельно локальная разработка и отдельно бой на сервере.

### Три приложения (рекомендуется)

| Стенд | Где крутится HR | Название в Битриксе | **Путь вашего обработчика** |
|-------|-----------------|---------------------|-------------------------------|
| **Локально** | Mac, `npm run dev` | `VBI HR Platform (dev)` | `http://localhost:3000/api/auth/bitrix/callback` |
| **Стейдж** | VPS, порт 8080 | `VBI HR Platform (staging)` | `http://45.12.74.25:8080/api/auth/bitrix/callback` |
| **Бой** | VPS, порт 80 | `VBI HR Platform` | `http://45.12.74.25/api/auth/bitrix/callback` |

Поле **«Путь вашего обработчика»** — это **Redirect URI** для OAuth. Вписывайте URL **точно**, без слэша в конце.

**«Путь для первоначальной установки»** — можно оставить пустым (для входа через OAuth он не нужен).

Если `npm run dev` слушает другой порт — подставьте его в URL (например `http://localhost:3001/...`).

> **Коробка и localhost:** Битрикс должен принять `localhost` в redirect URI. Если при входе ошибка `redirect_uri_mismatch` — уточните у админа портала или используйте туннель (ngrok) и укажите его URL вместо localhost.

### Локальный `.env` (Mac)

Файл `frontend/.env` (не в git), ключи из **dev-приложения**:

```bash
BITRIX_PORTAL_URL=https://crm.vbi.ru
BITRIX_CLIENT_ID=local.XXXXXXXX   # из VBI HR Platform (dev)
BITRIX_CLIENT_SECRET=XXXXXXXX
BITRIX_REDIRECT_URI=http://localhost:3000/api/auth/bitrix/callback
```

Запуск: `cd frontend && npm run dev` → http://localhost:3000 → «Войти через Битрикс24».

**Проверка перед входом:** http://localhost:3000/api/auth/oauth-debug  
- `usesProdClientId` должно быть `false`  
- `clientId` — из dev-приложения (`local.6a3e403c…`, не как на сервере)  
- `redirectUri` — `http://localhost:3000/api/auth/bitrix/callback` (тот же порт, что в терминале Nuxt)

После смены `.env` перезапустите `npm run dev` (или сохраните файл — в dev env подхватывается автоматически).

### Бой на VPS

Файл `/etc/vbi-hr/bitrix-production.env`, ключи из приложения **«VBI HR Platform»** (не dev):

```bash
BITRIX_REDIRECT_URI=http://45.12.74.25/api/auth/bitrix/callback
APP_PUBLIC_URL=http://45.12.74.25
```

В Битриксе у prod-приложения **обработчик** — тот же URL.  
Деплой: ветка `main` → job `deploy:production` (или `bash deploy/scripts/deploy-remote.sh production`).

Проверка: http://45.12.74.25 → «Войти через Битрикс24»; `GET /api/auth/config` → `bitrixAuthEnabled: true`.

---

### Шаг 1. Открыть раздел

1. Войдите в `https://crm.vbi.ru` под **администратором**.
2. Меню → **Приложения** (или **Настройки**).
3. **Разработчикам** → **Другое** → **Локальное приложение**.

   Альтернативный путь в коробке:  
   `Настройки` → `Настройки продукта` → `Прочее` → `Локальные приложения`.

### Шаг 2. Заполнить форму

| Поле | Значение |
|------|----------|
| Название | `VBI HR Platform` |
| Код (если есть) | `vbi_hr_platform` |
| Тип | **Серверное** (не «Встраиваемое», если есть выбор) |
| **Путь вашего обработчика** | см. таблицу выше (dev или prod) |

**Redirect URI** — один на приложение; для второго стенда создайте **второе** локальное приложение.

### Шаг 3. Права (scope)

Отметьте минимум:

- **Пользователи** (`user`)
- **Структура компании** / **department** (если есть в списке)

Сохраните приложение.

### Шаг 4. Скопировать ключи

После сохранения появятся:

- **Код приложения / Client ID** — вида `local.XXXXXXXX.XXXXXXXX`
- **Ключ приложения / Client Secret** — длинная строка

Их нужно прописать на сервере (раздел 3). **В git не коммитить.**

### Шаг 5. Проверка OAuth вручную (опционально)

В браузере откройте (подставьте свой Client ID):

```
https://crm.vbi.ru/oauth/authorize/?client_id=ВАШ_CLIENT_ID&response_type=code&redirect_uri=http://localhost:3000/api/auth/bitrix/callback
```

Если вы уже залогинены в Битрикс — должны перекинуть на HR-сайт с `?code=...` в URL (потом будет ошибка без env на сервере — это нормально на этом этапе).

---

## 2. Вебхук (для синка сотрудников и отпусков)

Отдельно от OAuth: **Разработчикам** → **Входящий вебхук**.

Права: **user** + **структура/department** + **lists** (универсальные списки) + **calendar** (календарь, запасной канал для отсутствий) + **im** (уведомления согласующим).

Базовый URL (без метода в конце):

```
https://crm.vbi.ru/rest/ID/СЕКРЕТ/
```

Переменная на сервере: `BITRIX_WEBHOOK_URL=...`

### Отпуска → системные уведомления согласующим (im.notify.system.add)

Колокольчик Битрикса — метод [`im.notify.system.add`](https://apidocs.bitrix24.ru/api-reference/chats/notifications/im-notify-system-add.html) через OAuth-приложение «VBI HR Platform» (уведомление **от системы**, не личный чат и не SMS):

| Параметр | Значение |
|----------|----------|
| `USER_ID` | `bitrix_user_id` согласующего из `employees.json` |
| `MESSAGE` | Текст с BB-кодом `[URL=…]…[/URL]` |
| `TAG` | `VBI_HR_VAC_{requestId}_{stage}` |
| `SUB_TAG` | `VBI_HR\|vacation\|{requestId}\|{stage}` |

`MESSAGE_OUT` **не передаём** — иначе Bitrix может пушить во внешние каналы (email/SMS).

Вызов: `POST https://crm.vbi.ru/rest/im.notify.system.add.json` с `auth` (access_token приложения). **Не через входящий вебхук.**

**Первичная настройка:**

1. В приложении «VBI HR Platform» на `crm.vbi.ru` среди прав обязательно **«Чат и уведомления» (`im`)** — без этого Bitrix отвечает `insufficient_scope`, колокольчик молчит.
2. Админ или HR один раз входит через «Войти через Битрикс24» на бою (`:80`) → `refresh_token` в `server/data/bitrix-oauth-service.json`.
3. После успешного сохранения в URL на секунду будет `bitrix_notify=1`.
4. Если право `im` добавили позже — снова войти через Битрикс (старый токен остаётся без `im`).

**Только колокольчик.** Личный чат (`im.message.add`) **не используем**.

**Предпочтительно — типизированный тип `vbihr|vacation`** (одна строка в настройках, без «Неопознанные»):

1. На `crm.vbi.ru` установить **локальный модуль** `vbihr` (+ PHP-мост) — **без правки `init.php`**. Инструкция: `scripts/bitrix/vbi-hr/README.md`.
2. В env HR: `BITRIX_VACATION_NOTIFY_BRIDGE_URL` + `BITRIX_VACATION_NOTIFY_BRIDGE_SECRET`.
3. Сотруднику: включить **VBI HR → Заявки на отпуск**, галку **«Неопознанные»** можно выключить.

**Запасной путь:** OAuth `im.notify.system.add` (без bridge) — попадает в «Неопознанные»; без OAuth / без scope `im` и без bridge колокольчик не уходит.

Код: `server/utils/bitrixVacationNotify.ts`, `server/utils/bitrixOAuthServiceToken.ts`.

#### Диагностика: кому не создаётся колокольчик

Прогон по всем с `bitrix_user_id` (2026-07-14): **59 OK / 11 FAIL**. У FAIL — HTTP 200, но `result` ≈ unix-timestamp (уведомление не создано). У OK — ID ~10⁷.

**FAIL user_id (прогон 2026-07-14, 11 чел.):** `848, 2574, 2579, 2673, 2680, 2697, 2708, 2778, 2801, 2806, 2812`.

Повтор 2026-07-15: **5 всё ещё FAIL** — Шашин Данила (`2680`), Нижегородцев Василий (`2697`), Мирончиков Антон (`2708`), Мороко Алексей (`2778`), Девочкина Валерия (`2806`).  
Восстановились: Ревзина, Маленкова, Желялетдинова, Носков, Камнева, Перишкова.

**Причина без bridge (подтверждено 2026-07-15):** REST `im.notify.system.add` идёт как **неопознанный** тип. В расширенных настройках без галки «Неопознанные» колокольчик молчит; с галкой часто включается лишний шум (чаты/задачи).

**Правильное решение (если когда‑нибудь разрешат правки портала):** мост `vbihr|vacation`.  
**Сейчас правки на crm.vbi.ru запрещены** — мост/PHP не ставим. Обход без портала: колокольчик **в Vibe** у согласующего + алерт админу при FAIL Bitrix. Галка «Неопознанные» на портале — тоже правка учётки, не делаем сами.

Отчёт прогона: `/var/www/vbi-hr/server/data/bitrix-notify-probe.json`.  
CLI на коробке: `scripts/bitrix/diagnose-notify-chats.php`, схема/мост: `scripts/bitrix/vbi-hr/` (архив на случай разрешения).

### Вход логин/пароль (локально на Vibe)

**Паролей Bitrix в репозитории/на сервере Vibe нет.** Сравнение идёт с локальными хешами Vibe: при `DB_PROFILE=1` таблица `profile.vibe_passwords` (бой), иначе `server/data/vibe-passwords.json`. Хранится scrypt-хеш для входа и AES-seal для глаза в профиле, открытого текста нет. Задаёт HR в Админ → Сотрудники или выдача доступов ниже. Bitrix при входе не вызывается.

`POST /api/auth/vibe-login` → cookie-сессия Vibe (`auth_source: vibe`). Логин = email из справочника (или его часть до `@`).

#### Выдача логина и пароля ботом (`POST /api/cron/vibe-credentials`)

Массовая (или точечная) выдача: логин = email сотрудника из справочника: если он на `@vbi.ru`, берём его; если почта на другом домене (например `@vbi.kz`), логином становится она же (решение заказчика 20.10.2026). Пароль = свой для каждого, 16 символов (заглавные, строчные, цифры, `!@#%+=?`, без похожих `0/O/o/1/l/I`), `crypto.randomInt`. Код: `server/utils/vibeCredentialsIssue.ts`.

Порядок на человека: пароль записывается тем же путём, что у админки (`setVibePassword`: хеш + seal, аудит `password_set` с `reason=vibe-credentials-issued`) → проверка тем же поиском по логину и `checkVibePassword`, что у `vibe-login`, и что seal открывается (глаз) → сообщение от чат-бота `imbot.message.add` (`bitrixImbot.ts`) → отметка `credentials_sent_at` (аудит `credentials_sent`). Значений в аудите, логах и ответе нет: только статусы.

Текст сообщения (дословно):

```
Привет!
А ты знаешь, что теперь в Вайбе http://45.12.74.25/profile доступен вход не только через Битрикс, но и по логину паролю?

Твои доступы:
Логин: <email>
Пароль: <пароль>
```

Кого пропускаем (статус `skipped` с причиной): нет в справочнике / denylist, QA-отдел, нет email или он некорректный, нет `bitrix_user_id`, по email вход находит другого сотрудника, пароль Vibe уже есть (пока не передан `overwriteExisting: true`).

Статусы: `would_issue` / `would_overwrite` / `would_resend` (dry run), `sent`, `resent`, `set_not_delivered` (пароль задан, бот не доставил: повторить), `skipped`, `failed`.

**Повтор недоставленных:** `resendUndelivered: true` шлёт **тот же** пароль из seal (новый не генерируется) только тем, у кого `credentials_issued_at` есть, а `credentials_sent_at` нет. Обычный прогон таких не трогает. Поля `credentials_issued_at` / `credentials_sent_at` лежат в записи пароля (колонка `extra`), миграции не нужно. Ручная смена пароля HR сбрасывает эти отметки.

**Защита:** только с самого сервера, напрямую на Node (`127.0.0.1:3300` бой, `:3301` стейдж), мимо nginx (запрос с `X-Forwarded-For` / `X-Real-IP` → 403), заголовок `X-Cron-Token` = первый заданный из `VIBE_CREDENTIALS_SECRET`, `CRON_SECRET`, `VACATION_PRE_REMINDER_CRON_SECRET` (на бою сейчас есть последний, в `/etc/vbi-hr/bitrix-production.env`; на стейдже `VIBE_CREDENTIALS_SECRET` в `/etc/vbi-hr/bitrix.env`). `?token=` не принимается. Параллельный боевой прогон → 409. На бою без `BITRIX_IMBOT_ID` боевой прогон отказывает (503) до записи паролей.

Тело (JSON): `employeeIds: number[]` (id справочника) и/или `bitrixUserIds: number[]` (Bitrix ID), или `all: true`, `dryRun` (**по умолчанию true**), `overwriteExisting` (false), `resendUndelivered` (false), `actorEmployeeId` (кто запустил, для аудита; иначе система).

**Стейдж:** запись в Bitrix выключена гвардом, поэтому боевой прогон на `:8080` задаёт пароль (вход по логину/паролю на стейдже можно проверить), а доставка честно `set_not_delivered: не доставлено: staging: запись в Bitrix отключена`. Сообщение не уходит. База стейджа своя, на бой это не влияет.

```bash
# на сервере (бой), секрет не печатаем
TOKEN=$(grep -E '^VACATION_PRE_REMINDER_CRON_SECRET=' /etc/vbi-hr/bitrix-production.env | cut -d= -f2-)
curl -s -X POST http://127.0.0.1:3300/api/cron/vibe-credentials \
  -H "X-Cron-Token: $TOKEN" -H 'Content-Type: application/json' \
  -d '{"bitrixUserIds":[<bitrix id>],"dryRun":true}'
# потом то же с "dryRun":false; недоставленным: "resendUndelivered":true,"dryRun":false
```

Запасной путь: OAuth «Войти через Битрикс24». Старый эксперимент `grant_type=password` к порталу — только при `BITRIX_PASSWORD_LOGIN=1` (нужна сеть Vibe→crm).

### Отпуска → график отсутствий (пальма) + календарь

После **согласования** заявки в VBI HR сервер создаёт отсутствие в Битриксе:

1. `lists.element.add` в инфоблок **График отсутствий** (пальма + предупреждения во встречах) с **`PROPERTY_1`** (поле «Пользователь», CODE=`USER`) = сотрудник.  
   **Настоящий график отсутствий на crm.vbi.ru — стандартный инфоблок `3`**: `IBLOCK_TYPE_ID=structure`, `IBLOCK_CODE=absence`. Поля (`lists.field.get`, проверено 16.10.2026): `NAME` «Причина отсутствия» (обяз.), `ACTIVE_FROM` «Начало» / `ACTIVE_TO` «Окончание» (обяз.), `PROPERTY_1` «Пользователь» (обяз., просто числовой user id), `PROPERTY_7` «Тип отсутствия» (enum `1` = «Отпуск ежегодный»). Свойств «Информация»/«Начало»/«Конец» там **нет**.  
   **Список 313 (`lists_socnet`, старое дополнение Free.FIX4) — НЕ график отсутствий.** 15–16.10.2026 бой по ошибке писал туда (env указывал на 313, а код подгоняли под его обязательные поля 1547/1555/1551/1548/1549); элементы 33277, 33278, 33279, 33281 удалены из 313 16.10.2026 по согласию заказчика (заявки перенесены в инфоблок 3).  
   **Даты: `ACTIVE_FROM` = «ДД.ММ.ГГГГ 00:00:00», `ACTIVE_TO` = «ДД.ММ.ГГГГ 23:59:59»** (`toBitrixDateTime`, только перестановка строки `YYYY-MM-DD`, без Date/UTC, результат не зависит от TZ сервера). Bitrix читает это время в поясе пользователя токена (МСК), `ACTIVE_FROM_X` показывает UTC (предыдущий день 21:00), в графике получается ровно с начала первого дня до конца последнего, как у корректного элемента 33212 (16.11.2026 00:00:00 – 22.11.2026 23:59:59). **Дату без времени в `ACTIVE_TO` не слать**: Bitrix ставит 00:00:00 последнего дня, и последний день отпуска в график не попадает (так было 19.10.2026 после d7b8911 у 32004, 32095, 32900, 33029, 33164). Дата без времени осталась только в `FILTER[ACTIVE_FROM]` поиска.  
   `lists.get` с `IBLOCK_TYPE_ID=structure` отвечает «Неверный тип информационного блока» — автопоиск по имени для structure не работает, поэтому для `structure` без явного `BITRIX_ABSENCE_IBLOCK_ID` код берёт `3`.  
   На `crm.vbi.ru` ключ `PROPERTY_USER` в `FIELDS` **не принимается** → ошибка «Пользователь is required».
2. **`calendar.event.add` не используем**: входящий вебхук / OAuth всегда пишут `CREATED_BY` = владелец токена (сейчас Драго). Bitrix тогда показывает absence в блоке «Отсутствия» у HR, даже если `ownerId` сотрудника верный.
3. Вызов идёт через **входящий вебхук**; при `Invalid request credentials` — fallback на **OAuth** для `lists.element.add`.
4. При полном fail синка — уведомление админу в `/admin/notifications`.
5. Повтор failed/skipped: `POST /api/bitrix/sync-vacations` (роли admin/hr) и автоматически через 30 с после старта боевого процесса (плагин `server/plugins/bitrix-absence-relocate.ts`, только production). Если отсутствие уже есть в графике (тот же сотрудник + даты или уже известный `bitrix_absence_id`) — привязываем без дубля.
6. У заявки хранится `bitrix_absence_iblock_id` — инфоблок, куда записан `bitrix_absence_id`. При повторе (п. 5) отметки ещё не закончившихся отпусков (`end` ≥ сегодня) из чужого инфоблока переносятся: поле есть и ≠ текущему → новый элемент в текущем графике; поля нет (записи до 16.10.2026) → пачкой `lists.element.get FILTER[ID]=[…]` проверяем, есть ли ID в текущем инфоблоке: есть → только проставляем поле, нет → создаём заново. Прошедшие не воскрешаем (на бою #1014, элемент 32099 за июль, в графике уже нет — видимо, убрали руками). В чужом списке ничего не удаляется. `lists.element.update` с ответом `ERROR_ELEMENT_NOT_FOUND` («Element not found») → создаём элемент заново.
7. **Ежедневная сверка дат** (`reconcileFutureAbsences` в `server/utils/bitrixVacationAbsence.ts`). Берёт согласованные заявки со статусом `synced`, записанные в текущий график (`bitrix_absence_iblock_id` = 3), у которых `end` ≥ сегодня. Элементы читает пачками `lists.element.get FILTER[ID]=[…]` по 50, запись идёт максимум в 2 потока. Элемент считается актуальным, только если день `ACTIVE_FROM` = `start`, а `ACTIVE_TO` = `end` **в 23:59:59** (конец без времени или в 00:00:00 = расхождение). Если даты или пользователь не совпадают с заявкой, элемент обновляется обычным `lists.element.update` (00:00:00 – 23:59:59, `ELEMENT_CODE` = `vbi-hr-vac-<id>`, п. 9). Так чинятся старые элементы со сдвигом `ACTIVE_TO` на «следующий день 02:59:59» и с концом в 00:00:00 последнего дня (после d7b8911). Расхождение одного `CODE` (пустой или другой) update не вызывает: Bitrix не меняет код через update (п. 9). Если элемента нет, срабатывает обычный путь синка: поиск по `ELEMENT_CODE` и датам, затем сирота (п. 8), иначе `add`. Если `CODE` элемента принадлежит другой живой заявке, элемент не трогаем и пишем в лог. Ничего не удаляется. В журнал уходит одна строка `[bitrix-vacation] reconcile: checked=N fixed=N readded=N adopted=N failed=N`. Ошибка записи даёт заявке `failed` (её подхватит повтор), алерта админу нет.
   - Когда запускается: через 30 с после старта процесса (после повтора и переноса из п. 5–6), затем каждый день в 04:00 МСК (01:00 UTC) таймером внутри процесса, отдельный systemd-таймер не нужен. Также при `POST /api/bitrix/sync-vacations`, в ответе поле `reconcile` со счётчиками и `dryRun`.
   - Стейдж и локалка: только чтение и лог «обновили бы / создали бы заново» с пометкой `(dry-run: staging: запись в Bitrix отключена)`. `vacations.json` не меняется, статусов `failed` и алертов нет.
8. **Сирота вместо дубля.** Если у новой заявки элемента в графике не нашлось, перед `add` проверяются последние 50 элементов этого сотрудника (`FILTER[PROPERTY_1]`, `ELEMENT_ORDER[ID]=DESC`). Подходит элемент с `CODE` `vbi-hr-vac-<id>`, если заявки `<id>` в `vacations.json` нет совсем, элемент не привязан ни к одной заявке и его даты пересекаются с новой. Такой элемент обновляется под новую заявку (даты и `CODE`, метод `lists.element.update-adopted`). Берём только если подходящий элемент ровно один. Пример с боя: 32167 (`vbi-hr-vac-1147`, 16.11–23.11 02:59, Трифонов) достанется его заявке на 16–22.11 после согласования, второго элемента не будет.

9. **`lists.element.update` и `CODE`.** Документация (apidocs.bitrix24.ru, lists.element.update): «Метод перезаписывает элемент полностью. Поля, значения которых не передаются, будут очищаться». Как передать символьный код при update, там не сказано; `ELEMENT_CODE` описан только как способ указать элемент («хотя бы один из параметров: `ELEMENT_ID` или `ELEMENT_CODE`»), а в `lists.element.add` это и есть код нового элемента. Факт с боя 19.10.2026: update с `ELEMENT_ID` и `FIELDS.CODE` стёр `CODE` у 32095 (`vbi-hr-vac-3` → пусто), то есть `FIELDS.CODE` не применяется, а код берётся из параметра `ELEMENT_CODE`. Поэтому `updateViaAbsenceIblock` шлёт `ELEMENT_ID` + `ELEMENT_CODE` = `vbi-hr-vac-<id>`. Что главнее при обоих параметрах, документация не говорит, поэтому: сначала `lists.element.get` по `ELEMENT_CODE` (кому принадлежит код); если код у другого элемента или прочитать не удалось, update только по `ELEMENT_ID` (чужой элемент по коду не адресуем); если код ничей и Bitrix ответил «Element not found» (ищет по коду, а код стёрт), повтор только по `ELEMENT_ID`, без `add` и дубля. Факт с боя 19.10.2026: такой повтор пустой `CODE` не восстанавливает (update по `ELEMENT_ID` проходит, код остаётся пустым), а в форме отсутствия в Bitrix поля «Символьный код» нет, так что руками его тоже не проставить. Так остались без `CODE` 32004, 32095, 32900, 33029, 33164 (даты у них верные, 00:00:00 – 23:59:59). Платформа на `CODE` не опирается: элемент заявки определяется по `bitrix_absence_id`. Поэтому сверка (п. 7) считает элемент актуальным, если совпали пользователь и даты; пустой или другой `CODE` сам по себе поводом для update не является. Если update нужен по другой причине, попытка поставить `CODE` через `ELEMENT_CODE` остаётся, а в журнале честно пишется результат: «CODE vbi-hr-vac-N установлен» только если прошёл update с `ELEMENT_CODE`, при повторе по `ELEMENT_ID` пишется «CODE не установлен (Bitrix не меняет код через update)».

**Ловушки портала (2026-08-04):**
- `lists.element.get` с `FILTER.CODE` → `Filter field not allowed: CODE` — поиск по символьному коду недоступен.
- `FILTER` по `CODE` запрещён; обход — **`ELEMENT_CODE`** в `lists.element.get` (без FILTER) или поиск по `ID` / пользователь+`ACTIVE_FROM`.
- `FILTER` только по пользователю отдаёт ≤50 строк → свежий отпуск можно «не увидеть», затем `lists.element.add` падает с `Element already exists` (ложные алерты по Жуковой / Ревзиной при чужом approve).
- Обход: искать по `ID` / `ELEMENT_CODE` / пользователю **+ `ACTIVE_FROM`**; не ресинкать всех `synced` при каждом согласовании.

Примечание по переносу дат:
- если `approved` отпуск переносится (меняются `start/end`) и в Bitrix уже есть элемент — платформа делает **`lists.element.update`** того же ID (новые `ACTIVE_FROM/ACTIVE_TO`), без delete+add.
- delete+add давал `Element already exists` (CODE уже занят) и ложный алерт админу (Кобликова Юлия #1038, 05.08.2026).
- ручные правки полей элемента (кроме дат) при следующем update заявки могут быть перезаписаны.

Тег **Битрикс ✗** в «Мои заявки» = статус последней **автоотправки** (`bitrix_sync_status: failed`), а не «сейчас нет в Bitrix». Исторический кейс (июль 2026): вебхук отдавал `Invalid request credentials` 1–13.07 — у Скворцова и ещё ~11 заявок; отпуск потом завели вручную, крестик остался. Кейс 04.08.2026: Жукова / Ревзина — отсутствие **уже было** в графике, алерт из‑за ложного fail ресинка.

Опционально в env:

| Переменная | Назначение |
|------------|------------|
| `BITRIX_ABSENCE_IBLOCK_ID` | ID инфоблока графика отсутствий. Явное значение главнее всего; без него при типе `structure` — `3`, при другом типе — автопоиск по имени через `lists.get`. На бою: `3` |
| `BITRIX_ABSENCE_IBLOCK_TYPE_ID` | Тип инфоблока, по умолчанию `structure` |
| `BITRIX_ABSENCE_TYPE_ENUM` | ENUM_ID типа «Отпуск ежегодный», по умолчанию `1` |
| `BITRIX_ABSENCE_PROPERTY_USER` | Поле сотрудника в `FIELDS`/`FILTER`, по умолчанию **`PROPERTY_1`** |
| `BITRIX_ABSENCE_PROPERTY_TYPE` | Поле типа отсутствия, по умолчанию **`PROPERTY_7`** |
| `BITRIX_ABSENCE_PROPERTY_INFO` / `_START` / `_END` | Необязательные доп. свойства. Отправляются **только если ключ задан явно**; по умолчанию не шлются (в инфоблоке 3 их нет). Раньше по умолчанию стояли `PROPERTY_1551/1548/1549` — поля ошибочного списка 313 |

Код: `server/utils/bitrixVacationAbsence.ts`, вызов из `PUT /api/vacations`.

Проверка: согласовать отпуск в `/vacations` → тег **Битрикс ✓** → пальма + событие отсутствия в календаре `crm.vbi.ru`.

Проверка вебхука в генераторе: методы `user.get`, `department.get`, `lists.get`, `lists.element.add`, `calendar.event.add`, `im.notify`.

### Напоминание отпускнику за 3 недели (чат-бот)

Ежедневно в **12:00 МСК** cron **проверяет** график: есть ли `approved` отпуска со стартом **ровно через 21 день** (3 недели; напр. 03.08 → старт 24.08). Если да — пишет **этому** сотруднику в Bitrix **от чат-бота** (`imbot.message.add`) **один раз** (журнал без повторов):

```
До отпуска осталось 3 недели (ДД.ММ.ГГГГ — ДД.ММ.ГГГГ).

Пожалуйста, заранее:
1. Напишите заявление на отпуск.
2. Поставьте задачи на передачу проектов на время отпуска.
```

В конце — **только для отделов с регламентом**:

| Отдел | Ссылка |
|-------|--------|
| SEO / SERM / ORM (`SEO / ORM` в справочнике) | https://crm.vbi.ru/devs/24611/ |
| Digital | https://crm.vbi.ru/devs/21301/ |

Текст хвоста: «Памятка, как правильно уйти в отпуск:» + URL. Остальным отделам этот блок **не** добавляется.

| Переменная | Назначение |
|------------|------------|
| `BITRIX_IMBOT_ID` | ID чат-бота (на бою: **2830**, код `vbi_hr_vacation`, имя «VBI HR») |
| `VACATION_PRE_REMINDER_CRON_SECRET` или `CRON_SECRET` | Токен для cron API (общий для всех bot-напоминаний) |

**Разово в Битриксе (админ портала):**

1. В локальном приложении «VBI HR Platform» включить право **Чат-боты (imbot)** (и при необходимости перелогиниться на платформе, чтобы обновить OAuth-токен).
2. Зарегистрировать бота (один раз), например через REST:

```http
POST /rest/imbot.register
CODE=vbi_hr_vacation
TYPE=B
EVENT_MESSAGE_ADD=https://example.invalid/noop
EVENT_WELCOME_MESSAGE=https://example.invalid/noop
EVENT_BOT_DELETE=https://example.invalid/noop
PROPERTIES[NAME]=VBI HR
PROPERTIES[WORK_POSITION]=Напоминания об отпусках
```

3. В `/etc/vbi-hr/bitrix-production.env` прописать `BITRIX_IMBOT_ID=<id из ответа>` и секрет cron.
4. На VPS установить **три** timer’а (сервер в UTC: 12:00 МСК = 09:00 UTC, 11:15 МСК = 08:15 UTC):

| Unit | Расписание |
|------|------------|
| `vbi-hr-vacation-pre-reminders.timer` | ежедневно 09:00 UTC |
| `vbi-hr-vacation-manager-current-month-reminders.timer` | 1-е, 08:15 UTC |
| `vbi-hr-vacation-manager-month-reminders.timer` | 15-е, 08:15 UTC |

Скрипты: `deploy/scripts/run-vacation-*-reminders.sh` → `/var/www/vbi-hr/deploy-scripts/` (копирует `deploy-remote.sh`).

Журнал отправок сотруднику: `server/data/vacation-pre-reminders.json`.

Проверка: `curl -X POST -H "X-Cron-Token: …" 'http://127.0.0.1:3300/api/cron/vacation-pre-reminders?dry_run=1'`.

Код: `vacationPreReminder.ts`, `bitrixImbot.ts`.

### Напоминание руководителю (чат-бот)

Одинаковые зоны получателей; **Юдин Вадим** не получает.

| Когда | О чём | Заголовок / футер |
|-------|--------|-------------------|
| **1-е**, 11:15 МСК | `approved`, старт **в текущем** месяце | «В этом месяце…» / «Не забудьте учесть их отсутствие.» |
| **15-е**, 11:15 МСК | `approved`, старт **в следующем** месяце | «В следующем месяце…» / «Имеет смысл заранее спланировать передачу дел.» |

| Получатель | Состав списка |
|------------|---------------|
| Ревзина Ксения | весь **Digital** |
| Музыка / Трубицына / Волдайский / Малиновская / Лашин | весь свой отдел (у Лашина — **Отдел продаж**) |
| Групхеды и прочие с подчинёнными | только **прямые** подчинённые |
| Юдин Вадим | **не** получает |

Тот же `BITRIX_IMBOT_ID` и cron-секрет, что у напоминания за 3 недели.

- API: `POST /api/cron/vacation-manager-month-reminders?outlook=current\|next` (`dry_run=1`, `force=1`, `as_of=YYYY-MM-DD`)
- Timers: `vbi-hr-vacation-manager-current-month-reminders.timer` (1-е), `vbi-hr-vacation-manager-month-reminders.timer` (15-е)
- Журнал: `server/data/vacation-manager-month-reminders.json`
- Код: `vacationManagerMonthReminder.ts`

> Согласование заявок по-прежнему только через колокольчик (`im.notify`) — не путать с этими напоминаниями от бота.

---

## 2.1. Стейдж и локалка не пишут в Bitrix

Стейдж (`:8080`) и локалка смотрят в тот же реальный портал `crm.vbi.ru` (тот же вебхук, OAuth-приложение на том же портале), поэтому **запись в Bitrix разрешена только на бою**.

| Стенд | Чтение (вход, `user.get`, `department.get`, `lists.get`, `lists.element.get`…) | Запись (отсутствия, колокольчики, мост, чат-бот, всё прочее) |
|-------|------|------|
| production | да | да |
| staging | да | **нет, всегда** (флаг не помогает) |
| development (локалка) | да | нет, пока не задан `BITRIX_ALLOW_WRITES=1` |
| стенд не определён | да | нет |

- Код: `frontend/server/utils/bitrixWriteGuard.ts` (allowlist чтений `BITRIX_READ_METHODS`, всё остальное = запись). Стенд — запечённый в сборку `runtimeConfig.public.appEnv` (как в `load-bitrix-env`).
- Заблокированный вызов не отправляется; в лог одна строка `[bitrix] staging: write blocked <method>`.
- Отпуска: заявка получает `bitrix_sync_status: 'skipped'` и `bitrix_sync_error: 'staging: запись в Bitrix отключена'`; повторно не ретраится, алерта админу нет, absence id не выдумывается.
- Колокольчики/мост/чат-бот: лог и дальше без ошибок для пользователя.
- OAuth `/oauth/token/` (вход, refresh токена) гвардом не закрыт — вход на стейдже работает.
- Новый REST-метод чтения — добавить в `BITRIX_READ_METHODS`, иначе на стейдже/локалке он будет считаться записью.
- Ручные скрипты в `scripts/` (например `set-vibe-password-and-notify.mjs`) гвард не проходят — запускать осознанно.

## 3. Переменные окружения на VPS

### Staging (`:8080`)

Файл `/etc/vbi-hr/bitrix.env` (systemd уже подключает его):

> Стейдж читает **только** этот файл (и `.env` своего каталога). Боевой `/etc/vbi-hr/bitrix-production.env` в процесс стейджа не попадает (с 2026-10-16, `server/utils/standEnvFiles.ts`). Внимание: `BITRIX_WEBHOOK_URL` стейджа сейчас тот же, что на бою, — он пишет в настоящий crm.vbi.ru.


```bash
# OAuth — вход
BITRIX_PORTAL_URL=https://crm.vbi.ru
BITRIX_CLIENT_ID=local.XXXXXXXX
BITRIX_CLIENT_SECRET=XXXXXXXX
# HMAC cookie-сессий Vibe (свой длинный секрет на сервере)
VBI_SESSION_SECRET=XXXXXXXX
BITRIX_REDIRECT_URI=http://45.12.74.25:8080/api/auth/bitrix/callback

# Вебхук — синк (база без profile.json / user.get). URL = секрет, не светить в логах.
BITRIX_WEBHOOK_URL=https://crm.vbi.ru/rest/ID/СЕКРЕТ/
# График отсутствий (пальма после согласования отпуска в VBI HR)
# BITRIX_ABSENCE_IBLOCK_ID=12
# BITRIX_ABSENCE_IBLOCK_TYPE_ID=structure
# BITRIX_ABSENCE_TYPE_ENUM=1

# Роли по группам Битрикса (ID через запятую)
BITRIX_ADMIN_GROUP_IDS=1
BITRIX_HR_GROUP_IDS=
BITRIX_MANAGER_GROUP_IDS=
```

Сервис: `systemctl restart vbi-hr-staging`.

### Production (бой, порт 80)

Файл `/etc/vbi-hr/bitrix-production.env` → копируется в `/var/www/vbi-hr/.env` при деплое.

```bash
BITRIX_PORTAL_URL=https://crm.vbi.ru
BITRIX_CLIENT_ID=local.XXXXXXXX
BITRIX_CLIENT_SECRET=XXXXXXXX
VBI_SESSION_SECRET=XXXXXXXX
BITRIX_REDIRECT_URI=http://45.12.74.25/api/auth/bitrix/callback
APP_PUBLIC_URL=http://45.12.74.25
BITRIX_WEBHOOK_URL=https://crm.vbi.ru/rest/ID/СЕКРЕТ/
BITRIX_ADMIN_GROUP_IDS=1
```

Образец: `deploy/env/bitrix-production.env.example`. Сервис: `systemctl restart vbi-hr`.

Согласование отпусков — только **`im.notify.system.add`** (колокольчик). Fallback в личный чат не используем.

Локально на Mac: `frontend/.env` (в gitignore), шаблон — `frontend/.env.example`.

После изменений env:

```bash
sudo systemctl restart vbi-hr-staging   # staging
# или
sudo systemctl restart vbi-hr           # production
```

---

## 4. Как работает вход

1. Пользователь нажимает **«Войти через Битрикс24»** → redirect на OAuth портала.
2. После авторизации callback `/api/auth/bitrix/callback`:
   - обмен `code` → `access_token`;
   - `user.current` → сессия в cookie;
   - синк сотрудников (`user.get` + `department.get`);
   - определение роли.
3. Редирект на главную с `?auth=bitrix`.
4. Клиент дожидается cookie (`restoreSession`), загружает данные (`bootstrapAppData`) и убирает query из URL.
5. Редирект на домашнюю страницу: `/` или `/admin` (режим `full`), `/vacations` или `/admin/vacations` (режим `vacations`).

Сессия в cookie — **8 часов** TTL со sliding-обновлением; cookie подписана HMAC (`VBI_SESSION_SECRET`).

**Nginx:** в `proxy_set_header` используйте `Host $http_host` и `X-Forwarded-Port`, чтобы callback возвращал на тот же стенд (тест `:8080`, бой `:80`), без перекрёстных редиректов.

---

## 5. Роли

Роли задаются в разделе **Сотрудники** (поле «Роль») и хранятся в `server/data/employees.json` на сервере.

При входе через Bitrix:

1. Если у сотрудника в справочнике указана роль (`admin` / `hr` / `manager` / `employee`) — **используется она**.
2. Если роль пустая (новый сотрудник) — один раз подставляется из Bitrix (группы, руководитель отдела).
3. Синк из Bitrix **не перезаписывает** уже назначенные роли.
4. После смены роли в «Сотрудники» пользователю достаточно обновить страницу (сессия подтянет новую роль).

**График отпусков** строится **только по справочнику** «Сотрудники» (`employees.json`). Удалённые из справочника не показываются в календаре. Автовход из Bitrix обновляет ФИО/отдел у уже добавленных людей, но **не подтягивает** новых (ботов, экстранет) без ручного импорта.

| Роль в HR | Типичное назначение |
|-----------|---------------------|
| `admin` | Полный доступ, админ-панель |
| `hr` | Кадры, справочники, все согласования |
| `manager` | Согласование отпусков команды |
| `employee` | Свой календарь и заявки |

Группы Bitrix (`BITRIX_*_GROUP_IDS`) нужны только как запасной вариант, пока роль в справочнике не задана.

---

## 6. Демо-логин

При настроенном Bitrix OAuth демо-аккаунты скрыты на staging/production.  
Локально без env Bitrix — остаётся демо-вход.

---

## 7. Проверка end-to-end

1. Создать OAuth-приложение + вебхук в Битриксе.
2. Заполнить `/etc/vbi-hr/bitrix.env` на VPS.
3. Задеплоить последний код, `systemctl restart vbi-hr-staging`.
4. Открыть http://45.12.74.25:8080 → «Войти через Битрикс24».
5. Раздел **Сотрудники** — список из Битрикса.

---

## 8. Типичные ошибки

| Симптом | Решение |
|---------|---------|
| `Bitrix OAuth не настроен` | нет `BITRIX_*` env на сервере |
| `invalid_client` | Неверный **CLIENT_SECRET** (или ID) в `frontend/.env`. Откройте **то же** dev-приложение в Битриксе → скопируйте Client ID и Secret заново, без пробелов. Проверка: `/api/auth/oauth-debug` |
| `Неверный state OAuth` | Вход начали на **localhost**, Битрикс вернул на **сервер** (или другой порт). Создайте **второе** локальное приложение в Битриксе с обработчиком `http://localhost:3000/api/auth/bitrix/callback` и **новыми** CLIENT_ID/SECRET в `frontend/.env`. Не используйте ключи с VPS. |
| `redirect_uri_mismatch` | Redirect URI в приложении ≠ `BITRIX_REDIRECT_URI` (символ в символ) |
| `Неверный state OAuth` | cookies заблокированы |
| `не указан email` | в профиле Битрикс заполнить email |
| `Bitrix REST user.get` | права вебхука / приложения на `user` и `department` |

---

## Приложение: параметры `user.get` в генераторе вебхука

| Параметр | Значение |
|----------|----------|
| `filter[ACTIVE]` | `Y` |
| `select[0]` | `ID` |
| `select[1]` | `NAME` |
| `select[2]` | `LAST_NAME` |
| `select[3]` | `EMAIL` |
| `select[4]` | `WORK_POSITION` |
| `select[5]` | `UF_DEPARTMENT` |

`department.get`: `select[0]=ID`, `select[1]=NAME`, `select[2]=UF_HEAD`, `select[3]=PARENT`.

