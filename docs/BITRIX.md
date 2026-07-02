# Интеграция с Битрикс24 (коробка)

OAuth-вход и синхронизация сотрудников из **Структуры компании**.

Портал VBI: `https://crm.vbi.ru`

---

## 0. Запутались в приложениях? (шпаргалка)

Нужно **ровно 2** локальных приложения — не больше. Остальные можно удалить.

| Что видите в списке | Оставить? | Для чего |
|---------------------|-----------|----------|
| **VBI HR Platform** | ✅ **Да — бой** | Сервер `http://45.12.74.25`, ключи в `/etc/vbi-hr/bitrix.env` |
| **VBI HR Platform (dev)** или новое с именем «dev» | ✅ **Да — Mac** | `npm run dev`, ключи только в `frontend/.env` |
| **hrVibeVbi** | ❌ Удалить | Старое/тестовое, если не пользуетесь |
| **Локальное приложение** с правами только **CRM** | ❌ Удалить | Не подходит для входа HR (нужны **Пользователи** + **Структура компании**) |

### Как понять, какое приложение где

1. Откройте приложение в Битриксе → скопируйте **Код приложения (Client ID)**.
2. Сравните:
   - совпадает с `BITRIX_CLIENT_ID` на сервере → это **бой**;
   - совпадает с `frontend/.env` на Mac → это **локальная разработка**;
   - ни с чем не совпадает → **удалить**.

3. Поле **«Путь вашего обработчика»**:
   - бой: `http://45.12.74.25/api/auth/bitrix/callback`
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

### Два приложения (рекомендуется)

| Стенд | Где крутится HR | Название в Битриксе | **Путь вашего обработчика** |
|-------|-----------------|---------------------|-------------------------------|
| **Тест (локально)** | Mac, `npm run dev` | `VBI HR Platform (dev)` | `http://localhost:3000/api/auth/bitrix/callback` |
| **Бой (сервер)** | VPS, порт 80 | `VBI HR Platform` | `http://45.12.74.25/api/auth/bitrix/callback` |

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

Права: **user** + **структура/department** + **lists** (универсальные списки) + **calendar** (календарь, запасной канал для отсутствий).

Базовый URL (без метода в конце):

```
https://crm.vbi.ru/rest/ID/СЕКРЕТ/
```

Переменная на сервере: `BITRIX_WEBHOOK_URL=...`

### Отпуска → график отсутствий (пальма)

После **согласования** заявки в VBI HR сервер создаёт запись «отпуск ежегодный» в Битриксе:

1. `lists.element.add` в инфоблок **График отсутствий** (основной путь, появляется пальма).
2. Если не удалось — `calendar.event.add` с `accessibility: absent` (запасной путь).

Опционально в env:

| Переменная | Назначение |
|------------|------------|
| `BITRIX_ABSENCE_IBLOCK_ID` | ID инфоблока графика отсутствий (если не задан — автопоиск по имени) |
| `BITRIX_ABSENCE_IBLOCK_TYPE_ID` | Тип инфоблока, по умолчанию `structure` |
| `BITRIX_ABSENCE_TYPE_ENUM` | ENUM_ID типа «отпуск ежегодный», по умолчанию `1` |

Код: `server/utils/bitrixVacationAbsence.ts`, вызов из `PUT /api/vacations`.

Проверка: согласовать отпуск в `/vacations` → в «Мои заявки» тег **Битрикс ✓** → в портале `crm.vbi.ru` пальма у сотрудника на даты отпуска.

Проверка вебхука в генераторе: методы `user.get`, `department.get`, `lists.get`, `lists.element.add`.

---

## 3. Переменные окружения на VPS

Файл `/etc/vbi-hr/bitrix.env` (systemd уже подключает его):

```bash
# OAuth — вход
BITRIX_PORTAL_URL=https://crm.vbi.ru
BITRIX_CLIENT_ID=local.XXXXXXXX
BITRIX_CLIENT_SECRET=XXXXXXXX
BITRIX_REDIRECT_URI=http://45.12.74.25:8080/api/auth/bitrix/callback

# Вебхук — синк (база без profile.json / user.get)
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

Локально на Mac: `frontend/.env` (в gitignore), шаблон — `frontend/.env.example`.

После изменений:

```bash
sudo systemctl restart vbi-hr-staging
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

Сессия в cookie — **14 дней**, без разлогина при неактивности.

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

