# Changelog

Формат: кратко по датам. При каждой заметной фиче добавляйте запись сверху.

## 2025-06-17

### Hotfix CI: сборка без QA seed (production)

- Добавлены `app/data/qaTestDepartment.ts` и `app/data/departments.ts` как безопасные дефолты для production-сборки.
- Убрана зависимость сборки от локальных QA/demo-файлов: imports в `useAuth`, `useEmployees`, `vacationApproval`, `server/utils/credentials`, `server/utils/employeesStore` теперь резолвятся в репозитории.
- Проверка: `NUXT_PUBLIC_APP_ENV=production NUXT_PUBLIC_LAUNCH_SCOPE=vacations npm run build` проходит локально.

### Квест-обучение: шаги 3 и 6, финальная награда (localhost)

- Шаг 3 (календарь) и шаг 6 (мои заявки): только светлая подсветка, без PNG-обводки.
- Шаг 6: новый текст, плашки статусов в строку, ачивка «Проводник отпусков», кнопка «Забрать награду».
- Пути: `vacationTrainingQuest.ts`, `VacationTrainingOverlay.vue`, `main.css`.
- Проверка: localhost → отпуска → квест до шага 6.

### Квест-обучение: шаг про расчёт к дате, слои и подсветка (localhost)

- Новый шаг 2 «Расчёт к дате» (`data-tour="vac-projection"`) — блок «Рассчитать доступные дни к дате»; квест теперь 6 шагов.
- Подсветка только целевого блока (баланс / расчёт), не всей боковой панели; карточка квеста слева от aside, поверх интерфейса.
- Пути: `vacationTrainingQuest.ts`, `VacationTrainingOverlay.vue`, `EmployeeVacationAside.vue`, `main.css`.
- Проверка: localhost → отпуска → квест, шаги 1–2.

### Квест-обучение: шаг 1 — подсветка баланса и обводка цифр (localhost)

- Карточка «Доступно дней отпуска» подсвечивается как календарь на шаге 2; розовый овал «от руки» только вокруг цифры.
- Пути: `VacationTrainingOverlay.vue`, `vacationTrainingMarkerAssets.ts`, `vacationTrainingQuest.ts`, `main.css`.
- Проверка: localhost → отпуска → квест, шаг 1.

### Квест-обучение: правки UI (localhost)

- Шаг 3 (заявка): подчёркивание только под строкой тулбара (заголовок → кнопка), анимация рисования линии через SVG `stroke-dashoffset` (~1.1s).
- Шаг 4 (предупреждения): уточнён текст плашки «Не хватает дней».
- Шаг 5 (мои заявки): карточка квеста слева от aside, без перекрытия блока заявок.
- Пути: `VacationTrainingOverlay.vue`, `vacationTrainingMarkerAssets.ts`, `vacationTrainingQuest.ts`, `main.css`.
- Проверка: localhost → отпуска → пройти квест до шагов 3–5.

- На localhost демо-вход снова виден при настроенном Bitrix OAuth (`AuthLogin.vue`: «или демо-доступ»).

- Календарь отпусков руководителя: видны все подчинённые по цепочке `manager` (директор — и тимлиды, и их сотрудники). `allReports` в `useEmployees.ts`.
- Исправлено: тимлид мог повторно «согласовать» заявку на шаге директора и финально одобрить её.
- После согласования тимлидом заявка остаётся в списке с серой плашкой следующего этапа (без кнопок).
- Пути: `app/utils/vacationApproval.ts`, `pages/vacations.vue`.

- Квест-обучение: шаг 2 — карточка в колонке aside; «назад» на интерактивных шагах; шаг 3 — подчёркивание; шаг 4 — цветные плашки и текст про дефицит на дату начала.
- Квест-обучение по отпускам на **production выключен** (`NUXT_PUBLIC_APP_ENV=production` → `vacationTrainingEnabled: false`). Localhost — по-прежнему доступен.
- Дефицит дней при авансе отпуска округляется до десятых (`vacationBalance.ts`).

### QA: отдел «Тестировщики» (только localhost)

- Тестовая цепочка согласования отпусков в 2 шага: тимлид → директор (как Digital).
- Демо-аккаунты: `masha@vbi.local` (Ксюша), `kostya@vbi.local` (Виталий), `katya@vbi.local` (Даша).
- Включается при `NODE_ENV=development` или `NUXT_PUBLIC_QA_TEST_DEPARTMENT=1`; на production — `0` или не задавать.
- Сотрудники не пишутся в `employees.json` (id 9001–9003, подмешиваются при чтении API).
- Пути: `app/data/qaTestDepartment.ts`, `app/utils/vacationApproval.ts`, `server/utils/employeesStore.ts`.
- Проверка: localhost → войти как Катя → заявка → Костя → согласовать → Маша → согласовать.

### Отпуска: двухэтапное согласование Digital

- Digital-сотрудники с руководителем группы (Попов, Лунин, Цхай, Носков): шаг 1 — прямой руководитель, шаг 2 — Digital Director (Ревзина Ксения).
- Остальные Digital — сразу на согласование Ксении; вне Digital — один шаг у прямого руководителя.
- Поле заявки: `approval_step` (`manager` | `director`), localStorage `vbi-vacations-state-v5`.
- Пути: `app/utils/vacationApproval.ts`, `composables/useVacations.ts`, `pages/vacations.vue`.
- Проверка: заявка от сотрудника Digital под Цхаем → у Цхая в «Согласовании» → после одобрения у Ревзиной → статус «Согласован».

### Админ: уведомления о расхождениях с Bitrix на production

- Исправлено: при синке сотрудников сотрудники из справочника, отсутствующие в bulk-ответе `user.get` (`keptRosterOnly`), не сравнивались с Bitrix — уведомления о расхождении ФИО/должности не создавались (на localhost OAuth без вебхука bulk обычно полный).
- После bulk-запроса для каждого такого сотрудника — индивидуальный `user.get` по `bitrix_user_id`; та же логика `upsertBitrixFieldNotification`.
- `POST /api/bitrix/sync-employees` без валидного вебхука: понятная ошибка 503 с подсказкой войти через Bitrix (OAuth-синк при входе).
- Пути: `server/utils/bitrixSync.ts`, `server/api/bitrix/sync-employees.post.ts`.
- Проверка: на prod перелогиниться админом через Bitrix → колокольчик → уведомление о расхождении должности (например Потапов).

### Отпуска: квест-обучение (этап 1, сотрудник)

- Обводка квеста: PNG-маркер (`public/images/vacation-training/marker-ring-*.png`) вместо SVG; подбор по пропорциям блока, анимация появления.
- Учебные заявки в памяти (`useVacationTraining.ts`) — не сохраняются и не попадают руководителю.
- Завершение: +15 монет в кошелёк, конфетти. Ключ localStorage: `vbi-vacation-training-v1` (`completed` / `skipped` по `userId`).
- Проверка: localhost → `/vacations` → очистить `vbi-vacation-training-v1` → «Начать квест» → пройти 5 шагов.

### Онбординг: первый вход в режиме vacations

- Исправлено: `FirstLoginOnboarding` не показывался на production (`NUXT_PUBLIC_LAUNCH_SCOPE=vacations`) из‑за условия `!isVacationsOnly` в `app.vue`.
- Конфетти один раз — только после «Начать работу» на шаге выбора аватара.
- Проверка: `NUXT_PUBLIC_LAUNCH_SCOPE=vacations` в `.env`, очистить `vbi-welcomed-users` и `vbi-user-avatars-v1` в localStorage, войти новым пользователем — приветствие, аватар, конфетти на финальной кнопке.

