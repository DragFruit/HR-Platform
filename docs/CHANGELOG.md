# Changelog

Формат: кратко по датам. При каждой заметной фиче добавляйте запись сверху.

## 2026-05-28

### main: только график отпусков; разработка на staging

- Ветка `main` (бой): `NUXT_PUBLIC_LAUNCH_SCOPE=vacations` по умолчанию в `nuxt.config.ts` и в CI.
- Ветка `staging` (тест): полная платформа (`full`). Дальнейшие фичи — коммиты в `staging`.
- Пути: `frontend/nuxt.config.ts`, `.github/workflows/ci.yml`, `release-artifact.yml`.

### Git: ветки staging / main и CI

- Ветки: `staging` (тест, плашка в UI) и `main` (бой); документация [docs/DEPLOYMENT.md](DEPLOYMENT.md).
- GitHub Actions: `ci.yml` (сборка на PR/push), `release-artifact.yml` (артефакт `.output`).
- Env: `NUXT_PUBLIC_APP_ENV` (`development` | `staging` | `production`), пример — `frontend/.env.example`.
- Composable `useAppEnv.ts`, скрипт `scripts/setup-git-branches.sh`.

### Полная платформа снова по умолчанию

- `NUXT_PUBLIC_LAUNCH_SCOPE` по умолчанию — `full`: в меню видны все разделы (главная, адаптация, задачи, кошелёк, магазин и т.д.).
- Пилот «только отпуска»: `NUXT_PUBLIC_LAUNCH_SCOPE=vacations` в `frontend/nuxt.config.ts` или `.env`.
- Проверка: перезапустить dev-сервер → в сайдбаре полный список пунктов.

### Единый современный UI по всей платформе

- Обновлена глобальная дизайн-система в `frontend/app/assets/main.css`: карточки, кнопки, segment-фильтры, таблицы, чипы, сайдбар, топбар, формы, адаптация, профиль.
- HR-очередь согласования (`/admin/vacations`) приведена к тому же виду, что у руководителя: аватары-инициалы, пересечения отпусков, кнопки «Согласовать / Отклонить».
- Проверка: открыть главную, задачи, кошелёк, магазин, адаптацию, профиль и `/admin/*` — единый фиолетово-белый стиль с градиентами и мягкими тенями.

### График отпусков: команда руководителя (тест)

- В `server/data/employees.json` у Кати, Васи, Маши и Алины руководитель — **Костя** (отдел «Команда»).
- Руководитель в календаре и согласовании видит всех подчинённых из справочника (`directReportsForAuthUser`).
- Проверка: `kostya@vbi.local` → «График отпусков» → календарь с 4 сотрудниками. Если данных нет — очистите `vbi-employees-v3` в localStorage и перезайдите.

### Поэтапный запуск: только график отпусков

- Режим `NUXT_PUBLIC_LAUNCH_SCOPE=vacations` (по умолчанию) — сотрудники видят `/vacations`; админ переключается «Сотрудник / Администратор» и настраивает `/admin/employees` + `/admin/vacations`.
- Composable: `useLaunchScope.ts`, настройка в `nuxt.config.ts`.

### Исправления после аудита

- **SSR:** динамический импорт confetti в `FirstLoginOnboarding.vue` (устранён 500 `window is not defined`).
- **Админ-маршруты:** guard ждёт `authReady` и учитывает `user.role === 'admin'` — refresh `/admin/*` не сбрасывает на `/`.
- **Logout:** сброс `adaptation-me` и `platform-role`.
- **Отпуска:** `setRequestStatus` ищет заявку по всем годам; `viewYear` по умолчанию — текущий год.
- **Сессия:** дедупликация `restoreSession` (модульный lock).
- **Сотрудники:** один аккаунт — одна строка справочника при привязке.
- **Вёрстка:** `flex-wrap` в `.topbar-right`.

### Навигация: «Профиль» для всех

- Пункт «Профиль» (`/profile`) в сайдбаре и в режиме сотрудника, и в режиме администратора (`usePlatformContext.ts`).

### Профиль: блок «Команда»

- `/profile` — список коллег по отделу (ФИО + аватар); для руководителя — подчинённые из справочника (`manager` в `useEmployees`).
- Логика: `profileTeamForUser` в `useEmployees.ts`.

### Аватары персонажей (геймификация)

