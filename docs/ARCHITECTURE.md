# Архитектура VIBE VBI

Бизнес-правила (что считается, этапы, остатки дней): **[PRODUCT.md](./PRODUCT.md)**.  
Идеи из обзора K-Team HRM → VBI: **[K-TEAM-MAP.md](./K-TEAM-MAP.md)**.  
Этот файл — карта кода, API и storage.

## Обзор

```mermaid
flowchart TB
  subgraph client [Браузер]
    CMD[Open Frontend.command]
    Nuxt[Nuxt 4 + Nitro]
    LS[(localStorage)]
  end

  CMD -->|build + node .output| Nuxt
  Nuxt --> LS

  subgraph modules [Модули app/]
    Auth[useAuth]
    Shell[app.vue + usePlatformContext]
    Org[useOrgStructure + OrgChart]
    Vac[useEmployees + useVacations]
    Game[useTasks + useWallet + useMockData]
    Adapt[useAdaptation]
  end

  Nuxt --> Auth
  Auth --> Shell
  Shell --> modules
```

Приложение — **SPA с SSR**: сервер отдаёт HTML, интерактивность и персистентность на клиенте.

---

## Точка входа и оболочка

### `app/app.vue`

Порядок рендера:

0. Путь начинается с `/s/` (публичная страница опроса, `isBareRoute`) → **только** `<NuxtPage />`, без логина/sidebar/topbar/футера/оверлеев — respondent не обязан иметь Vibe-сессию и не должен увидеть ничего, что выдаёт платформу
1. `authReady === false` → «Загрузка...»
2. Не авторизован → `AuthLogin.vue`
3. Авторизован → `app-shell` (sidebar + topbar + `<NuxtPage />`) + опционально `FirstLoginOnboarding` (приветствие → аватар → конфетти)

### `usePlatformContext.ts`

- Роль UI: `employee` | `admin` (не путать с `user.role` в auth).
- Админ с `role: admin` может переключать режим в сайдбаре.
- `guardRoute`: пути `/admin/*` недоступны в режиме сотрудника.

### Поэтапный запуск (`useLaunchScope.ts`)

- Env: `NUXT_PUBLIC_LAUNCH_SCOPE` — `full` (по умолчанию) или `vacations`.
- В режиме `vacations`: сотрудник — `/vacations`; админ — переключатель в сайдбаре. Whitelist боя: отпуска, уведомления, профиль, идеи, **база знаний** (`/knowledge`, `/admin/knowledge`), сотрудники, оргструктура админки. С замком: VPN, «Как выглядит».
- **Хардлок боя:** хост `45.12.74.25` без порта `:8080` всегда `vacations` (`utils/productionHost.ts`), даже если в бандле ошибочно `full` / `appEnv=development`.

### Окружения и деплой

- Env: `NUXT_PUBLIC_APP_ENV` — `development` | `staging` | `production` (`useAppEnv.ts`; на хосте боя принудительно `production`).
- Ветки Git: `staging` → тест, `main` → бой. Подробно: [DEPLOYMENT.md](DEPLOYMENT.md).
- CI: GitLab `.gitlab-ci.yml` (сборка + deploy на VPS); опционально GitHub Actions `ci.yml`, `release-artifact.yml`.
- Ручной бой: только `build-and-deploy.sh production`. Перед rsync — `verify-production-build.sh` (отказ, если нет `appEnv=production` + `launchScope=vacations`).
- Клиентские ассеты `public/_nuxt`: при деплое **без** `--delete` (Вебвизор тянет CSS по старым URL ~15 суток); файлы старше 20 дней чистятся.
- На сервере: `deploy/systemd/`, `deploy/nginx/`, порты 3300 (бой) / 3301 (тест).
- **Данные на production/staging** — рабочие: `employees.json` merge (`merge-employees-seed.mjs`, сервер + overlay руководителей); `vacations.json` и `ideas.json` при деплое не перезаписываются, если файл уже на сервере.
- **Бэкап отпусков:** еженедельный снапшот `vacations.json` → `server/data/backups/vacations/` (`vbi-hr-vacations-backup.timer`, 12 копий). Скрипт `deploy/scripts/run-vacations-backup.sh` (копия файла, без HTTP).
- **Памятка после отпуска:** `PostVacationMemo.vue` в `app.vue`; правило в `postVacationMemo.ts`; ключ `vbi-post-vacation-memo-v2`. UI Design C: lavender card + folder-tabs 1–5 (декор) + арт `/memos/pvm-c-art-*.png` (без текста). Welcome → **Прочитать** сразу в совет 1; **Позже** → чип 10 рабочих дней → карусель с вводной «Вот четыре совета», затем 4 совета. Превью `?pvm=1`; повтор из уведомлений `?pvm=tips`. Уведомление `post_vacation_memo` (`POST /api/notifications/post-vacation-memo`). Пока памятка жива, занимает слот `useBottomRightSlot` — кот оценки не выезжает.
- **Кот оценки:** `PageRateCatHost` + `KnowledgeRateCat`; не монтируется, если `useBottomRightSlot().isOccupied`.

### Битрикс24 (коробка)

- OAuth 2.0 локального приложения: `GET /api/auth/bitrix` → портал → `GET /api/auth/bitrix/callback`.
- Вход разрешён **только** если Bitrix user id есть в `employees.json`; иначе 403 (экстранет/гости).
- Синк при входе: `bitrixSync.ts` → обновляет уже заведённых, `importNew` по умолчанию **false**.
- Сессия: подписанная cookie (`sessionToken.ts`), TTL 8ч, Secure на staging/prod, sliding refresh в `requireVbiSession`.
- Сессия: cookie `vbi-session`, `auth_source: 'bitrix'`, `id` = `bitrix_user_id`.
- Env (сервер): `BITRIX_PORTAL_URL`, `BITRIX_CLIENT_ID`, `BITRIX_CLIENT_SECRET` — см. [BITRIX.md](BITRIX.md).

### Плагины (только client)

| Файл | Назначение |
|------|------------|
| `auth.client.ts` | `restoreSession()` при старте |
| `vbi-demo-data.client.ts` | Миграция версии демо, `hydrate()` сотрудников, отпусков, оргструктуры |

---

## Composables