### Данные: синхронизация production → репозиторий

- С prod скачаны актуальные `employees.json` (70) и `vacations.json`.
- Скрипт для повтора: `bash scripts/pull-prod-data.sh` (ключ `~/.ssh/vbi_hr_deploy`).
- На prod: убрана «Шашина Юлия», добавлен «Решетов Виктор», руководители/отделы из админки.

### Деплой: production как рабочее пространство (данные не затираются)

- `merge-employees-seed.mjs` — при выкладке: сотрудники с сервера сохраняются; новые из репозитория добавляются; при совпадении `id` побеждают поля с сервера; руководители — из overlay.
- `vacations.json` на сервере при деплое **не перезаписывается** (заявки и `primaryYear` с production).
- Проверка: добавить сотрудника в `/admin/employees` на prod → деплой → запись на месте.

### Отпуска: переход на новый учётный год

- Правило: остаток на **31.12.N** → `vacation_opening_balance` на **01.01.N+1**; `vacations.primaryYear` = N+1.
- Логика: `server/utils/vacationYearRollover.ts` (`calcAvailableOnDate` на 31.12).
- CLI: `node scripts/rollover-vacation-year.mjs 2026 2027` (из каталога `frontend/`).
- API (admin/hr): `POST /api/admin/vacations/rollover` body `{ "fromYear": 2026, "toYear": 2027 }`.
- UI: все расчёты баланса используют `primaryYear` (учётный год), `viewYear` — только календарь и заявки.
- Проверка: до перехода `primaryYear: 2026`; после rollover — новые `vacation_opening_balance`, `primaryYear: 2027`.

### Справочник: канонические отделы (8)

- Фиксированный список в `frontend/app/data/departments.ts`: DEV, Digital, SEO / ORM, Бухгалтерия, Внутренние проекты, Маркетинг, Дирекция, Отдел продаж.
- В `employees.json` 27 записей переведены со старых названий (Отдел разработки → DEV, SEO/ORM/аккаунтинг → SEO / ORM, Руководство → Дирекция и т.д.).
- Выпадающий список в `/admin/employees` — только эти 8 отделов.
- Проверка: админка → колонка «Отдел» → 8 пунктов; у сотрудников новые названия после перезагрузки.

### UI: таблица сотрудников в админке

- `/admin/employees` — компактная таблица: ФИО и должность в двухстрочных полях, отдел и руководитель — выпадающие списки, дата приёма без иконки календаря.
- Убран столбец «Email / аккаунт»; кнопка «Удалить» заменена на иконку корзины (краснеет при наведении).
- Стили: `personnel-table` в `main.css` — фиксированная сетка, перенос текста в ячейках.
- Проверка: `/admin/employees` на production — таблица читается без горизонтального скролла на широком экране.

### Уведомления админу: изменения ФИО и должности из Битрикс24

- При синке сотрудников (`bitrixSync.ts`, вход через OAuth, `POST /api/bitrix/sync-employees`) сравниваются ФИО и должность в справочнике платформы с данными Bitrix.
- Если значения различаются — создаётся уведомление в `server/data/admin-notifications.json`; на платформу изменения **не** применяются автоматически.
- UI: колокольчик в шапке (режим администратора), страница `/admin/notifications`, пункт меню «Уведомления»; composable `useAdminNotifications.ts`.
- API: `GET /api/admin/notifications`, `PATCH /api/admin/notifications/:id/seen`, `PATCH /api/admin/notifications/seen-all` (роли admin/hr).
- Синк Bitrix пишет справочник с `preserveManagers: true` — overlay `employee-managers.json` не перезаписывается.
- Проверка: изменить ФИО сотрудника в Битрикс → войти на платформу или вызвать sync-employees → в колокольчике появится уведомление; руководители в `/admin/employees` без изменений.

### Админка: руководитель только из списка

- `/admin/employees` — колонка «Руководитель» снова `<select>`: только руководители подразделений (роль manager/admin/hr и те, кто уже назначен руководителем в справочнике).
- Свободный ввод отключён — значение должно совпасть со списком, иначе не сохранится (согласование отпусков по точному ФИО).
- Массовая вставка из Excel: строки сопоставляются со списком; несовпадения пропускаются с сообщением.
- Проверка: выбрать руководителя из списка → «Сохранено»; заявка на отпуск уходит выбранному руководителю.

### Админка: вставка и сохранение сотрудников на сервере

- Текстовые поля и даты сохраняются по `@input` (debounce 400 мс) и `@blur`; статус «Сохранение…» / «Сохранено» / «Ошибка».
- `useEmployees.ts` — `syncToServer` возвращает результат, не глотает ошибки; загрузка с сервера блокирует таблицу.

### Сохранение руководителей при импорте и деплое

- Руководители больше не сбрасываются при выкладке и импорте Excel: отдельный файл `server/data/employee-managers.json` (overlay по `id` и ФИО).
- `employeesStore.ts` — чтение/запись справочника подмешивает overlay; `PUT /api/employees` обновляет overlay.
- `deploy/scripts/deploy-remote.sh` — при обновлении `employees.json` на сервере merge через `merge-employees-seed.mjs` (поля из репо, руководители с сервера).
- `scripts/import-vacations-from-xlsx.py` — после импорта восстанавливает `manager` из снимка и overlay.
- Проверка: в админке задать руководителей → деплой staging → в `/admin/employees` руководители те же; повторный `import-vacations-from-xlsx.py` не меняет колонку «Руководитель».

### Данные: пересверка дат трудоустройства из Excel

- Повторный импорт `scripts/import-vacations-from-xlsx.py` из «График отпусков (HR)» — **66+** `hired_at` и `vacation_opening_balance` приведены к кол. D/E листа 2026.
- Драго Станислава: `hired_at` **2023-11-20** (было ошибочно 2023-11-09 — дата Лаврова).
- Сопоставление ФИО: нормализация `ё`→`е` в импорте; вручную — Малкова Наталия (`2025-09-15`).
- Деплой: `employees.json` и `vacations.json` копируются на сервер вместе с `adaptation-track.json`.
- Проверка: `python3 scripts/import-vacations-from-xlsx.py ~/Downloads/График\ отпусков\ \(HR\)\ \ \(1\).xlsx` → перелогин / очистить `vbi-employees-v5` в localStorage.

### Исправление: прогноз отпуска «к дате»

- `EmployeeVacationAside.vue` — в `calcAvailableOnDate` передаётся `vacation_opening_balance`; раньше считалось полное ZUP-начисление с даты приёма (завышение, напр. 57,6 вместо ~16,5).
- Проверка: «Рассчитать доступные дни к дате» → дата рядом с сегодня → число близко к плашке «доступно дней».

### Production: пилот «только график отпусков»

- На бое `NUXT_PUBLIC_LAUNCH_SCOPE=vacations` — все пункты меню видны, но недоступные разделы бледные, без клика, с замочком справа (как закрытые этапы адаптации).
- Открыты: `/vacations` (сотрудник); `/admin/vacations` + `/admin/employees` (админ). Остальные URL редиректятся на график отпусков.
- График отпусков на широких мониторах растягивается на всю рабочую область (убран фикс 1200×638), календарь 4×3 масштабируется по ширине/высоте.
- Staging и локально по-прежнему `full`. Файлы: `app.vue`, `usePlatformContext.ts`, `main.css`.

### Аналитика: Яндекс Метрика (SPA)

