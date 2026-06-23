# Changelog

Формат: кратко по датам. При каждой заметной фиче добавляйте запись сверху.

## 2026-06-24

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