| Composable | Файл | Ответственность |
|------------|------|-----------------|
| `useAuth` | `useAuth.ts` | Логин, сессия, онбординг (welcome + аватар) |
| `useAvatars` | `useAvatars.ts` | Персонажи `public/avatars/`, выбор и URL по user id |
| `usePlatformContext` | `usePlatformContext.ts` | Навигация, режим admin/employee |
| `useLaunchScope` | `useLaunchScope.ts` | Поэтапный запуск (`vacations` / `full`) |
| `usePermissions` | `usePermissions.ts` | Подписи ролей, `roleLabel` |
| `useEmployees` | `useEmployees.ts` | Справочник ФИО, руководители, связь с аккаунтами |
| `useEmployeeVisitingCard` | `useEmployeeVisitingCard.ts` | Публичная визитка у клика (команда в профиле, идеи; не календарь отпусков; структура — позже) |
| `useVacations` | `useVacations.ts` | Заявки, календарь, двухэтапное согласование Digital (`vacationApproval.ts`) |
| `useManagerVacationMode` | `useManagerVacationMode.ts` | Режим отпусков руководителя/HR `manager` / `employee` (`useState('vac-manager-ui-mode')`): тумблер в aside и «Я · Руководитель» в мобильной шапке |
| `useOrgStructure` | `useOrgStructure.ts` | Директора, отделы, группы, сетка |
| `useTasks` | `useTasks.ts` | Задачи геймификации |
| `useWallet` | `useWallet.ts` | Баланс и транзакции |
| `useMockData` | `useMockData.ts` | Демо-данные дашборда, магазин |
| `useAdaptation` | `useAdaptation.ts` | Трек адаптации, тесты, `$fetch` к Nitro API |
| `useProfileActivity` | `useProfileActivity.ts` | Лента «Недавняя активность» (сервер + авто) |
| `useAdminData` | `useAdminData.ts` | Справочники админки (пользователи, отделы legacy) |
| `useIdeasBank` | `useIdeasBank.ts` | Банк идей: список, голоса, создание, этапы, удаление |
| `useAdminNotifications` | `useAdminNotifications.ts` | Колокольчик admin/HR (в т.ч. `idea_submitted`, юбилеи) |
| `useAdminSurveys` | `useAdminSurveys.ts` | Опросы (админ): список, создание, конструктор, публикация, результаты |
| `useSurveyRespond` | `useSurveyRespond.ts` | Публичная страница `/s/:slug`: загрузка опроса, отправка ответа — без auth-состояния |

**Правило:** `useState()` только **внутри** функций composable / setup — не на уровне модуля (иначе SSR 500 и вечная «Загрузка...»).

---

## Страницы (`pages/`)

### Сотрудник

- `index.vue` — главная
- `adaptation.vue`
- `organization.vue` → `OrgChart` readonly + панель сотрудников; продуктовые правила **[PRODUCT.md](./PRODUCT.md)** §8
- `vacations.vue` — employee UI или `VacationsManagerExperience` (manager/hr)
- `tasks.vue`, `store.vue`, `wallet.vue`, `profile/index.vue`
- `ideas/index.vue` — банк идей (сотрудник)
- `event/pit-stop/` — временный ивент **Pit Stop 14** (модуль `app/events/pit-stop-14/`, API `/api/event/pit-stop/*`, данные `server/data/pit-stop-14.json`). Хаб `index.vue` — гонки: `PitStopHubDrive.vue` + `trackDrive.ts` (маска `track-race-mask.png`, зоны круга, цвета болида), рекорды `POST /api/event/pit-stop/race/lap` / `GET …/race/leaderboard` → `server/data/pit-stop-race.json` (`pitStopRaceStore.ts`). После стопа **10.10 03:00 МСК** — `ensureRaceFinalized` пишет `winners` (топ‑3), ачивка `pit-stop-14` в секции `corporate-culture` (`usePitStopWinners`, визитка через `employeePublicCard`). Цвет болида — `localStorage` `vbi-pit-stop-car-color-v1`. Срезы таблицы — `leaderboardSlots()` / `bestAsOf()` в `pitStopRaceStore.ts` (история улучшений в записи). Финиш 1 круга → `PitStopFinishParty.vue` только при улучшении рекорда (canvas 160×96 + конфетти 320×180, шрифт `pixelFont.ts`). Звуки — `raceAudio.ts` (Web Audio). Енот-обучалка — `RACCOON_RACE_INTRO` в `raccoonLines.ts`, ключ `vbi-pit-stop-raccoon-race-v1`. Страницы чек-поинтов `[id].vue` остаются, с хаба не ссылаются.
- `knowledge/index.vue` — поиск / чат ИИ; FAB «написать» слева внизу → `/knowledge/write` (`KnowledgeArticleWorkspace.vue`: редактор как у админа + свои статьи / команда / ревью). `knowledge/[id].vue` — статья. Сид `data/knowledgeBaseCatalog.ts`. Поиск: `utils/knowledgeSearch.ts`, `useKnowledgeSearch`. ИИ: `useKnowledgeAiAnswer` + `POST /api/knowledge/yandex-ask`, `useKnowledgeAiChat`. Оценка страницы: `POST /api/knowledge/feedback` → админ-уведомление `page_feedback` + imbot Драго. Подсказки: `knowledgeSearchPhrases.ts`.
- Статьи сотрудников: страница `/knowledge/write`; `useKnowledgeAuthor` + API `GET/POST /api/knowledge/articles`, `PATCH …/:id`, `POST …/submit|moderate|comments`. Модель: `authorUserId`, `comments[]`, `pendingRevision`, статусы `draft|pending_review|published|revision_requested|rejected`. Notify: `knowledgeNotifications.ts` → `createUserNotification` + `notifyBitrixSystemUser` (как отпуска/идеи); bell link → `/knowledge/write`.
- Картинки статей: HTML `src="/knowledge/article-{bitrixId}/…"` → файлы в `frontend/public/knowledge/article-*/` **обязательно в git** вместе с `server/data/knowledge-articles.json`. Деплой: `merge-knowledge-articles-seed.mjs` не затирает админские правки целиком, но обновляет `body`/`coverImage`, если сид несёт локальные `/knowledge/article-…`, на сервере остался Bitrix-chrome `/devs/asset/`, или `body` на сервере экранирован (`&lt;a` / `&lt;br` — артефакт старого markdown-детекта в WYSIWYG). Платформенные статьи Vibe (`kb-vibe-vacations-digital`, `kb-vibe-vacations-other`, `kb-vibe-ideas`) и кейсы ecom (`kb-case-ecom-*`, `kb-case-ecom-index`; MD в `docs/knowledge-cases/ecom/`) всегда берутся из сида; retired id (`kb-vibe-vacations`) с целевого файла снимается. Тела без блочных тегов нормализуются в `knowledgeArticleHtml.ts` (decode + обёртка `<div>`). Перенос из Bitrix: `scripts/bitrix/scrape-devs-articles.mjs` → `migrate-devs-to-knowledge.mjs` (временные HTML в `scripts/bitrix/tmp/`, в git не кладём).
- **RAG (поиск по смыслу) для «Спросить ИИ»:** эмбеддинги Yandex (`text-search-doc` / `text-search-query`) + гибрид со словесным score + осторожная переформулировка (`knowledgeRagRewrite.ts`, `knowledgeRagLexical.ts`). HTML → plain **с сохранением строк** (`stripHtml`), иначе шапки секций «Контактов» не детектятся. Длинные статьи режутся по underscore-разделителям и шапкам блоков (Programmatic, юристы, дизайнеры, Яндекс, переводы, UTM/коллтрекинг, акты YDirect/VKR, списания AFINA, разделы DayOFFF…). Якорь секции Контактов → только `kb-20409`; UTM → `kb-23420`; акты РП → `kb-31980`; списания → `kb-28468`. Индекс `server/data/knowledge-rag-index.json` (не в git, `INDEX_VERSION=6`). Endpoint `POST /api/knowledge/yandex-ask` сам подбирает фрагменты; `expandQuestionFromHistory` / `knowledgeAiIntent` склеивают уточнения («ещё другие», «это все?») с прошлым вопросом; guard против ложного OFFTOPIC при живом контексте. Вопросы про руководителей/отделы — `knowledgeOrgAnswer.ts` из `org-structure.json` + цитата «Структура». Пересборка: мутации статей, `POST /api/admin/knowledge/rag-reindex`, cron `knowledge-rag-reindex`. Eval: `POST /api/admin/knowledge/rag-eval`, кейсы `knowledgeRagEvalCases.ts`; локально `scripts/knowledge/check-rag-contacts.mjs`, `check-rag-access-utm.mjs`, `check-rag-dayoff-acts-writeoffs.mjs`, `check-kb-dialog-followup.mjs`, `check-kb-cases-fallback.mjs`, `check-kb-auto-avito.mjs`.