- Счётчик **110244372** в `<head>` (`nuxt.config.ts`, `utils/yandexMetrika.ts`) — ранняя загрузка, `ssr`, Вебвизор, clickmap.
- Плагин `yandex-metrika.client.ts` — `hit` при смене маршрута (`defer: true`).
- Env (опционально): `NUXT_PUBLIC_YANDEX_METRIKA_ID`.
- nginx: `frame-ancestors` для `metrika.yandex.*` / `webvisor.com` — карта кликов и Вебвизор в iframe (`deploy/nginx/vbi-hr*.conf.example`).
- Проверка: открыть сайт → Метрика → «Проверка счётчика»; карта кликов через 1–2 дня сбора.

### UI: отпуска — «Не хватает» вместо «Аванс»

- В плашке при создании заявки, в очереди согласования и в «Мои заявки» подпись **«Не хватает N дн.»** вместо «Аванс».
- Файлы: `EmployeeVacationPanel.vue`, `EmployeeVacationAside.vue`, `VacAdvancePopover.vue`.

### Интеграция: согласованный отпуск → график отсутствий Битрикс24

- После финального согласования заявки сервер создаёт отсутствие «отпуск ежегодный» в Битриксе (пальма на датах).
- Основной путь: `lists.element.add` в инфоблок графика отсутствий; запасной: `calendar.event.add` с `accessibility: absent`.
- Env: `BITRIX_ABSENCE_IBLOCK_ID`, `BITRIX_WEBHOOK_URL` с правами lists + calendar.
- Файлы: `server/utils/bitrixVacationAbsence.ts`, `PUT /api/vacations`; в заявке — `bitrix_sync_status`, тег «Битрикс ✓» в «Мои заявки».
- Проверка: согласовать отпуск → тег «Битрикс ✓» → пальма в `crm.vbi.ru`.

### HR-тест знаний + радар компетенций на оценке

- Задача «Тест на оценку HR-знаний» в разделе «Задачи» (`task_kind: hr_knowledge_quiz`, id `9001`).
- 8 блоков вопросов = 8 компетенций матрицы; баллы блока → столбец «Тест» и радар 1–10 на фиолетовой плашке справа (`/profile/assessment`).
- Маршрут прохождения: `/tasks/hr-assessment`; результаты в `localStorage` ключ `vbi-hr-test-results-v1`.
- Файлы: `data/hrKnowledgeTest.ts`, `composables/useHrKnowledgeTest.ts`, `components/CompetencyRadarChart.vue`, `components/HrKnowledgeQuiz.vue`.
- Проверка: Задачи → «Взять и пройти» → отправить ответы → Профиль → Оценка (матрица + радар).
- Fix: `pages/tasks.vue` перенесён в `pages/tasks/index.vue` — иначе `/tasks/hr-assessment` не открывался (конфликт nested routes в Nuxt).
- Вопросы переписаны под VBI: 24 ситуационных кейса (3 на блок), digital-агентство 69 чел., удалёнка, офис Москва (`hr-knowledge-v3`, дистракторы — правдоподобные HR-решения).

### UI: профиль — убрана дублирующая sub-nav

- Удалены вкладки «Обзор / Оценка / Развитие · ИПР» сверху; навигация — карточки на `/profile` и ссылки внутри страниц.

### Прототип: Оценка и ИПР в профиле (шаблон HR)

- Раздел профиля: `/profile` (обзор), `/profile/assessment` (матрица компетенций), `/profile/development` (ИПР).
- Mock-данные HR-роли: грейды Junior/Middle/Senior, 8 компетенций, цели и активности 70-20-10.
- Файлы: `pages/profile/*`, `composables/useHrDevelopment.ts`, `components/CompetencyLevelBadge.vue`.
- Проверка: localhost:3000 → Профиль → карточки «Матрица компетенций» / «ИПР».

### Deploy: оргструктура на бой — визуал без связей

- На production: фиолетовые плашки директоров (ITMO-геометрия), обновлённый дизайн блоков отделов.
- Связи между блоками (порты, линии) на бое **выключены** (`NUXT_PUBLIC_ORG_LINKS_ENABLED=false`); на staging :8080 остаются.
- Проверка: http://45.12.74.25/organization и `/admin/organization` — цветные директора, без точек-портов.

### Ops: справочник сотрудников — localhost → бой и тест

- Залит локальный `frontend/server/data/employees.json` (70 сотрудников) на `45.12.74.25` в `/var/www/vbi-hr` и `/var/www/vbi-hr-staging`.
- Бэкапы прежних файлов: `employees.json.bak-localhost-<timestamp>`.
- Проверка: http://45.12.74.25 и :8080 → Админка → Сотрудники.

### Ops: справочник сотрудников (руководители) — staging → бой

- Скопирован `server/data/employees.json` с `:8080` на порт `80` (`/var/www/vbi-hr-staging` → `/var/www/vbi-hr`), сервис `vbi-hr` перезапущен.
- На бое бэкап прежнего файла: `employees.json.bak-<timestamp>` в `server/data/`.
- Проверка: http://45.12.74.25 → Админка → Сотрудники — руководители как на тесте.

### Fix: оргструктура — связи не рисовались (падение SVG-пути)

- `orgLinkPath.ts` — защита от нулевых сегментов в `roundedPolylinePath` (краш `toFixed` при старте линии из порта).
- `OrgChart.vue` — жест связи через `window` (`mousemove`/`mouseup`), без `setPointerCapture`; черновик линии только после движения курсора.
- `OrgNodePorts.vue` — `mousedown` + `pointerdown` на портах.
- Проверка: `/admin/organization` → зажать порт → потянуть ко второму → отпустить; или клик-клик по двум портам.

### Fix: оргструктура — нельзя было начать рисовать связь от порта

- `OrgChart.vue` — при `pointerup` без целевого порта черновик больше не отменяется сразу (отмена на том же порту ломала drag и click-click).
- Проверка: `/admin/organization` → зажать порт → потянуть к другому → отпустить; или клик на первый порт, клик на второй.

### Fix: оргструктура — связи не фиксировались и пропадали при новой линии

- `OrgChart.vue` — при `pointerup` цель берётся из `linkDraftHover`, если курсор чуть съехал с порта; при промахе черновик полностью сбрасывается (раньше оставался «зависший» режим связи без обработчиков).
- `OrgChart.vue` — перед стартом/завершением связи обновляются позиции портов; сохранённые линии ищут якоря в DOM, если кэш портов устарел.
- Проверка: `/admin/organization` → нарисовать 2–3 связи подряд → все сплошные серые; обновить страницу — линии на месте.

### Fix: оргструктура — целевой порт не подсвечивался при рисовании связи

- `OrgChart.vue` — при черновике связи отслеживается порт под курсором через `elementsFromPoint` (`linkDraftHover`), т.к. `setPointerCapture` на холсте блокирует CSS `:hover` на портах.
- `OrgNodePorts.vue` — класс `is-hover` для фиолетовой подсветки цели.
- Проверка: `/admin/organization` → потянуть от порта → навести на другой порт — он фиолетовый; отпустить или кликнуть — связь сохраняется.

### Fix: оргструктура — линия не фиксировалась при отпускании на порту

- `OrgChart.vue` — `setPointerCapture` на холсте при старте связи; `pointerup` обрабатывается на canvas, а не глотается портом.
- `OrgNodePorts.vue` — убран `@pointerup.stop`, завершение связи только через canvas/window.
- Проверка: `/admin/organization` → потянуть от порта к порту → линия становится сплошной и сохраняется.

### Fix: адаптация — 500 на `/api/adaptation/me` на тесте

