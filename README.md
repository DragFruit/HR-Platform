# VIBE VBI

Внутренняя HR-платформа VBI (**vibe.vbi.ru**): геймификация (задачи, валюта, магазин), адаптация, оргструктура и график отпусков. **Пустой старт:** сотрудников и задач нет — наполняете сами. Справочник сотрудников синхронизируется с сервером; адаптация — Nitro API (`frontend/server/data/`).

> **Документация:** этот файл — точка входа. **Правила продукта**: [docs/PRODUCT.md](docs/PRODUCT.md). Идеи из K-Team HRM: [docs/K-TEAM-MAP.md](docs/K-TEAM-MAP.md). Код и API: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). История: [docs/CHANGELOG.md](docs/CHANGELOG.md).

---

## Быстрый старт

1. **macOS:** дважды кликните **`Open Frontend.command`** в корне проекта.
2. **Windows / любой ОС:** в терминале `cd frontend && npm install && npm run dev` (нужен [Node.js LTS](https://nodejs.org/)).
3. Откроется локальный фронт — войдите через Bitrix или демо (если включён QA).
4. Чтобы остановить сервер — закройте окно терминала / `Ctrl+C`.

**Полная платформа** (staging / локально): `cd frontend && npm run dev`.

**Бой** сейчас по IP `http://45.12.74.25` (порт 80); домен `vibe.vbi.ru` — целевой бренд-URL продукта.

Альтернатива из терминала:

```bash
cd frontend
npm install
npm run dev             # полная платформа, http://localhost:3000
npm run dev:vacations   # только отпуска + демо QA
```

---

## Демо-аккаунты (отдел «Тестировщики»)

При включённом `NUXT_PUBLIC_QA_TEST_DEPARTMENT=1` (localhost, staging и production-сборка для показа) на экране входа доступны демо-логины рядом с Битрикс.

| Email | Пароль | Персона | Для показа |
|-------|--------|---------|------------|
| `katya@vbi.local` | `employee123` | **Даша Тестова** | Свой календарь, заявки, бронь, обучалка |
| `vasya@vbi.local` | `employee123` | **Василий Тестов** | Свой календарь и заявки |
| `alina@vbi.local` | `employee123` | **Алина Тестова** | Заявка на согласовании у тимлида |
| `kostya@vbi.local` | `manager123` | **Константин Тестов** — тимлид | Календарь команды (4 сотрудника), вкладка «Согласование» |
| `masha@vbi.local` | `employee123` | **Мария Тестова** — директор | Второй этап согласования |
| `stas@vbi.local` | `admin123` | Администратор | HR-разделы (на production — с замочком, кроме отпусков) |

Пятый сотрудник команды — **Марина Тестова** (без отдельного логина): видна в календаре руководителя и в «Общем» календаре отдела.

На экране входа блок **«Учётные записи для входа»** подставляет логин и пароль по клику.

### Первый запуск

1. Войти как **Стас** (`stas@vbi.local` / `admin123`).
2. **Админ → Сотрудники** — добавить людей, привязать email к аккаунту входа.
3. **Админ → Задачи** — создать задачи в общий пул.
4. Войти как сотрудник → **Задачи** (взять и завершить) → валюта на **Кошелёк**; **Адаптация** после привязки профиля.

---

## Структура репозитория

```
VBI HR платформа/
├── Open Frontend.command   # macOS: сборка + запуск
├── README.md               # Этот файл
├── docs/
│   ├── ARCHITECTURE.md     # Архитектура, модули, localStorage
│   ├── CHANGELOG.md        # История версий и фич
│   ├── PRODUCT.md          # Бизнес-правила
│   └── DEPLOYMENT.md       # GitLab CI, VPS, nginx, systemd
├── deploy/                 # Выкладка на сервер (см. DEPLOYMENT.md)
│   ├── nginx/
│   ├── systemd/
│   └── scripts/
├── .gitlab-ci.yml          # Сборка и deploy на VPS
├── frontend/               # Nuxt 4 + Nitro (UI и API)
│   └── app/
│       ├── app.vue         # Shell: auth, sidebar, NuxtPage
│       ├── assets/main.css # Дизайн-система
│       ├── components/     # UI-компоненты
│       ├── composables/    # Бизнес-логика и состояние
│       ├── pages/          # Маршруты
│       └── plugins/        # Клиентская инициализация данных
└── scripts/                # CLI (rollover года и др.)
```

---

## Модули платформы

### Сотрудник

| Раздел | URL | Описание |
|--------|-----|----------|
| Главная | `/` | Дашборд: прогресс, KPI, задачи, магазин |
| Адаптация | `/adaptation` | Онбординг новых сотрудников |
| Структура | `/organization` | Оргсхема (только просмотр) |
| График отпусков | `/vacations` | Календарь, заявки, баланс |
| Задачи | `/tasks` | Геймификация: задачи и награды |
| Магазин | `/store` | Покупка наград за валюту |
| Кошелёк | `/wallet` | История операций |
| Профиль | `/profile` | Профиль сотрудника |

### Администратор

Доступен пользователю с `role: admin` (переключатель в сайдбаре).

| Раздел | URL |
|--------|-----|
| Панель | `/admin` |
| Структура (редактор) | `/admin/organization` |
| Сотрудники, аккаунты и подчинение | `/admin/employees` |
| Задачи (пул) | `/admin/tasks` |
| График отпусков | `/admin/vacations` |
| Магазин | `/admin/store` |
| Адаптация | `/admin/adaptation` |

---

## Оргструктура

Просмотр: **`/organization`**. Редактор: **`/admin/organization`**.

Бизнес-правила (панель сотрудников, матчинг отделов, без скролла схемы): **[docs/PRODUCT.md](docs/PRODUCT.md)** §8.  
Техника (API, `layoutCompressX`, компоненты): **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

Кратко:

- Три директора; отделы и связи на схеме (`OrgChart.vue`).
- Клик по отделу → правая панель со списком (`OrgUnitRosterAside`); человек → визитка.
- Схема всегда целиком на экране; с панелью сжимается только по ширине.
- Данные: `useOrgStructure` + `server/data/org-structure.json` (`/api/org-structure`); кэш `vbi-org-structure-v1`.

> Ранее был эксперимент с редактором «как Miro» (canvas 24×18). Он **откачен**; не восстанавливать без явного запроса.

---

## График отпусков

Бизнес-правила (дни, остаток, согласование, бронь, напоминания бота): **[docs/PRODUCT.md](docs/PRODUCT.md)** §1.  
Bitrix-бот и systemd timers: **[docs/BITRIX.md](docs/BITRIX.md)**.

Логика UI перенесена с референса в `_vacation_source/График отпусков/`. Сид: `frontend/app/data/vacation-seed.json`.

---

## Коды ChatGPT → Telegram

Параллельно кнопке в `/vpn`: почта → бот → корпоративный канал (каждые 2 мин). Настройка бота, env, cron: **[docs/CHATGPT-TELEGRAM.md](docs/CHATGPT-TELEGRAM.md)**.

---

## Технологии

| Слой | Стек |
|------|------|
| Frontend | Nuxt 4, Vue 3, Nitro (SSR) |
| Стили | Один `main.css`, CSS-переменные |
| Состояние | Nuxt `useState` + `localStorage` |
| Эффекты | `@hiseb/confetti` (приветствие после первого входа) |

---

## Git

```bash
git log -1          # последний коммит
git status          # незакоммиченные изменения
```

Первый снимок: восстановление полной платформы до Miro-редактора оргструктуры.

---

## Сброс демо-данных

DevTools → Application → Local Storage → удалить ключи `vbi-*` или повысить версию в `plugins/vbi-demo-data.client.ts` (`DEMO_PLATFORM_VERSION`).

Критичные ключи перечислены в [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#localstorage).

---

## Git: тест и бой

| Ветка | Стенд | Модули | `NUXT_PUBLIC_LAUNCH_SCOPE` |
|-------|-------|--------|----------------------------|
| `staging` | Стейдж `:8080` | Вся платформа | `full` |
| `main` | Бой `:80` | Пилот: отпуска + whitelist (идеи, **база знаний**, …); VPN с замком | `vacations` |

**Публикация (2 задачи):** [docs/CI-CD.md](docs/CI-CD.md) — `scripts/push-to-gitlab.sh` (Mac→Git), GitLab CI (Git→сервер).

---

## Дальнейшее развитие

- Больше данных с сервера (Nitro / `server/data`), меньше опоры на `localStorage`.
- Синхронизация оргструктуры с Bitrix / 1С (по необходимости).

При добавлении фич обновляйте **`docs/CHANGELOG.md`** и при необходимости разделы в этом README и `ARCHITECTURE.md` (см. правило Cursor `.cursor/rules/docs-maintenance.mdc`).