### Админ

- `admin/index.vue` — хаб ссылок
- `admin/organization.vue` — `OrgChart` + кнопки +директор / +отдел / +группа; данные `GET/PUT /api/org-structure` → `server/data/org-structure.json`
- `admin/employees.vue` (сотрудники, аккаунты, подчинение), `admin/hierarchy.vue` (редирект → employees), `admin/vacations.vue` (календарь + очередь согласования)
- `admin/how-it-looks.vue` — превью как у руководителя; на бое с замком после выката рук-ам
- `admin/users.vue` (редирект → employees), `admin/store.vue`, `admin/adaptation.vue`
- `admin/knowledge.vue` — редактор базы знаний (создать/редактировать/удалить/модерировать, WYSIWYG). Компонент `KnowledgeWysiwygEditor.vue`. Тело — HTML. Статусы: `draft` \| `pending_review` \| `published` \| `revision_requested` \| `rejected` (legacy `review` → `pending_review`). API: `GET/POST /api/admin/knowledge`, `PATCH/DELETE /api/admin/knowledge/:id` (в т.ч. `moderateAction`) → `server/data/knowledge-articles.json`
- `admin/activity.vue` — ручные события профиля («Недавняя активность»)
- `admin/ideas.vue` — банк идей: этапы, комментарии, удаление
- `admin/surveys/index.vue`, `admin/surveys/[id]/index.vue`, `admin/surveys/[id]/results.vue` — опросы: список / конструктор / результаты. Подробно — раздел «Опросы» ниже
- `admin/quest-dashboard.vue` — статистика разогревочной гонки Pit Stop (ФИО / заходил / кругов); админ в игру не заходит
- `profile` — личный профиль (пункт «Профиль» в меню и в режиме сотрудника, и в режиме админа)

---

## Банк идей

Продуктовые правила и этапы: **[PRODUCT.md](./PRODUCT.md)** §2.

Поток статусов (`IdeaStatus`):

```
review (На рассмотрении)
  ├─→ implementation (Реализация)
  │      └─→ done (Реализовано)  → учитывается в топ-авторах
  └─→ rejected (Отклонено)     → обязателен комментарий причины
```

| Кто | Что |
|-----|-----|
| Сотрудник | Создаёт идею → `review`; голосует; удаляет **свою**; получает уведомление (Vibe + Bitrix) при смене этапа |
| Admin / HR | `/admin/ideas`: смена этапа (модалка + комментарий), удаление любой |
| Система | После create — admin `idea_submitted`; после смены этапа — автору `idea_status_changed` + Bitrix |

Топ-авторы: только идеи со `status === 'done'`, подпись «N реализованных идей».

Данные: `server/data/ideas.json` (`ideas`, `nextIdeaId`, `votesByUserId`), вложения `server/data/idea-attachments/{ideaId}/`, очередь `mutateIdeas`. API: `GET/POST /api/ideas`, `GET/POST /api/ideas/:id/file`, `POST /api/ideas/:id/vote`, `PATCH /api/ideas/:id/status`, `DELETE /api/ideas/:id`. При деплое файл не перезаписывается, если уже есть на сервере (как `vacations.json`). Уведомления admin — `server/data/admin-notifications.json` (идемпотентность по ключу события, `admin_seen` не сбрасывается при повторном синке). На production демо-сид идей не подмешиваем; word-filter по «тест/qa» в ФИО не используем (`getDeployAppEnv` + `ideas/index.get`).

Legacy endpoints `POST /api/ideas/notify` и `POST /api/ideas/status-notify` остаются, но создание/статус шлют уведомления из server mutations.

---

## Опросы

Продуктовые правила: **[PRODUCT.md](./PRODUCT.md)** §10b. Phase 1 — MVP.