- `trackLoader.ts` — трек вшит в сборку (import JSON), не читается с диска.
- `deploy-remote.sh` — при выкладке копирует `adaptation-track.json` в `server/data/` (запасной вариант).
- `findEmployeeForSession` — демо-аккаунты (`alina@vbi.local` и др.) работают без записи в `employees.json`.
- Проверка: `:8080` → войти → `/adaptation` → пройти тест.

## 2026-06-26

### Fix: оргструктура — связи не сохранялись и переставали рисоваться

- `useOrgStructure.ts` — при загрузке из localStorage `persist` затирал `links` пустым массивом (suspend на время hydrate).
- Рисование: порты видны в режиме связи, `elementsFromPoint` для попадания в цель, класс `org-chart-canvas--linking`.
- Исправлен сброс черновика при первом отпускании мыши на той же точке; порты всегда полупрозрачны в режиме редактирования.
- Проверка: нарисовать линии → уйти на `/organization` → вернуться в админку — линии на месте.

### Fix: редактор оргструктуры — 500 на `/admin/organization`

- `useOrgStructure.ts` — добавлен отсутствующий `defaultUnits` (ReferenceError при открытии редактора).
- Санитизация сохранённых `links` из localStorage.
- Проверка: `/admin/organization` → страница открывается, блоки и связи работают.

### UI: редактор оргструктуры — связи между блоками и поле руководителя

- `/admin/organization` — серые точки-порты по центру каждой стороны блока; тяните линию от порта к порту (ортогональный путь со скруглёнными углами). Двойной клик по линии — удаление.
- Поле «Руководитель»: крестик слева скрывает поле; «+ Руководитель» — вернуть.
- Данные связей в `localStorage` (`vbi-org-structure-v1`, поле `links`).
- Файлы: `OrgChart.vue`, `OrgNodePorts.vue`, `OrgUnitFields.vue`, `useOrgStructure.ts`, `utils/orgLinkPath.ts`, `main.css`.
- Проверка: `/admin/organization` → навести на блок → порты → связь между отделами; × у руководителя.

### UI: страница структуры (сотрудник) — без дубля заголовка

- `/organization` — убран повтор «Структура компании» (остаётся в шапке); «Нет подразделений» скрыто в режиме просмотра.

### UI: директора оргструктуры — фиолетовый фон с геометрией (ITMO)

- Карточки руководителей: акцентный фон `#7451f4`, у каждого из трёх — своя геометрия (круг, квадрат, полосы), фигуры обрезаются краем карточки.
- Проверка: `:8080` → `/admin/organization`.

### UI: оргструктура — удаление директора и группы отделов

- Кнопка × на карточке директора (с подтверждением), в том числе если директор один; вместе с ним удаляются его отделы и группы.
- Пустые группы отображаются на холсте; внутри группы — «+ Отдел в группу».
- Проверка: `/admin/organization`.

### UI: структура компании — карточки в стиле ITMO (кампусы)