- 40 PNG в `frontend/public/avatars/` (`character_01` … `character_40`).
- При первом входе: приветствие → выбор аватара → конфетти (`FirstLoginOnboarding.vue`).
- Хранение: `localStorage` ключ `vbi-user-avatars-v1` (по `platform_user_id` / id сессии).
- UI: `UserAvatar.vue`, аватар в шапке, профиле (`/profile` — смена), админ-таблице сотрудников.
- Имя на онбординге не запрашивается (позже — Битрикс24).
- Проверка: войти новым аккаунтом или очистить `vbi-welcomed-users` и `vbi-user-avatars-v1` → логин → выбрать персонажа.

### Подчинение в справочнике сотрудников

- Раздел «Подчинение» убран из меню; `/admin/hierarchy` → `/admin/employees`.
- Иерархия задаётся колонкой «Руководитель» в таблице сотрудников.

### Пустой старт и связанные модули

- Нет предзаполненных сотрудников, задач, отпусков, оргструктуры и кошельков (`vbi-platform-demo-version` → `5`).
- Админ: `/admin/employees` (онбординг), `/admin/tasks` (создание задач в пул).
- Email сотрудника автоматически привязывает `platform_user_id`; завершение задачи начисляет валюту.
- Главная и админ-панель показывают реальные метрики и чеклист первого запуска.

### Согласование платформы (аудит)

- **Кошелёк:** баланс и подарки привязаны к `useAuth().user.id`; список коллег из `useEmployees`; имя отправителя в транзакции корректное; кошелёк для Алины (id 6).
- **Сотрудники:** `GET/PUT /api/employees`, синхронизация справочника client ↔ `server/data/employees.json`.
- Удалён мёртвый `useAdaptationData.ts`; обновлены тексты (главная, отпуска); README без `/admin/users`.
- Счётчик активных пользователей на `/admin` — из справочника сотрудников.

### Админка: единая таблица «Сотрудники и аккаунты»

- `/admin/employees` — столбцы: ФИО, должность, отдел, руководитель, дата, email, роль.
- `/admin/users` перенаправляет на `/admin/employees`; пункт «Аккаунты» убран из меню.
- Данные в `vbi-employees-v3` (поля `email`, `account_role`).

### Адаптация: трек Jinn, тесты и журнал админа (Nitro API)

- Трек по этапам: до выхода, день 1, неделя 1, 30 дней, 90 дней — `frontend/server/data/adaptation-track.json`.
- Тесты с проверкой на сервере; результаты в `frontend/server/data/adaptation-state.json` с `employee_id` и `employee_name`.
- API: `/api/auth/session`, `/api/adaptation/me`, `/api/adaptation/attempts`, `/api/adaptation/steps/:stepId`.
- UI: `adaptation.vue`, `admin/adaptation.vue`, `AdaptationQuizForm.vue`, `useAdaptation.ts`.
- Новичок для проверки: `alina@vbi.local` / `employee123` (`hired_at: 2026-05-25`).
- Проверка: войти как Алина → `/adaptation` → пройти тест → войти как `stas@vbi.local` → `/admin/adaptation` → увидеть попытку с ответами.

## 2026-05-25

### Убран блок «VBI в цифрах» из оргструктуры

- Удалён UI в `OrgChart.vue` и данные `orgStats` / `addStatsFact` в `useOrgStructure.ts`.
- Из `localStorage` (`vbi-org-structure-v1`) больше не сохраняется поле `stats`.
- Проверка: `/organization` и `/admin/organization` — только директора, отделы и группы.

## 2026-05-25 (ранее)

### Восстановление платформы (коммит `2700d05`)

- Восстановлен полный фронтенд до эксперимента с Miro-редактором оргструктуры.
- Фиолетовая дизайн-система, экран входа, welcome с confetti.
- Модули: главная, адаптация, задачи, магазин, кошелёк, профиль, отпуска, админка.
- Оргструктура: `OrgChart.vue` (иерархия VBI), данные `vbi-org-structure-v1`.
- Удалён `OrgChartCanvas.vue` (canvas 24×18, линии-связи).
- `Open Frontend.command` — сборка и запуск на `http://127.0.0.1:3300/`.
- Инициализирован git-репозиторий, добавлен `.gitignore`.
- Документация: `README.md`, `docs/ARCHITECTURE.md`, `docs/CHANGELOG.md`.

### Демо-команда

- Стас — admin (`stas@vbi.local` / `admin123`).
- Костя — manager, Катя / Вася / Маша — employees.
- Справочник отпусков: `vbi-employees-v3`, состояние `vbi-vacations-state-v3`.

---

## Шаблон для новых записей

```markdown
## YYYY-MM-DD

### Название фичи

- Что сделано.
- Какие файлы / URL затронуты.
- Новые ключи localStorage или API (если есть).
- Как проверить.
```
