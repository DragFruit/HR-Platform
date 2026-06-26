# Интеграция с Битрикс24 (коробка)

OAuth-вход и синхронизация сотрудников из **Структуры компании**.

Портал VBI: `https://crm.vbi.ru`

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

### Бой на VPS

Ключи из **prod-приложения** — в `/etc/vbi-hr/bitrix.env`:

```bash
BITRIX_REDIRECT_URI=http://45.12.74.25/api/auth/bitrix/callback
```

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

## 2. Вебхук (для синка сотрудников)

Отдельно от OAuth: **Разработчикам** → **Входящий вебхук**.

Права: **user** + **структура/department**.

Базовый URL (без метода в конце):

```
https://crm.vbi.ru/rest/ID/СЕКРЕТ/
```

Проверка в генераторе: методы `user.get` и `department.get` (параметры — в конце документа).

Переменная на сервере: `BITRIX_WEBHOOK_URL=...`

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

| Роль в HR | Условие |
|-----------|---------|
| `admin` | `user.admin` или группа из `BITRIX_ADMIN_GROUP_IDS` (по умолчанию `1`) |
| `hr` | группа из `BITRIX_HR_GROUP_IDS` |
| `manager` | `UF_HEAD` любого отдела или группа из `BITRIX_MANAGER_GROUP_IDS` |
| `employee` | остальные |

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