- Карточки директора и отделов: светлая рамка `#d8d8d2`, скругление 20px, типографика как на [abit.itmo.ru/master#campuses](https://abit.itmo.ru/master#campuses).
- Директор — фиолетовый акцент ИТМО; отделы — белый фон, заголовок + подпись руководителя слева.
- Файлы: `main.css` (блок `.org-chart`).

### Справочник: правки HR не затираются при входе через Bitrix

- `bitrixSync.ts` — для уже существующих в `employees.json` не перезаписываются ФИО, должность, отдел, руководитель, дата приёма, роль, остаток отпуска; из Bitrix подтягиваются только `bitrix_user_id` и email (если пустой).
- Проверка: изменить должность в «Сотрудники» → выйти → войти → значение сохранилось.

### Импорт отпусков: даты трудоустройства и остаток на 01.01 (кол. D/E)

- `scripts/import-vacations-from-xlsx.py` — из кол. **D** пишет `hired_at`, из **E** — `vacation_opening_balance`.
- Баланс на платформе — **только по ЗУП** (`vacationBalance.ts`, методичка `_vacation_source/.../nachislenie-zarabotannogo-otpuska-zup.html`); кол. **F** Excel (упрощённый +2,33/мес.) выводится справочно при импорте, расхождения ожидаемы.
- Проверка: `python3 scripts/import-vacations-from-xlsx.py`; Драго Станислава: `hired_at=2023-11-20`, opening **19,62**.

### UI: тулбар календаря — год и вид без шапки HR

- Убран блок «График отпусков (HR)» на `admin/vacations`.
- Год — компактная плашка слева от «Детально / По месяцам» (ITMO, скруглённая рамка).

### UI: календарь отпусков — ITMO-стиль и sticky-шапка внутри таблицы

- Скролл только внутри `.vac-table-scroll`; шапка (ФИО, остаток, месяц, дата) закреплена до конца tbody.
- Светлые границы и фон шапки как на [abit.itmo.ru](https://abit.itmo.ru/master#preparation); без поворота «Остаток».

### UI: скролл и закрепление в графике отпусков (fix)

- Убран `rowspan` в шапке детального календаря — sticky больше не ломает «Сотрудник» / «Остаток».
- Фиолетовая шапка прокручивается на страницах с `vac-team-calendar`.
- Вертикальный скролл — страница; горизонтальный — внутри таблицы; шапка таблицы sticky.

### UI: скролл и закрепление в графике отпусков

- У сотрудника фиолетовая шапка прокручивается вместе со страницей.
- Шапка таблицы (месяцы / дни) закрепляется при вертикальном скролле, как столбец с ФИО.
- Проверка: `:8080` → график отпусков → прокрутка вниз.

### Импорт отпусков из Excel (лист 2026)

- Скрипт `scripts/import-vacations-from-xlsx.py` — кол. D/E/F, заявки (зелёный=согласован, жёлтый=бронь).
- Хранение: `server/data/vacations.json`, API `GET/PUT /api/vacations`.
- Поле `vacation_opening_balance`; баланс = E + начисление ЗУП − отгуляно/забронировано (не ниже 0).
- Проверка: `python3 scripts/import-vacations-from-xlsx.py` → `npm run dev` → график отпусков 2026.

### UI: убрана плашка «Бой» на production

- `app.vue` — баннер стенда не показывается на бою (ломал вёрстку).

### Справочник сотрудников — источник для графика отпусков

- Автосинк из Bitrix при входе **не возвращает** удалённых из раздела «Сотрудники» (обновляет только тех, кто уже в справочнике).
- Исправлены дубликаты: синк не дублировал строки без `bitrix_user_id`; клиент сохраняет `bitrix_user_id`; дедуп по email/platform id/**ФИО**; UI всегда показывает дедуплицированный список.
- Ключ localStorage справочника: `vbi-employees-v5`.
- Первый импорт — при пустом справочнике; полный импорт новых — `POST /api/bitrix/sync-employees` (admin/hr).
- Дедупликация по `bitrix_user_id` / email в `employees.json`.
- Календарь отпусков при открытии перечитывает справочник с сервера.

### Роли из справочника сотрудников, не из Bitrix

- При входе роль берётся из `account_role` в `employees.json`; Bitrix — только если роль ещё не задана.
- Синк не перезаписывает роли; смена в «Сотрудники» подхватывается при обновлении страницы.
- Файлы: `server/utils/bitrixAuth.ts`, `bitrixSync.ts`, `session.ts`.

### Bitrix: ФИО без отчества

- `formatBitrixUserName` — только фамилия и имя (`LAST_NAME` + `NAME`).
- После деплоя: перелогин или синк обновит уже сохранённые имена.

### Bitrix: fallback на OAuth при битом вебхуке

- `bitrixFetchAll` — при `INVALID_CREDENTIALS` на вебхуке синк идёт через OAuth-токен входа.
- Локально `BITRIX_WEBHOOK_URL` в `.env` опционален (см. `.env.example`).

### Bitrix OAuth на production (бой)

- Отдельный env: `/etc/vbi-hr/bitrix-production.env`, redirect `http://45.12.74.25/api/auth/bitrix/callback`.
- Синк сотрудников: при входе через OAuth; на сервере также `BITRIX_WEBHOOK_URL` (надёжнее полного списка).
- Ручной синк (admin/hr): `POST /api/bitrix/sync-employees`.
- `run-production.sh`, обновлён `vbi-hr.service` (Group=deploy, `.env` из production env).
- `deploy-remote.sh` — разные env-файлы для staging и production.
- Проверка: http://45.12.74.25 → вход через Битрикс; staging :8080 не затрагивается.

### Bitrix OAuth local: hot-reload .env и /api/auth/oauth-debug

- `frontend/.env` перечитывается при каждом запросе в development.
- `/api/auth/oauth-debug` — проверка Client ID и redirect URI перед входом.
- Ошибки OAuth на staging возвращают на `:8080`, не на порт 80.

## 2026-06-25

### docs: шпаргалка по 3 локальным приложениям Bitrix

- [docs/BITRIX.md](BITRIX.md) §0 — что оставить (бой + dev), что удалить.

### Bitrix OAuth local: отдельные ключи и callback с порта dev

- В development `getBitrixRedirectUri` берёт origin из запроса (актуальный порт `npm run dev`).
- Проверка origin перед OAuth; понятная ошибка при «Неверный state» (localhost vs сервер).
- `.env.example`: CLIENT_ID dev-приложения ≠ prod на VPS.

### Bitrix: отдельные OAuth-приложения для local и prod

- Документация: dev → `http://localhost:3000/api/auth/bitrix/callback`, prod → `http://45.12.74.25/api/auth/bitrix/callback`.
- См. [docs/BITRIX.md](BITRIX.md).

### Auth: бой и тест не пересекаются при входе/выходе

- OAuth callback редиректит на origin **текущего** запроса (`:8080` — тест, `:80` — бой).
- Убран автоперенос на staging; кнопка Битрикс — относительный `/api/auth/bitrix`.
- Проверка: выход на :8080 → вход снова на :8080; выход на :80 → вход на :80.

### Auth: канонический URL staging с портом :8080

- После Bitrix OAuth редирект на `BITRIX_REDIRECT_URI` origin (`http://45.12.74.25:8080`), не на порт 80.
- `/api/auth/config` → `appPublicUrl`; клиент перенаправляет с неверного origin.
- Env: `APP_PUBLIC_URL` (опционально, иначе из `BITRIX_REDIRECT_URI`).
- Проверка: вход через Битрикс → в адресной строке `:8080/`; logout → снова `:8080` с кнопкой Битрикс.

### Auth: кнопка Битрикс после logout

- `useBitrixAuthConfig` — `showBitrixLogin` от `/api/auth/config`, не только от `appEnv` в сборке.
- Демо-форма скрыта, если на сервере настроен Bitrix OAuth.
- При logout очищается `?auth=bitrix` из URL; на экране логина с этим query — сразу редирект в OAuth.
- Проверка: войти через Битрикс → выйти → снова «Войти через Битрикс24», без демо-аккаунтов.

### CI/CD: починен deploy на staging

- `DEPLOY_HOST` и `DEPLOY_USER` в `.gitlab-ci.yml` (не зависят от Protected variables).
- `deploy-remote.sh` — `sudo chown` перед rsync (после ручного деплоя от root).
- `deploy/sudoers/vbi-hr-deploy` — право `chown` для пользователя `deploy`.
- Проверка: push в `staging` → pipeline build + deploy зелёные.

### UI staging: убран баннер «Тестовый стенд»

- `useAppEnv.ts` — `envLabel` на staging пустой; баннер не рендерится в `app.vue`.
- Проверка: открыть http://45.12.74.25:8080 — полоса «Тестовый стенд» над шапкой отсутствует.

### Bitrix OAuth: навигация и повторный вход

- `useAppBootstrap.ts` — единый hydrate сотрудников, отпусков, задач, кошелька после логина.
- `homePath` в режиме `full` ведёт на `/` и `/admin` (не только на отпуска).
- `?auth=bitrix` — ожидание сессии, повторный OAuth при сбое, без демо-формы на staging.
- `AuthLogin` — кнопка Битрикс на staging/production, демо только в development.
- Убран `mode="out-in"` у переходов страниц (пустые экраны при навигации).
- nginx staging: `Host $http_host` для корректного OAuth callback на :8080.
- `load-bitrix-env`: не падать при EACCES на `/etc/vbi-hr/bitrix.env` (env из `.env` в каталоге приложения).
- Проверка: войти через Битрикс → переходы по меню; logout → снова «Войти через Битрикс24».

### Битрикс24 (коробка): OAuth и синк сотрудников при входе

- Вход через **«Войти через Битрикс24»** (`/api/auth/bitrix`, callback `/api/auth/bitrix/callback`).
- Кнопка видна, если на сервере заданы `BITRIX_*` env (`GET /api/auth/config` — runtime, не build).
- При каждом логине — синхронизация активных сотрудников из `user.get` + `department.get` в `server/data/employees.json`.
- Env: `BITRIX_PORTAL_URL`, `BITRIX_CLIENT_ID`, `BITRIX_CLIENT_SECRET`, опционально группы ролей.
- Файлы: `server/utils/bitrix*.ts`, `AuthLogin.vue`, `useAuth.ts`, `frontend/.env.example`.
- Документация: [docs/BITRIX.md](BITRIX.md).
- Проверка: создать локальное приложение в коробке → задать env на VPS → войти через Битрикс → раздел «Сотрудники».

### CI/CD: надёжная подготовка SSH-ключа в pipeline

- `deploy/scripts/setup-ci-ssh-key.sh` — приоритет `SSH_PRIVATE_KEY` (File), устойчивый base64 (`openssl`), проверка заголовка и длины B64.
- `deploy/scripts/verify-ci-key-local.sh` — проверка ключа на Mac и инструкции для GitLab Variables.
- `.gitlab-ci.yml` — `openssl` в deploy job.
- Документация: [docs/CI-CD.md](CI-CD.md) — пошагово Type File, снять Expand variable reference.
- Проверка: `bash deploy/scripts/verify-ci-key-local.sh` → настроить Variables → Retry pipeline.

### CI/CD: две задачи (Mac → Git → сервер)

- **Задача 1:** `scripts/push-to-gitlab.sh` — push с компьютера в GitLab (порт 2222), без деплоя.
- **Задача 2:** `.gitlab-ci.yml` — build на push, deploy на VPS (`deploy-from-ci.sh`); staging авто, main вручную.
- Документация: [docs/CI-CD.md](CI-CD.md).
- Проверка: `bash scripts/push-to-gitlab.sh staging` → [Pipelines](https://ilnizumak.beget.app/vbi/hrplatform/-/pipelines) → build + deploy.

## 2026-06-24

### Деплой: GitLab CI и скрипты для VPS

- `.gitlab-ci.yml` — сборка на `staging`/`main`, manual deploy через rsync + systemd.
- `deploy/` — nginx, systemd, скрипты выкладки.
- **Beget:** [deploy/SETUP-ILNIZUMAK.md](../deploy/SETUP-ILNIZUMAK.md) — GitLab `ilnizumak.beget.app/vbi/hrplatform`, VPS `45.12.74.25`.
- `deploy/scripts/bootstrap-ssh.sh` — SSH-ключ; `push-gitlab.sh` — push в GitLab.

### Отпуска: боковая панель руководителя в режиме «Сотрудник»

- Правая панель совпадает с экраном обычного сотрудника: баланс, таблица, «Мои заявки», легенда — в отдельной карточке с тем же оформлением.
- Переключатель «Режим» (Руководитель / Сотрудник) сохранён над карточкой в обоих режимах.
- Файлы: `ManagerVacationAside.vue`, `main.css`.
- Проверка: `/vacations` под менеджером → «Сотрудник» → панель как у employee + toggle сверху; «Руководитель» в toggle — статистика команды.

### Процесс: документация в каждом коммите

- Правила `.cursor/rules/commit-staging.mdc` и `docs-maintenance.mdc`: CHANGELOG (и при необходимости ARCHITECTURE) обновляются **в том же коммите**, что и код.
- В `docs/ARCHITECTURE.md` зафиксированы токены ITMO-плашек отпусков, логика «Отгулял/План», формат дат в месячной таблице.

### Отпуска: ITMO-плашки в месячной таблице и полные даты

- Плашки в календаре команды (вид «по месяцам»): solid pill — зелёный согласован (`--vac-pill-approved-bg`), охристый на согласовании (`--vac-pill-pending-bg`), белый жирный текст.
- Даты в ячейках: `01.07-12.07` вместо `1-12`, без обрезки и многоточия.
- Из popover аванса убран текст «Праздники в период не входят в счёт отпуска».
- Файлы: `useVacations.ts` (`formatMonthVacationRange`), `VacAdvancePopover.vue`, `main.css`.
- Проверка: `/vacations` → календарь команды → месячный вид — плашки с полными датами; hover по «Аванс» — без подписи про праздники.

### Отпуска: единые ITMO-плашки, ромбик у всех подсказок, «План» vs «Отгулял»

- Статусы в «Мои заявки» (согласован / на согласовании / отклонён) — solid pill как пересечение и аванс: белый жирный текст, без обводки (`--vac-pill-approved-bg`, `--vac-pill-overlap-bg`, `--vac-pill-rejected-bg`).
- У popover аванса в очереди согласования — ромбик-указатель, как у пересечений (все placement).
- Будущие согласованные отпуска учитываются в колонке **План**, а не **Отгулял**; прошедшие и текущие дни — в **Отгулял**.
- Файлы: `utils/vacationBalance.ts`, `frontend/app/assets/main.css`.
- Проверка: `/vacations` → согласованный июльский отпуск до 1 июля в таблице в **План**; hover по жёлтой и розовой плашкам в очереди — оба popover с ромбиком.

### Отпуска: плашки ITMO (жёлтый пересечение, розовый аванс)

- Предупреждения в формате pill как на itmo.events: насыщенный фон, белый жирный текст, без обводки.
- Пересечение — `--vac-pill-overlap-bg` `#efc038`; аванс — `--vac-pill-advance-bg` `#e186a9`.
- Файл: `frontend/app/assets/main.css`, `EmployeeVacationPanel.vue`.

### Отпуска: предупреждение об авансе по дням (без блокировки)

- Расчёт дней в счёт отпуска **без праздников** (`countVacationBillableDays`); баланс и «отгулял/план» синхронизированы.
- Предупреждение, если к **дате начала** отпуска не хватает дней (аванс); если к тому моменту накопится достаточно — предупреждения нет.
- Сотрудник: компактная плашка **справа от «Создать заявку»**; руководитель/HR: pill «Аванс N дн.» + popover в очереди согласования; в «Мои заявки» — tag у pending.
- Файлы: `utils/vacationBalance.ts`, `utils/vacationCalendar.ts`, `VacAdvancePopover.vue`, `EmployeeVacationPanel.vue`, `EmployeeVacationAside.vue`, `pages/vacations.vue`, `pages/admin/vacations.vue`, `main.css`.
- Проверка: `/vacations` → выбрать период с авансом — плашка у кнопки; очередь согласования — золотой badge; заявка не блокируется.

### Отпуска: превью диапазона — выходные оранжевые, праздники нет

- При выборе периода отпуска кликом в превью оранжевым подсвечиваются будни и выходные в диапазоне; праздничные дни остаются розовыми (не входят в отпуск и не получают класс превью).
- Файлы: `frontend/app/utils/vacationCalendar.ts` (`isInRangePreview`), `frontend/app/components/EmployeeYearCalendar.vue`, `frontend/app/assets/main.css`.
- Проверка: `/vacations` → режим сотрудника → выбрать диапазон через майские/новогодние праздники → выходные в превью оранжевые, праздники розовые.

### Отпуска: превью диапазона включает выходные

- При выборе периода отпуска кликом выходные в диапазоне подсвечиваются оранжевым — как при согласовании; раньше оставались синими из‑за CSS-специфичности.
- Файлы: `frontend/app/assets/main.css`.
- Проверка: `/vacations` → режим сотрудника → клик по буднему дню → наведение на другой → в превью оранжевые и будни, и выходные между ними.

### Отпуска: выбор диапазона дат кликом в календаре сотрудника

- В годовом календаре: первый клик — дата начала, наведение подсвечивает диапазон оранжевым (как «на согласовании»), второй клик — дата окончания; поля «с» / «по» в форме «Создать заявку» заполняются автоматически.
- Нельзя выбрать прошедшие дни и дни с уже одобренным или ожидающим отпуском; клик вне ячеек календаря сбрасывает выбор.
- Файлы: `frontend/app/components/EmployeeYearCalendar.vue`, `frontend/app/components/EmployeeVacationPanel.vue`, `frontend/app/composables/useVacationRangePick.ts`, `frontend/app/utils/vacationCalendar.ts`, `frontend/app/assets/main.css`.
- Проверка: `/vacations` (режим сотрудника или переключатель «Сотрудник» у руководителя) → клик по свободному дню → наведение на другой → второй клик → поля формы заполнены → «Создать заявку».

### Футер агентства VBI на всех страницах

- Внизу каждой страницы — полоска в стиле ITMO events: логотип **VBI**, разделитель, «Следите за нами» и иконки VK + Telegram.
- Файлы: `frontend/app/components/AppSiteFooter.vue`, `frontend/app/app.vue`, `frontend/app/assets/main.css`, `frontend/nuxt.config.ts`.
- Ссылки задаются через `runtimeConfig.public`: `NUXT_PUBLIC_SOCIAL_VK_URL` (по умолчанию `https://vk.com/vbi.agency`), `NUXT_PUBLIC_SOCIAL_TELEGRAM_URL` (`https://t.me/vbi_agency`).
- Проверка: открыть `/` или экран входа — внизу полоска с VBI и двумя иконками; клик открывает соцсети агентства.

### Отпуска: компактное меню действий заявки

- Меню «⋯» в «Мои заявки» снова компактное: у teleported-варианта сброшены `right`/`top` от абсолютного позиционирования (иначе `left` + `right: 0` растягивали попап на всю ширину viewport).
- Файл: `frontend/app/assets/main.css` (`.emp-request-menu`, `.emp-request-menu--teleported`).
- Проверка: `/vacations` → режим сотрудника → «⋯» у заявки — узкий выпадающий список у кнопки.

### Отпуска: всплывающие окна поверх рамок (Teleport)

- Попап «Пересечения отпусков» и меню действий «Мои заявки» рендерятся через `<Teleport to="body">` с `position: fixed` — не обрезаются родительскими `overflow: hidden`.
- Новые файлы: `frontend/app/composables/useFloatingPosition.ts`, `frontend/app/components/VacOverlapPopover.vue`.
- Затронуты: `frontend/app/pages/vacations.vue`, `frontend/app/pages/admin/vacations.vue`, `frontend/app/components/EmployeeVacationAside.vue`, `frontend/app/assets/main.css`.
- Проверка: `/vacations` → «Согласование» — навести на «Есть пересечение» у верхней/нижней заявки; режим «Сотрудник» в боковой панели → «⋯» у заявки внизу списка — меню полностью видно.

### Календарь отпусков: заголовок «Сотрудник» в месячном виде

- Заголовок первого столбца в режиме «По месяцам» совпадает с детальным видом: отступ слева 8px, кегль 0.72rem, жирность 700.
- Файлы: `frontend/app/components/VacationMonthlyCalendar.vue`, `frontend/app/assets/main.css`.
- Проверка: `/vacations` → «По месяцам» — сравнить заголовок «Сотрудник» с режимом «Детально».

## 2026-06-23

### Календарь отпусков: полные даты в месячном виде

- Плашки в режиме «По месяцам» показывают диапазон дней без многоточия (`29-30`, `1-12`); месяц задаётся заголовком столбца.
- Убраны `text-overflow: ellipsis` и `overflow: hidden` у `.vac-team-calendar .vac-block`.
- Файлы: `frontend/app/assets/main.css`, `frontend/app/composables/useVacations.ts` (`formatMonthVacationRange`).
- Проверка: `/vacations` → «По месяцам» — даты целиком, столбцы месяцев одинаковой ширины.

### Календарь отпусков руководителя: равная ширина месяцев

- Таблица по месяцам (`VacationMonthlyCalendar` в `VacationTeamCalendar`): `table-layout: fixed`, столбцы Янв–Дек одинаковой ширины; колонка «Сотрудник» фиксирована.
- Плашки дат отпуска (`.vac-block`) — `fit-content`, уменьшен правый padding, не растягивают ячейку.
- Файлы: `frontend/app/assets/main.css`.
- Проверка: `/vacations` (режим руководителя) и `/admin/vacations` — все месяцы одной ширины, плашки компактнее.

### Структура компании: директора без рамок подразделений, свободный drag

- Директора — отдельные оранжевые pill-карточки на общем холсте, без колонок и рамок подразделений; одиночные отделы без обводки рамки группы.
- Все элементы (директора, отделы, группы) перемещаются по единому canvas с абсолютными координатами; авторазмещение новых директоров и отделов учитывает глобальные занятые слоты.
- Файлы: `frontend/app/components/OrgChart.vue`, `frontend/app/composables/useOrgStructure.ts`, `frontend/app/assets/main.css`.
- Проверка: `/admin/organization` — перетащить директора и отдел в произвольные места; добавить директора — появляется на свободной позиции; обновить страницу — layout сохранён.

### Структура компании: свободное перемещение рамки директора (fix)

- Блок директора на холсте `/admin/organization` перетаскивается так же, как отделы и группы; координаты `x`/`y` на `OrgExecutive` сохраняются в `localStorage`.
- Файлы: `frontend/app/components/OrgChart.vue`, `frontend/app/composables/useOrgStructure.ts`, `frontend/app/assets/main.css`.
- Проверка: `/admin/organization` — перетащить оранжевую рамку директора; обновить страницу — позиция сохранена.

### Структура компании: свободное перемещение и изменение размера рамок

- Блоки отделов и групп перемещаются по холсту без привязки к сетке (абсолютные координаты `x`/`y`, плавный drag с `pointer` events).
- Рамки групп (`org-group-frame`) можно менять по размеру — уголок-ручка в правом нижнем углу; размеры `width`/`height` сохраняются в `localStorage`.
- Декоративная сетка на холсте (только визуал, не для snap); миграция старых `gridCol`/`gridRow` → `x`/`y` при загрузке.
- Файлы: `frontend/app/components/OrgChart.vue`, `frontend/app/composables/useOrgStructure.ts`, `frontend/app/assets/main.css`.
- Проверка: `/admin/organization` — перетащить отдел/группу в произвольное место; потянуть уголок рамки группы; обновить страницу — позиции и размеры сохранены. `/organization` — только просмотр.

### Neo-brutalist дизайн-система ITMO (abit.itmo.ru) на всей платформе

- Светлый контент: `--page-bg` `#eeeee8`, grain (`--noise-url`), тёмный текст `#202020`, границы `--border-brutal` 1px.
- Фиолетовая полоса topbar (`--hero-purple`); светлый sidebar с чёрной границей; навигация — pill с лаймовым active (`--accent-lime` `#ddf365`).
- Карточки, списки, таблицы: белый фон, скругление 14–16px, без тяжёлых теней; строки списков с горизонтальными разделителями (задачи, лента, очередь согласования).
- Кнопки: primary — чёрная pill с белым uppercase; ghost — белая с чёрной обводкой; фильтры — toggle как БЮДЖЕТ/КОНТРАКТ.
- Формы/инпуты: pill с 1px чёрной границей; теги — лайм или outlined brutalist.
- Hero главной и auth: фиолетовый фон; контент ниже hero — светлый brutalist.
- Анимации: `fade-slide-up` для секций, строк ленты и задач; hover lift только у кнопок/pills; `prefers-reduced-motion`.
- Сохранены: overflow-fix попапа пересечений отпусков, hover без подъёма карточек.
- Файлы: `frontend/app/assets/main.css`.
- Проверка: `cd frontend && npm run build`; `/`, `/tasks`, `/vacations`, экран входа — светлый grain, чёрные рамки, фиолетовый topbar, лаймовые toggles.

### Hero главной в стиле ITMO abit.itmo.ru/bachelor

- Hero `/`: насыщенный фиолетовый фон `#7451f4` с grain, лаймовый заголовок и pill-теги KPI (`border-radius: 50px`, тёмный текст на лайме, разделитель «+»).
- Справа — полукруглый декоративный блок с тёплым жёлтым оверлеем, кольца-контуры и плавающий фиолетовый кружок; полупрозрачная нижняя планка.
- Кнопки hero: белая primary, ghost с белой обводкой; скругление ~10px.
- Sidebar/topbar: фиолетовый оттенок (`rgba(36, 28, 58, …)`) для связки с hero.
- Токены: `--hero-purple`, `--hero-purple-deep`, `--hero-purple-bar`, `--hero-noise-opacity`.
- Файлы: `frontend/app/assets/main.css`, `frontend/app/pages/index.vue`.
- Проверка: `cd frontend && npm run build`; открыть `/` — фиолетовый hero, лаймовые pills, боковой визуал; `/vacations` — без регрессий попапа пересечений.

### Убран кастомный курсор и улучшена читаемость текста (fix)

- Удалён `AppInteractiveCursor` из оболочки приложения и связанные стили (`.app-cursor`, `.interactive-cursor-active`).
- Контраст на тёмных поверхностях: имя в topbar — `--text`, класс `.soft` и KPI-плитки hero — `--text-muted` / белые значения, подписи форм и заголовки таблиц светлее.
- Токен `--text-soft` осветлён (`#a8a8a8`) для вторичного текста на серых карточках.
- Файлы: `app.vue`, `assets/main.css` (удалён `AppInteractiveCursor.vue`).
- Проверка: `cd frontend && npm run build`; открыть `/` — нет круга-курсора, читаемые KPI и имя в шапке.

### Дизайн в духе ITMO abit.itmo.ru/bachelor

- Новая палитра: фиолетовый `#7451f4`, лайм `#ddf365`, бирюза `#388073`, голубой `#57a3d9`, золото `#f3b33e` на тёмном фоне `#202020`.
- Шрифты: **Golos Text** (текст), **Unbounded** (заголовки) — `nuxt.config.ts`.
- Текстура grain: SVG noise (`--noise-url`) на body, sidebar, topbar, карточках, hero и экране входа.
- Плашки-карточки: скругления 20–32px, мягкие тени, градиентные hero/auth-панели, KPI-плитки с цветным акцентом.
- Сохранены: `overflow-x: clip` для попапа пересечений отпусков, hover без подъёма карточек.
- Файлы: `frontend/app/assets/main.css`, `frontend/nuxt.config.ts`.
- Проверка: `cd frontend && npm run build`; открыть `/`, экран входа, `/vacations` — зернистый фон, фиолетово-лаймовые акценты, читаемый текст.

### Очередь согласования: попап пересечений не обрезается (fix)

- Убрано вертикальное обрезание из-за `overflow-x: hidden` на `.content` (заменено на `overflow-x: clip` + `overflow-y: visible`).
- Панель и список заявок: `overflow: visible`; у нижних 1–2 строк попап «Пересечения» открывается вверх.
- Файл: `frontend/app/assets/main.css`.
- Проверка: `/vacations` → вкладка «Согласование», навести на «Есть пересечение» у нижней заявки — весь попап виден.

### Гармоничная тёмная дизайн-система (без белых карточек)

- Убран контраст «чёрный фон + белые блоки»: карточки, hero, задачи, лента, auth, календари отпусков переведены на **слои тёмных поверхностей** (`--bg-surface`, `--bg-surface-raised`).
- Новые токены: `--bg` `#12141a`, `--bg-elevated`, `--bg-soft`, `--surface-gradient`, мягкие границы `rgba(255,255,255,0.06–0.1)`, приглушённые тени и glow.
- Активная навигация и фильтры — primary-tinted surface вместо белой pill; ghost-кнопки и формы — тёмный фон.
- Календари: сетки на `--bg-surface-raised`, выходные/праздники через `--vac-weekend-bg` / `--vac-holiday-bg`; статусы отпусков сохраняют читаемость.
- Удалён блок принудительного `--text-on-light` на светлых панелях; основной UI — `--text` на тёмных поверхностях.
- Файл: `frontend/app/assets/main.css`.
- Проверка: `cd frontend && npm run build`; открыть `/`, `/tasks`, `/vacations` — мягкий тёмный UI без резкого контраста.

### Главная: лента «Новости коллег» и CTA адаптации

- Блок «Ближайшие награды» заменён на **«Новости коллег»** — демо-лента активности (подарки, достижения, отпуска, новички).
- В «Приоритетные задачи»: кнопка **«Начать адаптацию»** при отсутствии активных задач или низком прогрессе адаптации (`progress_percent < 15`); при активных задачах — список + ссылка на адаптацию.
- Hero с KPI и быстрыми ссылками (Адаптация, Задачи, Кошелёк) сохранён.
- Файлы: `pages/index.vue`, `composables/useColleagueFeed.ts`, `assets/main.css`.
- Проверка: `cd frontend && npm run build`; открыть `/` — лента из 8 пунктов, CTA адаптации при пустых задачах.

### Hover: только кнопки и чипы, без подъёма карточек (fix)

- Убран `transform` и усиление тени при hover у крупных блоков: `.card`, `.creative-hero`, `.direction-card`, `.mode-card`, `.task-item`, `.vac-approval-item`, `.profile-team-member`, `.auth-card` — в базовых стилях и в блоке `.interactive-cursor-active`.
- Сохранены hover-эффекты у `.button`, `.filter-btn`, `.nav-link`, `.role-btn`, `.tag` (chip-morph), мелких контролов внутри карточек.
- Файл: `frontend/app/assets/main.css`.
- Проверка: `cd frontend && npm run build`; навести на карточки и кнопки — карточки статичны, кнопки реагируют.

### Пустой контент на страницах кроме отпусков (fix)

- **Причина:** глобальный `pageTransition` с `mode: 'out-in'` вешал `opacity: 0` на корни страниц с несколькими корневыми узлами (главная, адаптация, задачи); `/vacations` имел один корневой `<div>` и оставался видимым.
- Переход перенесён в `app.vue`: обёртка `.page-root` вокруг `<NuxtPage>` — единый корень для анимации; `pageTransition` убран из `nuxt.config.ts`.
- Сетка `.content` → `.page-root`; для layout отпусков обновлены селекторы `:has(.vac-manager-layout)`.
- Проверка: `cd frontend && npm run build`; открыть `/`, `/adaptation`, `/tasks` — белые карточки и hero на тёмном фоне.

### Контраст текста на светлых панелях (fix)

- Семантические токены `--text-on-light`, `--text-muted-on-light`, `--text-soft-on-light` — тёмные оттенки для белых карточек и календарей.
- Переопределение `--text` / `--text-muted` / `--text-soft` внутри светлых контейнеров: календари отпусков, боковая панель руководителя, aside сотрудника.
- Исправлены: ФИО в таблице (`.emp-name`, `.sticky-col-name`), заголовки месяцев, метки «Заявки» в `ManagerVacationAside`.
- Проверка: `cd frontend && npm run build`; `/vacations` — имена, заголовки и статистика читаемы на белом фоне.

### Тёмная молодёжная дизайн-система (dark + white accents)

- Глобальная тёмная тема: фон `#0a0a0f`, светлые акцентные карточки (`.card`, `.creative-hero`), градиентные KPI.
- Шрифты Google Fonts: **Syne** (заголовки) + **DM Sans** (текст) — `nuxt.config.ts`, `main.css`.
- Сайдбар и навигация: тёмный glass, активный пункт — белая pill; топбар — blur на тёмном.
- Главная: hero-блок с инфографикой показателей (`pages/index.vue`); экран входа — светящиеся орбы (`AuthLogin.vue`).
- Анимации: переходы страниц (`page` transition), плавающие blob, `prefers-reduced-motion`.
- Интерактивный курсор и chip-morph адаптированы под тёмный фон (белая обводка → белая pill).
- Календари отпусков: светлые inset-панели сохранены для читаемости таблиц.
- Проверка: `cd frontend && npm run build`; открыть главную, логин, задачи, `/vacations` — контраст и акценты.

## 2026-05-28

### Интерактивный курсор и hover-анимации (как design.google)

- Курсор следует за мышью без задержки; инверсия через `mix-blend-mode: difference`.
- Чипы/кнопки: обводка → залитая pill при hover (теги, фильтры, ghost-кнопки, навигация).
- `AppInteractiveCursor.vue`, `main.css`.

### Календарь команды: ФИО в две строки

- Имя и фамилия — на отдельных строках (`EmployeeNameStacked.vue`); одно слово — одна строка.
- Экономия ширины колонки «Сотрудник» в месячном и детальном виде.

### Календарь команды: ширина колонки «Сотрудник»

- Колонка подстраивается под самое длинное ФИО в одну строку + небольшой отступ справа (месячный и детальный вид).
- `main.css`, `VacationDetailedCalendar.vue` — `--vac-name-col-w` для sticky «Остаток».

### Календарь руководителя: автопрокрутка детального вида

- При открытии «Детально» текущая дата — ~3 ячейки от левого края сетки (не начало месяца).
- `VacationDetailedCalendar.vue` — `scrollToToday`.

### Календарь руководителя: формат дат в таблице по месяцам

- Диапазоны в ячейках: `20.07-26.07` вместо «20 июл. – 26 июл.»; несколько отпусков — отдельные строки в ячейке.
- `formatMonthVacationRange` в `useVacations.ts`, `VacationMonthlyCalendar.vue`.

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