- **Типы данных**: `frontend/app/composables/useSurveys.ts` (`Survey`, `SurveyQuestion`, `SurveyResponse`, 9 `SurveyQuestionType`) — общий файл, используется и на клиенте, и на сервере (как `useIdeasBank.ts` для идей).
- **Данные**: `server/data/surveys.json` (`surveys[]`, `nextSurveyId`), `server/data/survey-responses.json` (`responses: Record<surveyId, SurveyResponse[]>`). Чтение/запись/мутации — `server/utils/surveysStore.ts`, `surveyResponsesStore.ts` (atomic JSON + очередь мутаций, тот же паттерн, что `ideasStore.ts`). Валидация ответа на сервере — `surveyValidation.ts` (обязательные поля, допустимые опции/диапазоны — клиенту не доверяем). Агрегация результатов — `surveyResults.ts` (воронка + распределения по вопросу). Rate-limit публичной отправки — `simpleRateLimit.ts` (in-memory по IP, 20/мин).
- **Admin API** (`requireRole(['admin','hr'])`): `GET/POST /api/surveys`, `GET/PATCH/DELETE /api/surveys/:id`, `POST /api/surveys/:id/publish`, `POST /api/surveys/:id/unpublish` (→ `closed`, не `draft` — опрос мог уже собирать ответы), `GET /api/surveys/:id/results`.
- **Публичные API** (без `requireVbiSession`): `GET /api/public/surveys/:slug` (только для `status: published`, отдаёт только `PublicSurvey` — без `id`/`createdBy`/статуса), `POST /api/public/surveys/:slug/submit`.
- **Анонимность**: если `survey.anonymous === true`, `submit.post.ts` вообще не вызывает `getVbiSession` для привязки — поле `respondent` не попадает в объект ответа ни при каких условиях. Для неанонимных опросов `respondent` подставляется только если у отправителя была валидная Vibe-сессия (анонимный посетитель с улицы в неанонимном опросе просто не имеет `respondent`).
- **Публичная страница** `/s/[slug]` (`app/pages/s/[slug].vue`) рендерится в обход app-shell — см. «Точка входа и оболочка» (`isBareRoute` в `app.vue`). Собственная нейтральная вёрстка (не брендированная), composable `useSurveyRespond.ts`.
- **Админ-страницы**: `admin/surveys/index.vue` (список), `admin/surveys/[id]/index.vue` (конструктор — редактирование вопросов, reorder, анонимность, публикация), `admin/surveys/[id]/results.vue` (воронка + графики/список ответов, по конвенциям skill `dataviz`). Пункт меню «Опросы» — `usePlatformContext.ts` (`adminNav`).
  - **Важно про роутинг**: `[id]/index.vue` + `[id]/results.vue` как папка — не `[id].vue` файл рядом с папкой `[id]/`. Nuxt не рендерит вложенные маршруты под файлом с тем же динамическим именем без `<NuxtPage />` в родителе — тестировано вживую, при коллизии `/admin/surveys/:id/results` молча рендерил контент `[id].vue`.

---

## Ключевые компоненты

| Компонент | Назначение |
|-----------|------------|
| `OrgChart.vue` | Оргсхема: readonly contain без скролла; при roster — `layoutCompressX` (только X); edit — drag/связи |
| `OrgUnitRosterAside.vue` | Правая панель: заголовок + скролл списка сотрудников |
| `OrgUnitFields.vue` | Поля отдела (название, руководитель из справочника) |
| `OrgConfirmDialog.vue` | Подтверждение удаления |
| `InlineField.vue` | Редактирование текста inline |
| `EmployeeVacationPanel.vue` | Кабинет сотрудника: заявки + календарь; `vac-year-chip` справа над календарём; годы `< primaryYear` — только просмотр |
| `ManagerVacationAside.vue` | Боковая панель руководителя |
| `VacationTeamCalendar.vue` | Команда на год |
| `VacationDetailedCalendar.vue` | Детальный календарь |
| `AuthLogin.vue` | Форма входа |
| `FirstLoginOnboarding.vue` | Первый вход: приветствие, выбор аватара, конфетти |
| `UserAvatar.vue` | Круглый аватар или инициалы |
| `AdaptationQuizForm.vue` | Прохождение теста, отправка на сервер |
| `AdaptationPhaseTimeline.vue` | Фазы трека, чеклист, CTA теста |

---

## Адаптация (Nitro API)

Серверные данные в `frontend/server/data/`:

| Файл | Содержимое |
|------|------------|
| `adaptation-track.json` | Шаблон трека и вопросы (с `correct` только на сервере) |
| `adaptation-state.json` | Попытки тестов и отметки шагов |
| `adaptation-scenarios.json` | Каталог сценариев адаптации (CRUD admin/HR) |
| `adaptation-assignments.json` | Назначения сценария сотруднику |
| `profile-activity.json` | Ручные/тестовые события «Недавняя активность» в профиле |
| `employees.json` | Справочник для привязки `platform_user_id` → ФИО |
| `employee-managers.json` | Назначения руководителей (overlay по `id`/ФИО); не перезаписывается импортом, деплоем и синком Bitrix |
| `admin-notifications.json` | Уведомления admin/hr о расхождениях ФИО/должности с Битрикс24 |

Cookie **`vbi-session`** (httpOnly) — при логине `POST /api/auth/session`.

| Endpoint | Назначение |
|----------|------------|
| `GET /api/adaptation/me` | Прогресс текущего пользователя |
| `GET /api/adaptation/scenarios` | Каталог сценариев + назначения (admin/HR) |
| `POST /api/adaptation/scenarios` | Создать сценарий |
| `PUT /api/adaptation/scenarios/:id` | Обновить сценарий |
| `DELETE /api/adaptation/scenarios/:id` | Удалить сценарий |
| `POST /api/adaptation/assign` | Назначить сценарий сотруднику |
| `POST /api/adaptation/attempts` | Сдача теста → запись для админа |
| `GET /api/adaptation/attempts` | Журнал (admin) или `?mine=1` |
| `PATCH /api/adaptation/attempts/:id/seen` | Админ отметил просмотр |
| `PATCH /api/adaptation/steps/:stepId` | Отметить шаг чеклиста |
| `GET /api/profile-activity` | Лента активности (`?employee_id` / `platform_user_id`) |
| `POST /api/profile-activity` | Ручная запись (admin/HR) |
| `DELETE /api/profile-activity/:id` | Удалить запись |

Клиент: `useAdaptation.ts`, `useProfileActivity.ts`.

### Справочник сотрудников (API)

| Endpoint | Назначение |
|----------|------------|
| `GET /api/employees` | Список (сессия) — источник для адаптации |
| `PUT /api/employees` | Сохранение справочника (admin/hr) |

Клиент: `useEmployees` — `localStorage` + синхронизация через `persist()` → `PUT`.

Сервер: `employeesStore.ts` + `employeeManagersStore.ts` — при чтении подмешивается `employee-managers.json`; при сохранении из админки overlay обновляется. Синк Bitrix (`writeEmployees` с `preserveManagers: true`) overlay не трогает.

Удаление из справочника: `writeEmployees` пишет denylist (`employeeAccessDenylist.ts` → `employee-access-denylist.json`, в `.gitignore`), сбрасывает сессию через проверку в `requireVbiSession` / `session.get`, блокирует `loginSessionFromBitrix` и демо-логин; `bitrixSync` и merge деплоя (`merge-employees-seed.mjs` + denylist) пропускают denylist-id; `readEmployees` не отдаёт их в список. Повторное добавление в справочник снимает отзыв. Каскад: VPN (панель + учёт), уведомления, адаптация, лента; аватар/отпуска — отложенный purge по `*_purge_at`.

### Заявки на отпуск (API)

| Endpoint | Назначение |
|----------|------------|
| `GET /api/vacations` | Полное состояние (`primaryYear`, `requestsByYear`, `nextRequestId`, `reservationsByYear`, `nextReservationId`) |
| `POST /api/vacations/requests` | Создать одну заявку (тело: `year`, `employee`, `start`, `end`, `comment?`) |
| `PATCH /api/vacations/requests/:id` | Изменить даты, статус, `approval_step` |
| `DELETE /api/vacations/requests/:id` | Удалить заявку |
| `POST /api/vacations/reservations` | Предварительная бронь: `year`, `month` (1–12), `durationDays`, `comment?` |
| `PATCH /api/vacations/reservation-caps` | Зарезервировано (лимиты фиксированы в коде: 5 на отдел, 1 в подгруппе); UI у руководителей убран |
| `DELETE /api/vacations/reservations/:id` | Удалить бронь (своя или admin) |

Сервер: `vacationsStore.ts` (`mutateVacations` — очередь правок), `vacationRequestMutations.ts`, `vacationReservationMutations.ts`; при финальном согласовании заявки — синк в Битрикс (`bitrixVacationAbsence.ts`). `PUT /api/vacations` отключён (410).

Клиент: `useVacations` — `GET` при входе, каждая правка через POST/PATCH/DELETE; `localStorage` `vbi-vacations-state-v6` — кэш (миграция с v5).

**Предварительная бронь** (`VacationReservation` в `vacationReservations.ts`): месяц + длительность без `start`/`end`; не влияет на баланс и approval; отображается полосатыми плашками; конвертация в заявку через «Уточнить даты» в `EmployeeVacationAside`.

**Лимиты броней** (`vacationReservationCaps.ts`, `vacationDepartmentGroups.ts`): для grouped-отделов (Digital) — пул на весь отдел (`digital-department`, по умолчанию 5 слотов/мес.) и не более 1 слота в месяц внутри подгруппы. Слот = бронь **или** заявка `pending`/`approved` на этот месяц. Проверка на `POST /api/vacations/reservations`, `POST/PATCH` заявок и в UI (`EmployeeYearCalendar` — серая `+бронь`; форма заявки). Демо QA — тот же механизм на localhost (`qa-department`).

**Пересечение отпусков групхедов** (`vacationGroupLeadOverlap.ts`): в Digital одновременно не более одного руководителя группы (type `lead` в `vacationDepartmentGroups`) в отпуске на пересекающиеся даты; проверка при создании/смене дат заявки и предупреждение в форме сотрудника. Админ системы (`session.role === 'admin'`) правило не блокирует (`vacationRequestMutations.ts`).

### Уведомления пользователей (отпуска)

| Endpoint | Назначение |
|----------|------------|
| `GET /api/notifications` | Уведомления текущего пользователя по отпускам |
| `POST /api/notifications/post-vacation-memo` | Памятка после отпуска (идемпотентно на заявку) |
| `DELETE /api/notifications/:id` | Закрыть (удалить) уведомление |
| `PATCH /api/notifications/:id/seen` | Прочитано |
| `PATCH /api/notifications/seen-all` | Прочитать все |

Типы: руководителю — `vacation_submitted`, `vacation_updated`, `vacation_deleted` (при правке/удалении — manager + director отдела); сотруднику — `vacation_approved`, `vacation_rejected`, `vacation_next_stage`; автору идеи — `idea_status_changed` (платформа + Bitrix при смене этапа); после «Позже» / «Прочитать» на памятке — `post_vacation_memo`.

Хранение: JSON или Postgres (см. «База данных → Этап 2»); до 100 уведомлений на получателя (FIFO); крестик в колокольчике → `hidden_from_bell` (запись остаётся на `/notifications`); `DELETE /api/notifications/:id` — полное удаление.

Параллельно в Битрикс (`bitrixVacationNotify.ts` / `ideaNotifications.ts`): только `im.notify.system.add` через OAuth (колокольчик от системы); без токена — не шлём. Личный чат (`im.message.add`) для согласования **не используется** (см. правило `bitrix-vacation-notify-no-chat`).

Клиент: `VacationNotificationsBell.vue` (режим сотрудника), `pages/notifications.vue`. Админские Bitrix-уведомления — отдельно (`AdminNotificationsBell`, `/admin/notifications`).

### Напоминания отпусков от чат-бота (cron)

Не путать с колокольчиком согласования. Бизнес-правила: **[PRODUCT.md §1.3.1](./PRODUCT.md)**; установка: **[BITRIX.md](./BITRIX.md)**.

| API | Назначение |
|-----|------------|
| `POST /api/cron/vacation-pre-reminders` | Сотруднику за 21 день до старта (`dry_run=1`) |
| `POST /api/cron/vacation-manager-month-reminders?outlook=current\|next` | Руководителю 1-го / 15-го (`force=1`, `as_of=YYYY-MM-DD`) |

| Файл | Роль |
|------|------|
| `vacationPreReminder.ts` / `vacationPreReminderStore.ts` | Текст + журнал `vacation-pre-reminders.json` |
| `vacationManagerMonthReminder.ts` / `…Store.ts` | Зоны руководителей + журнал `vacation-manager-month-reminders.json` |
| `bitrixImbot.ts` | `imbot.message.add` (OAuth → webhook fallback) |
| `deploy/systemd/vbi-hr-vacation-*.timer` | 12:00 МСК (сотрудник), 11:15 МСК 1-е/15-е (руководитель) |

Защита: заголовок `X-Cron-Token` = `VACATION_PRE_REMINDER_CRON_SECRET` / `CRON_SECRET`.

### Коды ChatGPT → Telegram (cron) и `/vpn`

IMAP → корпоративный Telegram и/или кнопка в помощнике `/vpn`. Общий util: `openaiChatgptMailCode.ts` (окно ~1 ч). Документация: **[CHATGPT-TELEGRAM.md](./CHATGPT-TELEGRAM.md)**.

| API | Назначение |
|-----|------------|
| `POST /api/vpn/chatgpt-code` | Список кодов за 15 мин + время МСК |
| `POST /api/cron/chatgpt-code-telegram` | Новые коды из почты → Telegram (`dry_run=1`) |

| Файл | Роль |
|------|------|
| `openaiChatgptMailCode.ts` | IMAP + парсинг |
| `chatgptCodeTelegram.ts` / `…State.ts` | Пайплайн + дедуп `chatgpt-code-telegram-state.json` |
| `telegramBot.ts` | Bot API `sendMessage` |
| `deploy/systemd/vbi-hr-chatgpt-code-telegram.timer` | каждые 2 мин |

Защита: `X-Cron-Token` = `CRON_SECRET`. Env: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` \| `TELEGRAM_CHANNEL_ID`, `EMAIL_*`.

Идеи: `GET/POST /api/ideas`, `POST /api/ideas/:id/vote`, `PATCH /api/ideas/:id/status`, `DELETE /api/ideas/:id` (очередь в `ideas.json`; notify встроен в mutations). Legacy: `POST /api/ideas/notify`, `POST /api/ideas/status-notify`.

### Аватары сотрудников (API)

| Endpoint | Назначение |
|----------|------------|
| `GET /api/avatars` | Все аватары `{ avatars: { [userId]: "character_01" } }` (сессия) |
| `PUT /api/avatars/me` | Сохранить свой аватар `{ characterId }` |

Сервер: `server/data/user-avatars.json`. Клиент: `useAvatars` + плагин `avatars.client.ts` (гидратация после входа). Локальный `vbi-user-avatars-v1` — кэш; при входе локальный аватар без записи на сервере подгружается автоматически.

### Уведомления администратора (Bitrix)

| Endpoint | Назначение |
|----------|------------|
| `GET /api/admin/notifications` | Список уведомлений, `unseen_count` |
| `PATCH /api/admin/notifications/:id/seen` | Отметить прочитанным |
| `PATCH /api/admin/notifications/seen-all` | Прочитать все |

Клиент: `useAdminNotifications.ts`, `AdminNotificationsBell.vue`, страница `/admin/notifications`.

Создание: `bitrixSync.ts` при расхождении `name`/`title` с Bitrix → `adminNotificationsStore.ts` (без авто-применения на платформе).

---


## Оргструктура (данные и UI)

Продуктовые правила (панель, матчинг, без скролла схемы): **[PRODUCT.md](./PRODUCT.md)** §8.

```ts
OrgExecutive   // id, title, person, order, x?, y?
OrgUnit        // отдел: executiveId, groupId?, name, head, width?, ...
OrgUnitGroup   // рамка: label, executiveId, x?, y?
OrgLink        // from/to ports + optional mid
```

| Слой | Файлы |
|------|--------|
| Данные | `server/data/org-structure.json`, API `GET/PUT /api/org-structure` (`orgStructureStore.ts`) |
| Клиент | `useOrgStructure.ts` — hydrate с сервера (предпочтительнее non-empty), кэш `vbi-org-structure-v1` |
| Readonly UI | `organization.vue` → `OrgChart` + `OrgUnitRosterAside` |
| Матчинг списка | `utils/orgUnitEmployees.ts` (`rosterSectionsForOrgUnitName`, `orgUnitOpensRoster`) |
| Секции Digital | те же defs, что отпуска: `DIGITAL_VACATION_GROUP_DEFS` (`vacationDepartmentGroups.ts`); ярлык **Группа Цхай** |
| Сжатие при панели | `OrgChart` prop `rosterOpen` → `layoutCompressX` (позиции/ширины по X; Y и `fitScale` эталон до панели) |
| Линии | `utils/orgLinkPath.ts` — почти вертикальные bottom→top без зигзага (`VERTICAL_X_SNAP_PX`) |
| Деплой | если `org-structure.json` уже на сервере — **не перезаписывать** (`deploy-remote.sh`) |

- `buildPlacedItems()` — порядок отрисовки: группы, затем solo-отделы.
- Readonly: `fitScale` = contain в viewport, `overflow: hidden` у `.org-chart-viewport` (сотрудник/превью).
- С панелью: viewport `align-items: flex-start`; aside `height: 100%`, список `.org-roster-aside__scroll` с `overflow-y: auto`.

---

## Отпуска

Продуктовые правила (формулы дней и баланса, этапы согласования, бронь): **[PRODUCT.md](./PRODUCT.md)** §1.

1. `useEmployees` — кто чей руководитель; `findByUserForAuth()` по `platform_user_id` или email.
2. `useVacations` — заявки, статусы, `canManagerApproveRequest()`, `formatMonthVacationRange()` (даты в месячной таблице: `DD.MM-DD.MM`).
3. `utils/vacationBalance.ts` — баланс ЗУП, аванс (`assessVacationBalance`), колонки **Отгулял** / **План** (`calcEmployeeBalance`: будущие согласованные → план, прошедшие/текущие → отгулял).
4. `utils/vacationCalendar.ts` — праздники РФ, `countVacationBillableDays` (праздники не входят в счёт).
5. Сид: `data/vacation-seed.json` (год, праздники, демо-заявки).

**UI-плашки (ITMO pill):** solid фон, белый жирный текст, без обводки. CSS-токены в `main.css`:

| Токен | Назначение | Цвет |
|-------|------------|------|
| `--vac-pill-approved-bg` | Согласован (таблица, «Мои заявки») | `#388073` |
| `--vac-pill-pending-bg` | На согласовании (месячная таблица) | `#d4a03a` |
| `--vac-pill-overlap-bg` | Пересечение отпусков | `#efc038` |
| `--vac-pill-advance-bg` | Аванс | `#e186a9` |
| `--vac-pill-rejected-bg` | Отклонён | `#c44b5a` |

Классы: `.vac-block` (месячный календарь), `.vac-overlap-badge`, `.vac-advance-badge`, `.emp-request-meta .pill`. Popover пересечений и аванса — Teleport + ромбик `::before`.

**Режимы UI на `/vacations`:** сотрудник — `EmployeeVacationPanel` + `EmployeeVacationAside`. У сотрудников с командным календарём — вкладки «Мой календарь / Общий» (`VacationCalendarScopeToggle`, `useEmployeeVacationTeamView`, `vacationTeamScope.ts`); «Общий» — `VacationTeamCalendar` variant `employee-team` (в т.ч. весь отдел DEV для сотрудников без права согласования). Руководитель/HR — `ManagerVacationAside`: переключатель «Режим» (slide toggle) всегда сверху; в режиме «Сотрудник» под ним тот же `EmployeeVacationAside`, что у сотрудника; в режиме «Руководитель» — статистика команды и блок обучалки `ManagerVacationTrainingPrompt` под «Заявки».

**Обучалки отпусков:** сотрудник — `useVacationTraining` + `VacationTrainingPrompt/Overlay`; руководитель — `useManagerVacationTraining` + `ManagerVacationTrainingPrompt/Overlay`. Для роли руководителя ачивка «Календарь отпусков» выдаётся только после завершения обоих квестов.

Референс бизнес-логики: `_vacation_source/График отпусков/`.

### Учётный год и переход 31.12 → 01.01

| Поле | Назначение |
|------|------------|
| `vacations.primaryYear` | Учётный год ЗУП: база `vacation_opening_balance` — остаток на 1 января этого года |
| `viewYear` (UI) | Год календаря и бакета `requestsByYear`. У сотрудника годы раньше `primaryYear` — read-only. **Не** влияет на формулу баланса и таблицу «Отгулял / план» (aside всегда `primaryYear`) |
| `employee.vacation_opening_balance` | Остаток на 01.01 `primaryYear` (из Excel или после rollover) |

**Переход на новый год:** остаток на 31.12.N (`calcAvailableOnDate` с учётом всех заявок до конца года) записывается в `vacation_opening_balance` каждого сотрудника; `primaryYear` → N+1.

- Код: `server/utils/vacationYearRollover.ts`
- CLI (из корня репозитория): `node scripts/rollover-vacation-year.mjs 2026 2027`
- API: `POST /api/admin/vacations/rollover` `{ fromYear, toYear }` (admin/hr)

---

## localStorage

| Ключ | Composable / модуль |
|------|---------------------|
| `vbi-auth-session` | `useAuth` |
| `vbi-welcomed-users` | `useAuth` (IDs, завершивших онбординг) |
| `vbi-user-avatars-v1` | `useAvatars` — локальный кэш; источник правды `server/data/user-avatars.json`, API `/api/avatars` |
| `vbi-platform-demo-version` | `vbi-demo-data.client.ts` (сейчас `4`) |
| `vbi-employees-v3` | `useEmployees` |
| `vbi-vacations-state-v6` | `useVacations` (заявки + предварительные брони; миграция с v5) |
| `vbi-employee-vac-calendar-scope-v1` | `useEmployeeVacationTeamView` — «Мой календарь» / «Общий» |
| `vbi-vac-show-title-col-v1` | `VacationTeamCalendar` — показать столбец «Должность» (`1`/`0`) |
| `vbi-org-structure-v1` | `useOrgStructure` — локальный кэш; источник правды `server/data/org-structure.json`, API `/api/org-structure` |
| `vbi-tasks-state` | `useTasks` |
| `vbi-wallet-state-v1` | `useWallet` — транзакции валюты (в т.ч. юбилеи стажа `tenure-milestone-{userId}-{N}y`) |
| `vbi-kb-ai-chat-v1` | `useKnowledgeAiChat` — диалог ИИ базы знаний, TTL 24 ч |
| `vbi-kb-page-rating-v1` | оценка удобства `/knowledge` (один раз на браузер) |

Идеи: сервер `server/data/ideas.json` (не localStorage). Устаревшие ключи `vbi-ideas-bank-v2` / `vbi-ideas-votes-v1-*` больше не используются.

Оргструктура: сервер `server/data/org-structure.json` (`GET` — авторизованные, `PUT` — admin/hr). `localStorage` — кэш + одноразовая миграция, если сервер пуст.

Устаревшие ключи сбрасываются при смене `DEMO_PLATFORM_VERSION` (см. `LEGACY_STORAGE_KEYS` в плагине).

**Юбилеи стажа:** при `bootstrapAppData` — `applyTenureMilestoneRewards()` (5/10/15/20 лет по `hired_at`). Суммы: `TENURE_MILESTONE_AMOUNTS` в `utils/tenureMilestones.ts` (`null` = ещё не задано).

---

## Стили

- Единый файл: `app/assets/main.css` (~15 000 строк).
- Токены: neo-brutalist light UI (`--page-bg`, `--border-brutal`), фиолетовый topbar (`--hero-purple`), лайм (`--accent-lime`), vacation-pill (см. раздел «Отпуска»).

Подключение: `nuxt.config.ts` → `css: ['~/assets/main.css']`.

---

## Сборка и запуск

```
npm run build  →  frontend/.output/server/index.mjs
NITRO_PORT=3300 NITRO_HOST=127.0.0.1 node .output/server/index.mjs
```

`Open Frontend.command` (macOS) освобождает порты 3000/3300, собирает и открывает браузер. На Windows — `cd frontend && npm run dev`.

---

## Backend

Вся серверная логика (сессия, Bitrix, отпуска, идеи, адаптация) — в Nitro (`frontend/server/`). Отдельной папки `backend/` в репозитории нет.

---

## База данных (миграция с JSON)

Сегодня все данные — плоские JSON в `frontend/server/data/` (~23 самописных `*Store.ts`). Утверждено: переезд на **PostgreSQL** (тот же VPS, базы `vbi_prod` / `vbi_staging`, локально `vbi_dev`) через **Drizzle ORM** (`drizzle-orm` + драйвер `postgres`), по фазам. Пока стенд без `DATABASE_URL` — всё работает на JSON, DB-код не запускается.

### Что есть сейчас (фаза 1 — фундамент)

| Файл | Назначение |
|------|------------|
| `server/db/client.ts` | `getDb()` — ленивый singleton (postgres.js + drizzle), `null` без `DATABASE_URL`; `isDbEnabled()`, `getSql()`, `disableDb()`. URL фиксируется при загрузке модуля (до `load-bitrix-env`); стенд-гард: staging ≠ `vbi_prod`, production ≠ `vbi_staging`. |
| `server/db/schema/` | Таблицы Drizzle, `index.ts` реэкспортирует домены. Сейчас одна: `audit.audit_log` (`id bigserial`, `at timestamptz default now()`, `actor_employee_id int null`, `action`, `entity`, `entity_id`, `before jsonb`, `after jsonb`) — пока никто не пишет. |
| `server/db/migrations/` | SQL от `drizzle-kit generate` (коммитим). `drizzle.config.ts` в `frontend/`. |
| `server/db/migrate.ts` + `server/plugins/db-migrate.ts` | При старте: отдельное соединение, `pg_advisory_lock`, drizzle `migrate()`, одна строка `[db] migrations ok applied=N`. Ошибка → лог + `disableDb()`, процесс и JSON-функции живут. |
| `server/api/admin/db-health.get.ts` | `GET /api/admin/db-health` (admin): `{enabled, ok, latencyMs, migrations, domains}`; `domains.notifications` = `postgres` или `json` (где сейчас живут уведомления). |
| `server/db/audit.ts` | `writeAudit(tx, …)` — запись в `audit.audit_log` в той же транзакции, что и мутация. |

Миграции в артефакте: хук `nitro:init → compiled` в `nuxt.config.ts` копирует `server/db/migrations` → `.output/server/db/migrations` (не `serverAssets` — бандл Nitro не растёт). Поиск папки: `DB_MIGRATIONS_DIR` → `<dirname(index.mjs)>/db/migrations` → `cwd/.output/server/db/migrations` → `cwd/server/db/migrations` (dev).

### Этап 2 — домен `notifications` (пилот, только стейдж)

Переключатель один: **`DB_NOTIFICATIONS=1` и задан `DATABASE_URL`** → уведомления пользователей в Postgres, иначе в JSON (`server/data/user-notifications.json`). На проде `DATABASE_URL` есть, но флага нет — прод на JSON и после попадания кода в `main`. Флаг стоит только в `/etc/vbi-hr/bitrix.env` (источник `.env` стейджа при каждом деплое).

| Файл | Назначение |
|------|------------|
| `server/db/schema/notifications.ts` | `notifications.user_notifications` и `notifications.json_imports`; миграция `0001_notifications.sql`. |
| `server/utils/userNotificationsStore.ts` | Фасад с прежним API (`listUserNotifications`, `createUserNotification`, …): выбирает хранилище, вызывающий код не менялся. |
| `server/notifications/jsonStore.ts` | JSON-реализация (прежняя логика + очередь мутаций `createMutationQueue`). |
| `server/db/repositories/userNotifications.ts` | Postgres-реализация того же интерфейса `UserNotificationsRepo` (`server/notifications/types.ts`). |
| `server/notifications/rowMapping.ts` | JSON ↔ строка БД без потерь: неизвестные поля и даты не формата `YYYY-MM-DD` — в `extra jsonb`. |
| `server/notifications/importJson.ts` | Разовый импорт JSON → БД при старте. |

Таблица `user_notifications`: `id uuid` (тот же, что в JSON), `kind`, `recipient_user_id int` (тот же id, что `session.id`: `bitrix_user_id`, иначе platform id; FK появится с `core.employees`), `vacation_request_id`, `employee_name` (снимок подписи «о ком», не ключ), `start_date`/`end_date date`, `stage_label`, `idea_id`, `idea_title`, `status_comment`, `created_at`, `seen` + `seen_at`, `hidden_from_bell` + `hidden_at` (время прочтения/скрытия пишется с момента переезда; у импортированных — `null`, не выдумываем), `extra jsonb`. Индексы: `(recipient_user_id, created_at desc)`, частичный по непрочитанным для колокольчика, `(kind, vacation_request_id)`. Лимит 100 на получателя — как в JSON (лишние удаляются в той же транзакции).

Старт процесса: миграции → если флаг, импорт под `pg_advisory_xact_lock`: строки `on conflict (id) do nothing`, проверка «все id из файла есть в базе», маркер в `json_imports` (повторный старт импорт пропускает — удалённые в базе уведомления не воскресают). Лог: `[db] notifications: импорт из JSON file=N inserted=N existing=N skipped=N verified=N`. Пока импорт не закончился, запросы уведомлений ждут; если миграции/импорт упали — фасад работает на JSON и пишет ошибку в журнал.

JSON-файл не удаляется — это бэкап на момент переезда. После переезда в него больше не пишут: откат (снять флаг) вернёт уведомления на состояние момента импорта.

Аудит (`audit.audit_log`, `entity = notifications.user_notification`): `create`, `delete`, `trim` (лимит 100), `delete_for_recipients` (офбординг), `import_json`. Прочтение/скрытие не аудируются — для них `seen_at`/`hidden_at`.

### Целевая модель

**Postgres-схема на домен** (`pgSchema`):

| Схема | Что переедет |
|-------|--------------|
| `core` | сотрудники, оргструктура, руководители, аватары, доступы/denylist |
| `vacations` | заявки, брони, лимиты, правила групп, учётные годы, напоминания |
| `integrations` | **outbox** для Bitrix (синк отсутствий, `im.notify`), OAuth-токены сервиса |
| `notifications` | пользовательские и админские уведомления |
| `knowledge` | статьи БЗ, оценки, RAG-индекс (+ `pgvector` позже) |
| `ideas` | банк идей, вложения, мутации |
| `engagement` | ачивки, пит-стоп/гонка, лучшие продажи, активность профиля |
| `surveys` | опросы, визиты/старты; **таблица анонимных ответов без колонки `employee_id`** |
| `vpn` | VPN-ключи и лимиты |
| `audit` | `audit_log` (уже есть) |

**Принципы**: ссылки на сотрудника — `employee_id`, не ФИО; правила (лимиты, исключения групп вроде Цхай) — данными в таблицах, не константами в коде; история изменений — отдельные history-таблицы; внешние вызовы (Bitrix) — через outbox с ретраями, а не прямо из запроса; все мутации — в `audit.audit_log`.

**Фазы**: 1 — фундамент (этот шаг: клиент, миграции, health, тесты в CI, бэкапы); 2 — пилот `notifications`; 3 — `core` (сотрудники/оргструктура); 4 — `vacations` + Bitrix outbox; 5 — остальные домены. В конце живые данные уходят из git (`server/data/*.json` перестают быть источником правды и сидом деплоя).

### Тесты

`npm test` (vitest, `frontend/vitest.config.ts`, node, алиас `~` → `app/`) — юнит-тесты чистых функций в `frontend/tests/unit/`. В CI отдельная стадия `test` перед `build`: красный тест блокирует сборку и деплой.

Тесты с базой (`tests/unit/userNotificationsRepo.test.ts`, блок «Postgres»): только при `TEST_DATABASE_URL`, локально `TEST_DATABASE_URL=postgres://localhost:5432/vbi_dev npm test`. В CI базы нет — блок пропускается, контракт хранилища проверяется на JSON-реализации.

---

## Известные ограничения

- На **production** вход только через Bitrix OAuth для людей из справочника; демо-логин API отключён. Локально/staging — Bitrix + демо-аккаунты.
- Cookie-сессия подписана HMAC (`VBI_SESSION_SECRET`), TTL 8ч со sliding.
- Роль `hr` в auth есть; UI в основном `employee` / `admin` + manager для отпусков.
- `useMockData` и `useTasks` частично дублируют типы с `useWallet` (warning Nuxt duplicated imports — не критично).