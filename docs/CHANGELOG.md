# Changelog

Формат: кратко по датам. При каждой заметной фиче добавляйте запись сверху.

## 2026-09-01

### БЗ: корпоративные шрифты TT Hoves Pro Trial

- Статья `kb-corp-fonts-vbi` «Корпоративные шрифты VBI»: Regular + Bold, установка, ссылки на скачивание.
- Файлы: `frontend/public/knowledge/fonts/TT-Hoves-Pro-Trial-Regular.ttf`, `TT-Hoves-Pro-Trial-Bold.ttf`.
- Neurobot RAG: синонимы «корп шрифты», «hoves», «TT Hoves» в `knowledgeRagLexical.ts`; рабочий intent в `knowledgeAiIntent.ts`.
- Проверка: `/knowledge` → статья «Корпоративные шрифты VBI»; нейробот «какие у нас шрифты» / «корпоративные шрифты».

### Админ: справочник сотрудников — отступы между колонками 8px

- `/admin/employees`: горизонтальный зазор между столбцами таблицы — **8px** (`padding: 3px 4px` на ячейках); исправлено перекрытие общим `.table { padding: 12px 10px }`.
- Файл: `frontend/app/assets/main.css` (`.table.personnel-table`).
- Проверка: `/admin/employees` → таблица без лишних промежутков, без горизонтального скролла.

### Админ: справочник сотрудников — юр. лицо и форма договора

- `/admin/employees`: колонки **«Юр. лицо»** и **«Форма договора»** (редактируемые, как остальные поля таблицы).
- Поля в `employees.json`: `legal_entity`, `contract_form` (строка, по умолчанию пусто). **Не синкаются из Bitrix** — только ручной ввод HR.
- Убран дублирующий заголовок и описательный абзац под шапкой; компактная вёрстка таблицы без горизонтального скролла на ~1280px.
- Файлы: `pages/admin/employees.vue`, `composables/useEmployees.ts`, `server/utils/employeesStore.ts`, `main.css`.
- Проверка: `/admin/employees` → заполнить юр. лицо / форму договора → «Сохранено» → обновить страницу.

### CI: verify-production-build на Alpine (deploy:production)

- `deploy/scripts/verify-production-build.sh`: `grep --include` заменён на `find` + построчный `grep` — BusyBox grep в job `deploy:production` (Alpine) не понимает `--include`, из‑за этого падала проверка `appEnv`/`launchScope`.
- Проверка: `NUXT_PUBLIC_APP_ENV=production NUXT_PUBLIC_LAUNCH_SCOPE=vacations npm run build` в `frontend/` → `bash deploy/scripts/verify-production-build.sh`.

## 2026-08-28

### UI: контраст ошибки отпусков + ссылка на профиль в шапке

- **Отпуска:** `.vac-emp-error` — тёмный `var(--danger)` на светлом фоне `#fef0ee` с рамкой (вместо бледного `#fca5a5`).
- **Шапка:** аватар и имя в topbar — `NuxtLink` на `/profile`; колокольчик уведомлений без изменений.
- Файлы: `main.css`, `app.vue`.
- Проверка: `/vacations` → ошибка валидации/учебного режима читается; клик по аватару/имени в шапке → `/profile`.

### Памятка: откат арта чипа — кот + капибара (art-c-v23)

- Вернул утверждённый заказчиком арт чипа (36d8f26): кот в шезлонге + капибара; отменён ошибочный чемодан art-c-v24 (768c03e).
- Cache-bust снова `?v=art-c-v23`. Файлы: `public/memos/pvm-c-art-chip.png`, `postVacationMemoSlides.ts`.
- Проверка: `?pvm=1` → Позже → чип с котом и капибарой.

### Памятка: арт чипа — минималистичный чемодан (art-c-v24)

- Чип: компактный rolling suitcase (белый корпус, лайм ручка/колёса, coral багажный ярлык, жирная чёрная обводка) — замена зонт+солнце и кот+капибара; читается на lavender-градиенте в ~48px. RGBA 256×256, ~32 KB.
- Cache-bust `?v=art-c-v24`. Тексты чипа без изменений.
- Файлы: `public/memos/pvm-c-art-chip.png`, `postVacationMemoSlides.ts`.
- Проверка: `:8080/?pvm=1` → Позже → чип с новым значком.

### Фикс: квест-обучение отпусков, учётные данные Vibe, памятка после отпуска

- **Квест отпусков:** `VacationTrainingOverlay` не монтировался на экране сотрудника (`/vacations` → `EmployeeVacationPanel` без обёртки `VacationsManagerExperience`) — режим включался, но карточки шагов не появлялись. Оверлей перенесён в `EmployeeVacationPanel.vue`.
- **Админ → Сотрудники:** вместо `prompt()` только с паролем — модалка «Логин (email) + пароль» (`VibeCredentialsDialog.vue`). Логин = email в справочнике; пароль — `vibe-passwords.json`.
- **Памятка после отпуска:** после прочтения до конца welcome не должен повторяться для той же заявки. `hydrate()` читает localStorage заново (не кэш computed); `memoStorageRevision` после `persistDone`/`persistDocked`.
- Файлы: `EmployeeVacationPanel.vue`, `VacationsManagerExperience.vue`, `VibeCredentialsDialog.vue`, `admin/employees.vue`, `usePostVacationMemo.ts`, `postVacationMemo.ts`.
- Проверка: localhost `/vacations` → «Начать квест» → карточки шагов; `/admin/employees` → 🔑 → email+пароль; `?pvm=1` → дочитать → перелогин → welcome не повторяется.

### Памятка: новый арт чипа — кот в шезлонге + капибара (art-c-v23)

- Чип: компактный значок «кот в шезлонге с панамой и очками + капибара в очках» (по референсу заказчика) — neo-brutalist flat, лайм шезлонг, фиолетовый кот, coral панама, жирная чёрная обводка; читается на lavender-градиенте в ~48px. RGBA 256×256.
- Cache-bust `?v=art-c-v23`. Тексты чипа без изменений.
- Файлы: `public/memos/pvm-c-art-chip.png`, `postVacationMemoSlides.ts`.
- Проверка: `:8080/?pvm=1` → Позже → чип с новым значком.

### Памятка: новый арт чипа — чемодан (art-c-v22)

- Чип: компактный значок rolling suitcase (белый корпус, лайм ручка/колёса, coral багажный ярлык, жирная чёрная обводка) вместо зонт+солнце — читается на lavender-градиенте в ~48px. RGBA 256×256, ~32 KB.
- Cache-bust `?v=art-c-v22`. Тексты чипа без изменений.
- Файлы: `public/memos/pvm-c-art-chip.png`, `postVacationMemoSlides.ts`.
- Проверка: `:8080/?pvm=1` → Позже → чип с новым значком.

### Памятка: окно welcome — 7 рабочих дней + новый арт чипа (art-c-v21)

- Welcome показывается после дня окончания отпуска, но не позже **7 рабочих дней** (как чип — через `addWorkingDaysIso`, с учётом выходных и праздников РФ). Константа `POST_VACATION_MEMO_WINDOW_WORKING_DAYS`.
- Чип: новый значок «зонт + солнце» (лайм + coral) вместо фиолетового кота+чемодана — читается на lavender-градиенте. Cache-bust `?v=art-c-v21`.
- Файлы: `postVacationMemo.ts`, `postVacationMemoSlides.ts`, `public/memos/pvm-c-art-chip.png`, `docs/PRODUCT.md`.
- Проверка: после отпуска ≥7 дней — welcome в пределах 7 раб. дней; чип с новым артом на `:8080/?pvm=1` → Позже.

### Памятка Design C: fix — тексты pace и fresh не перепутаны

- `pace` («Войди в ритм плавно», tip1): восстановлен копирайт про плавный вход в ритм (не набрасываться на задачи, войти в курс дела) — как в `series-c-03-tip1`.
- `fresh` («Посмотри на работу свежим взглядом», tip2): копирайт «новый угол / рутина / стол» + inline-горшок после «на столе» (раньше ошибочно стоял на `pace` в 76bd05b).
- Остальные слайды без изменений. Cache-bust `?v=art-c-v20`.
- Файл: `postVacationMemoSlides.ts`.
- Проверка: `?pvm=1` → tip1 «Войди в ритм плавно» — про ритм; tip2 — свежий взгляд + горшок. Стейдж `:8080`.

### Памятка Design C: сжатие PNG-иллюстраций

- Оптимизированы 8 ассетов `public/memos/pvm-*.png` (sharp palette PNG, quality 92): суммарно ~2.32 MB → ~1.08 MB (−53%).
- Inline-цветок `pvm-inline-flower-pot.png` — lossless RGBA (прозрачность сохранена).
- Cache-bust `?v=art-c-v19`. Проверка: `?pvm=1` на стейдже `:8080`.

### VPN: замок в меню на бое

- `/vpn` убран из whitelist пилота `LAUNCH_SCOPE=vacations` — в меню замок и подсказка «Раздел скоро откроется»; прямой URL редиректит на главную пилота.
- Стейдж `:8080` (`launchScope=full`) — VPN по-прежнему открыт.
- Файлы: `useLaunchScope.ts`, `docs/PRODUCT.md`, `.cursor/rules/production-nav-locks.mdc`.
- Проверка: бой `http://45.12.74.25/` — пункт VPN с замком; стейдж `:8080/vpn` — помощник открывается.

### База знаний: ИИ-чат — кейсы ecom/SMM, ссылки, follow-up

- Кейсы ecom с каналом (SMM/смм, таргет, посевы): если прямого кейса нет — явный текст «по SMM пока не добавлены» + близкие с каналами из статьи; не шаблонный список всех ecom.
- Уточнения в диалоге («клиент в еком на смм» после «кейсы ecom») склеиваются с темой, модель не повторяет verbatim ответ.
- Markdown-ссылки и «Ссылка: https://…» в тексте ответа срезаются — кликабельные ссылки только в «Ещё по теме».
- Опечатки/сокращения: очепятка→опечатка, еком→ecom, смм в синонимах RAG.
- Пути: `knowledgeAiIntent.ts`, `useKnowledgeAiAnswer.ts`, `yandex-ask.post.ts`, `yandexGpt.ts`, `knowledgeRagSense.ts`, `knowledgeRagLexical.ts`.
- Проверка: `node scripts/knowledge/check-kb-dialog-followup.mjs`; в чате «клиент в еком на смм», follow-up после «кейсы ecom», «очепятка в доке». Стейдж `:8080`.

### Памятка Design C: welcome padding + прозрачный inline-цветок (fix staging)

- Welcome: блок текста опущен сильнее — `padding-top: calc(6.5% + 32px)` (было +12px).
- Inline flower tip1: `pvm-inline-flower-pot.png` перегенерирован с RGBA (без белого квадрата); peach `#E2A77A` + lavender `#9B8CC5`.
- Cache-bust `?v=art-c-v18`. Тексты intro/tip1/tip3/tip4 из коммита 76bd05b без изменений.
- Проверка: `?pvm=1` — welcome ниже; tip1 горшок без белого фона; intro «не набрасываться на работу». Стейдж `:8080`.

### Памятка Design C: правки текста + welcome layout + inline-цветок (tip1)

- Welcome: блок текста опущен — `padding-top: calc(6.5% + 12px)` у `.pvm-card--welcome .pvm-card__body`.
- Intro (card 2): новый копирайт про плавный вход после отпуска (2 абзаца).
- Tip1/pace (card 3): копирайт «свежий взгляд / рутина / стол» + inline ITMO flower-in-pot после «на столе».
- Tip3/weekend (card 4): дефис в «маленький отпуск - кино…» по макету заказчика.
- Tip4/triggers (card 5): финал с «!» — «…идеально для этого подходит!».
- Новый ассет `public/memos/pvm-inline-flower-pot.png`; сегменты абзаца через `PostVacationMemoParagraph.vue`. Cache-bust `?v=art-c-v17`.
- Файлы: `postVacationMemoSlides.ts`, `PostVacationMemo.vue`, `PostVacationMemoParagraph.vue`, `main.css`.
- Проверка: `?pvm=1` — welcome ниже; intro/tip1/tip3/tip4 тексты; tip1 — мини-горшок в строке. Стейдж `:8080`. Прод не трогали.

### Отпуска: admin «+ Добавить отпуск» — через согласование, не instant approve

- Ручное добавление отпуска admin/HR создаёт обычную заявку `pending` и уведомляет текущего согласующего; мгновенный `force approve` после создания убран.
- Панель «Заявки на согласование» в `/admin/vacations`: «Согласовать» проходит цепочку по этапам (Digital: manager → director), не переводит сразу в `approved`.
- Пути: `AdminAddVacationDialog.vue`, `useVacations.ts` (`elevated` в `approveRequest`), `pages/admin/vacations.vue`, `docs/PRODUCT.md`.
- Проверка: admin → «+ Добавить отпуск» для сотрудника Digital → заявка `pending` в очереди → «Согласовать» дважды (групхед → директор) → `approved`.

### Отпуска: админ обходит лимит месяца при ручном добавлении

- «+ Добавить отпуск» в `/admin/vacations` больше не отклоняется сервером, если месяц отдела уже занят бронями/заявками коллег (лимит 5/1 остаётся для сотрудников).
- Пути: `vacationRequestMutations.ts` (`assertVacationRequestGroupCap` пропускается для `role=admin` при create/patch дат).
- Проверка: админ → график → сотрудник Digital, месяц с 5 коллегами в отпуске/брони → «+ Добавить отпуск» на этот месяц → успех.

## 2026-08-27

### Памятка Design C: карточка ниже на 10px
- `.pvm-stage`: aspect `879/1279` → `879/1257` (−10px высоты при width 400px). Центрирование overlay (`place-items: center`) без изменений.
- Файлы: `main.css`. Проверка: `?pvm=1` — карточка чуть ниже, по центру. Стейдж `:8080`. Прод не трогали.

### База знаний: блок «код» — менее скруглённый нижний левый угол
- `.kb-code`: `border-bottom-left-radius: 6px` (остальные углы 24px). Редактор и просмотр статьи.
- Файлы: `main.css`. Проверка: статья с блоком кода — BL угол прямее. Стейдж `:8080`. Прод не трогали.

### Памятка Design C: без нумерованных табов + скруглённый верхний левый угол
- Убраны декоративные folder-tabs 1–5 сверху карточки (welcome и карусель).
- У `.pvm-card` все углы с `--pvm-radius` (в т.ч. верхний левый — раньше был острый под табом 1).
- Навигация без изменений: Позже/Прочитать, Назад/Дальше/Спасибо, свайп.
- Файлы: `PostVacationMemo.vue`, `main.css`, `postVacationMemoSlides.ts`, `docs/PRODUCT.md`.
- Проверка: `?pvm=1` — нет ряда 1–5, все слайды со скруглённым TL; CTA работают. Стейдж `:8080`. Прод не трогали.

### Памятка Design C: широкий текст + tip2/tip3 без тёмной кромки (art-c-v16)
- Layout: `.pvm-copy` почти на всю ширину (`max-width: 96%`) — заполняет пустое правое поле над артом (красная аннотация на tip3). Узкая левая колонка снята. Снизу clearance под арт; CTA слева без наезда.
- Арт tip2/tip3: с PNG снят/осветлён тёмный контурный fringe. Cache-bust `?v=art-c-v16`.
- CSS: у `.pvm-illust` без `border`/`outline`/`box-shadow`/`filter`.
- Файлы: `main.css`, `postVacationMemoSlides.ts`, `public/memos/pvm-c-art-tip{2,3}.png`.
- Проверка: `?pvm=tips` → таб 4 (tip3) — текст широкий вправо над котом; tip2/tip3 без чёрной обводки. Стейдж `:8080`, hard refresh. Прод не трогали.

### База знаний: блок «код» — тёмно-синий фон
- `.kb-code` фон `#111` → `#0d1b2a` (near-black navy, ITMO). Общие стили WYSIWYG: редактор сотрудника/админа и просмотр статьи.
- Файлы: `main.css`. Проверка: `/knowledge/write` и статья с блоком кода. Стейдж `:8080`. Прод не трогали.

### База знаний: редактор статей — отдельная страница + тихий FAB
- FAB карандаша на `/knowledge`: крем `#eeeee8` + чёрная рамка (лайм только на hover), по-прежнему `absolute` слева внизу внутри `.kb-page--search`.
- Клик ведёт на **`/knowledge/write`** — полноценная страница в стиле `/admin/knowledge` (редактор + списки: свои / команда; ревью руководителя на той же странице). Без оверлея поверх поиска.
- Уведомления по статьям открывают `/knowledge/write`. Путь уже в whitelist `startsWith('/knowledge/')`.
- Файлы: `pages/knowledge/write.vue`, `KnowledgeArticleWorkspace.vue`, `knowledge/index.vue`, `main.css`, `useUserNotifications.ts`, docs.
- Проверка: стейдж `/knowledge` → FAB → `/knowledge/write`; руководитель — «Проверить». Прод не трогали.

### База знаний ИИ: кейсы ecom в RAG (stub снят)
- Из PDF «сборник кейсов VBI ECOM» извлечено **11** кейсов Ecommerce (+ обзор). MD: `docs/knowledge-cases/ecom/*.md`. Исключён Грузовичкоф (логистика).
- Статьи БЗ (published, `departments: []`): `kb-case-ecom-*` + `kb-case-ecom-index`; platform-owned в `merge-knowledge-articles-seed.mjs`.
- Stub «Пока что я не умею работать с кейсами…» снят: вопросы про кейсы идут через RAG/GPT. **авто ≠ Авито** сохранён.
- Промпт продаж: 1–3 похожих подробно → короткий список других ecom → папка Bitrix кейсов. Буст хитов `applyCaseEcomScoreAdjust`.
- Проверка: `node scripts/knowledge/check-kb-cases-fallback.mjs`; `node scripts/knowledge/check-kb-auto-avito.mjs`. Стейдж `:8080` — «нужен кейс ecom, проблема с ДРР / фидом». Прод не трогали.

### База знаний: FAB карандаша внутри контента раздела
- `.kb-write-fab`: `position: absolute` внутри `.kb-page--search` (bottom-left), вместо `fixed` к viewport — круг больше не сидит на границе сайдбара.
- Правый нижний угол (кот оценки) не трогали.
- Файлы: `main.css`. Проверка: `/knowledge` — лаймовый FAB слева внизу в области контента. Стейдж `:8080`. Прод не трогали.

### Памятка Design C: шире текст + без чёрной обводки арта (art-c-v15)
- Layout: колонка copy/title на tip-слайдах уже расширена к series-c в `main.css` (не узкая лента слева); clearance до арта и CTA слева сохранены.
- Арт: с PNG снят baked black stroke/fringe (особенно tip2–3 после Black→alpha); край смягчён; горшки/текстура/cutouts сохранены. Cache-bust `?v=art-c-v15`.
- CSS: у `.pvm-illust` по-прежнему без `border`/`outline`/`box-shadow`/`filter`.
- Файлы: `postVacationMemoSlides.ts`, `public/memos/pvm-c-art-*.png` (+ layout уже в `main.css`).
- Проверка: `?pvm=tips` — tip1/tip2 шире текст, без чёрной кромки на котах. Стейдж `http://45.12.74.25:8080/?pvm=1` (hard refresh). Прод не трогали.

### База знаний: статьи сотрудников + модерация руководителя
- На `/knowledge` — FAB карандаш **слева внизу**; панель создания/правок своих статей; у руководителя — статьи прямых подчинённых и режим «Проверить» (инлайн-комментарии, Принять / На доработку / Отклонить с обязательной причиной).
- Статусы: `draft` \| `pending_review` \| `published` \| `revision_requested` \| `rejected` (legacy `review` → `pending_review`). Правка опубликованной — через `pendingRevision` (старая версия жива до Accept). RAG только `published`.
- Уведомления Vibe + Bitrix system notify (`im.notify.system.add`). Админка `/admin/knowledge` — те же действия модерации.
- Файлы: `knowledgeArticlesStore.ts`, `knowledgeNotifications.ts`, `api/knowledge/articles/*`, `KnowledgeArticleWorkspace.vue`, `useKnowledgeAuthor.ts`, `pages/knowledge/index.vue`, `pages/admin/knowledge.vue`, `useUserNotifications.ts`, docs.
- Проверка на стейдже: сотрудник Digital → FAB → статья → «На проверку»; руководитель → FAB → «Проверить» → Принять; колокольчик + Bitrix. Прод не трогали.

### Памятка Design C: текст/CTA не перекрывают котов
- Layout: масштаб арта и clear zone под series-c (не «наклейка», не наезд на лапы/горшок). Уже колонка copy на tip-слайдах; CTA-ряд слева с зазором до сцены; intro — CTA под горшком справа.
- PNG/`ART_V` не меняли. Файлы: `main.css` (`.pvm-illust*`, `.pvm-copy`, `.pvm-nav`, `.pvm-cta`).
- Проверка: localhost/`?pvm=1` и `?pvm=tips` — 6 слайдов без перекрытия текста/кнопок с артом. Стейдж `http://45.12.74.25:8080/?pvm=1` (hard refresh). Прод не трогали.

### VPN: убрана кнопка «Код ChatGPT»
- В помощнике `/vpn` больше нет чипа и ветки «Код ChatGPT» (проверка почты OpenAI). Остались только VPN и Прокси с прежними инструкциями.
- Удалён `POST /api/vpn/chatgpt-code`. Коды в Telegram (cron) без изменений.
- Файлы: `pages/vpn/index.vue`, удалён `api/vpn/chatgpt-code.post.ts`; `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/CHATGPT-TELEGRAM.md`.
- Проверка: стейдж `http://45.12.74.25:8080/vpn` и бой `http://45.12.74.25/vpn` — два чипа, без ChatGPT.

### Памятка Design C: tip2–4 cutouts + крупнее арт (art-c-v14)
- Арт: заказчикские cutouts → `pvm-c-art-tip2.png` (кот+стол/ноут), `pvm-c-art-tip3.png` (идущий кот+растение/боулинг/билет), `pvm-c-art-tip4.png` (кот+блокнот+растение). Black→true alpha; горшки и ground-band сохранены; без шахматки/рамки. welcome/intro/tip1/chip без смены ассетов.
- Layout: `.pvm-illust` увеличен под пропорции series-c (~64% ширины / ~44% высоты вместо ~46%/28% и капа ~200px); tip-copy чуть уже + больше `padding-bottom`, чтобы текст не наезжал на сцену.
- Cache-bust `?v=art-c-v14`. Файлы: `public/memos/pvm-c-art-tip{2,3,4}.png`, `postVacationMemoSlides.ts`, `main.css`.
- Проверка: `http://45.12.74.25:8080/?pvm=1` (hard refresh) — tip2–4 новый арт, коты заметно крупнее на всех слайдах. Прод не трогали.

### Памятка Design C: новые cutouts welcome/intro/tip1 + чип (art-c-v13)
- Арт: заказчикские cutouts → `pvm-c-art-welcome.png` (потягивающийся кот), `pvm-c-art-intro.png` (смотрит вправо), `pvm-c-art-tip1.png` (глаза закрыты), новый `pvm-c-art-chip.png` (кот+чемодан без растения). Black→true alpha; cream-горшки и фиолетовая ground-band сохранены. tip2–tip4 без смены.
- UI: чип/свёртка берёт `POST_VACATION_CHIP_SRC`, не welcome; у `.pvm-illust` явно без рамки; `.pvm-card__paper` — сильнее vertical linen (как series-c-01).
- Cache-bust `?v=art-c-v13`. Файлы: `public/memos/pvm-c-art-{welcome,intro,tip1,chip}.png`, `postVacationMemoSlides.ts`, `PostVacationMemo.vue`, `usePostVacationMemo.ts`, `main.css`.
- Проверка: `http://45.12.74.25:8080/?pvm=1` (hard refresh) — welcome/intro/tip1 новые позы, горшок виден, нет чёрного/шахматки/рамки; «Позже» → чип без растения. Прод не трогали.

### База знаний ИИ: отпуск Bitrix+Vibe + порядок «Ещё по теме»
- Sense отпуска отдаёт **обе** статьи аудитории: Digital → `kb-21301` + `kb-vibe-vacations-digital`; SEO → `kb-24611` + `kb-vibe-vacations-other`; остальные отделы → `kb-vibe-vacations-other`. Без слова отдела в вопросе sense берётся из `department` сессии.
- Retrieval больше не обрезает clear-sense до одной Bitrix-статьи; в контекст GPT попадают оба источника.
- «Ещё по теме»: сначала `usedSourceIds` (источники ответа), затем похожие RAG-хиты (`orderHitsForCitations` / `yandex-ask.post.ts`).
- Промпт GPT: явно просит объединять Bitrix-регламент и Vibe в один ответ.
- Eval: `expectAll` + кейсы viewer; локально `node scripts/knowledge/check-rag-vacation-dual.mjs`.
- Файлы: `knowledgeRagSense.ts`, `knowledgeRag.ts`, `knowledgeRagEvalCases.ts`, `rag-eval.post.ts`, `yandex-ask.post.ts`, `yandexGpt.ts`, `docs/PRODUCT.md`.
- Проверка на стейдже: Digital «как уйти в отпуск» → в ответе правила Bitrix и шаги Vibe; «Ещё по теме» — обе статьи первыми.

### Памятка Design C: без шахматки, горшки + тень (art-c-v12)
- Причина: на стейдже после art-c-v11 у welcome снова была видимая шахматка (baked gray/white); прошлые «anti-dust» проходы могли съедать светлые горшки.
- Арт: все 6 `pvm-c-art-*.png` пересобраны из чистого pre-dust v9 (коты/позы те же) + true alpha без checkerboard; светлые горшки сохранены/добавлены у растений (tip3/tip4 — cream pot под листьями); мягкий violet oval запечён под сценой; белая «пыль» пола убрана, чтобы тень читалась на lavender.
- Cache-bust `?v=art-c-v12`. Файлы: `public/memos/pvm-c-art-*.png`, `postVacationMemoSlides.ts`.
- Проверка: `http://45.12.74.25:8080/?pvm=1` (hard refresh) — welcome + tip1 + tip3: нет шахматки, горшок и тень видны. Прод не трогали.

### База знаний ИИ: fallback на кейсы + авто ≠ Авито
- Пока кейсы не в статьях БЗ: вопросы с «кейс/кейсы/case study» → фиксированный ответ без RAG/GPT и без «Ещё по теме».
- Текст: «Пока что я не умею работать с кейсами, но уже прохожу обучение! Скоро смогу ответить на все ваши вопросы по ним.»
- **авто ≠ Авито:** «авто/автотематика/машины» не ведут на статью Авито (`kb-30126`); «авито/avito» — маркетплейс. Lexical: целое слово «авто», без `includes` в «авторизация». Rewrite/GPT не подменяют одно другим.
- Файлы: `knowledgeAiIntent.ts`, `yandex-ask.post.ts`, `useKnowledgeAiAnswer.ts`, `knowledgeRagSense.ts`, `knowledgeRagLexical.ts`, `knowledgeRag.ts`, `knowledgeRagRewrite.ts`, `yandexGpt.ts`, `docs/PRODUCT.md`.
- Проверка: `node scripts/knowledge/check-kb-cases-fallback.mjs`; `node scripts/knowledge/check-kb-auto-avito.mjs`; чат «где взять кейс по авто тематике?» → точный fallback, без ссылки на Авито-специалистов.

### Памятка Design C: горшки + тень в PNG (art-c-v11)
- Причина: pass art-c-v10 (убрать белую пыль) вместе с пылью стёр светлые горшки; CSS `drop-shadow` на lavender почти не читался.
- Арт: восстановлены светлые горшки у растений на всех 6 `pvm-c-art-*.png` из pre-v10 (art-c-v8), без перерисовки котов; в PNG запечён мягкий violet oval под группой; бумажная текстура сохранена.
- CSS: слабый `filter: drop-shadow` у `.pvm-illust` снят (тень в растре). Cache-bust `?v=art-c-v11`.
- Файлы: `public/memos/pvm-c-art-*.png`, `postVacationMemoSlides.ts`, `main.css`.
- Проверка: `http://45.12.74.25:8080/?pvm=1` (hard refresh) — welcome + tip1 + tip3: горшок и тень видны. Прод не трогали.

### Памятка Design C: текстура, тень, кнопки, регистр заголовка
- Бумага: сильнее vertical linen на `.pvm-card__paper` (noise + зерно).
- Тень: с PNG убрана белая пыль под лапами; под `.pvm-illust` — soft violet `drop-shadow` (кот/пропсы те же).
- Кнопки: «Прочитать»/«Дальше»/«Спасибо» и «Позже»/«Назад» ~4px компактнее; у CTA тонкая обводка `1px`.
- Арт: небольшой inset от правого края (`right: 2.5–3.5%`), без агрессивного сдвига от кнопок.
- Tip 3: «свежим взглядом» вместо ALL CAPS `СВЕЖИМ ВЗГЛЯДОМ`.
- Cache-bust `?v=art-c-v10`. Файлы: `main.css`, `postVacationMemoSlides.ts`, `public/memos/pvm-c-art-*.png`.
- Проверка: `http://45.12.74.25:8080/?pvm=1` (hard refresh) — welcome + tip «свежим взглядом».

### Памятка Design C: прозрачный арт + clearance CTA
- Арт: убран baked-in checkerboard на всех 6 `pvm-c-art-*.png` — true alpha, только кот+пропсы.
- Layout: `--pvm-art-bottom`, nav `max-width` слева, арт уже и выше CTA — «Прочитать»/«Дальше» не наезжают на иллюстрацию.
- Cache-bust `?v=art-c-v9`. Файлы: `main.css`, `postVacationMemoSlides.ts`, `public/memos/pvm-c-art-*.png`.
- Проверка: `http://45.12.74.25:8080/?pvm=1` (hard refresh) — welcome + intro + tip1–4.

## 2026-08-26

### Памятка Design C: кнопки не перекрывают арт + горшки
- Layout: у `.pvm-illust` `bottom: var(--pvm-art-clearance)` (72px) — арт выше полосы CTA; уменьшены `max-height`/`width`, у `.pvm-nav` `min-height`. Кнопки Дальше/Спасибо/Прочитать не наезжают на кота/чемодан/растение.
- Арт: на всех 6 `pvm-c-art-*.png` растения в белом/светлом горшке (как series-c). Cache-bust `?v=art-c-v8`.
- Файлы: `main.css` (`.pvm-*`), `postVacationMemoSlides.ts`, `public/memos/pvm-c-art-*.png`.
- Проверка: `http://45.12.74.25:8080/?pvm=1` (hard refresh) — welcome + intro + tip1–4. Прод не трогали.

### Памятка Design C: перенос переделан (арт + вёрстка)
- Перенос Design C переделан: чистые сцены `pvm-c-art-*.png` (кот+пропсы, без текста в растре), UI в Vue.
- Табы 1–5 декоративные (`pointer-events: none`): inactive — белый квадрат цифры, вокруг прозрачно; active — lavender + белая цифра, слит с карточкой.
- Overlay слабее: `rgba(…,0.14)` + `blur(2.5px)`. Пропорции card AR series-c, Unbounded, «С возвращением!» nowrap, lime pills.
- Cache-bust `?v=art-c-v7`. Flow без изменений (welcome / Позже→чип / intro / tips, `?pvm=1`).
- Файлы: `PostVacationMemo.vue`, `postVacationMemoSlides.ts`, `.pvm-*` в `main.css`, `docs/PRODUCT.md`.
- Проверка: `http://45.12.74.25:8080/?pvm=1` (hard refresh). Прод не трогали.

### Памятка Design C: арт и вёрстка 1:1 с series-c
- Проблема: на стейдже layout кривой, в растре артефакты текста («ся позже»), кропы не совпадали с эскизами.
- Арт с нуля (только сцена кот+пропсы, без UI/текста): `/memos/pvm-c-art-welcome.png` … `pvm-c-art-tip4.png`. Старые `pvm-c-*.png` больше не используются.
- Вёрстка: AR карточки как series-c (879∶1279), lavender `#c9bddc`, paper grain, табы (active слит / inactive белый квадрат, `pointer-events: none`), kicker lime, Unbounded + titleLines, «С возвращением!» nowrap, footer Позже/Прочитать и Назад/Дальше/Спасибо.
- Overlay: `blur(2px)` + лёгкое затемнение.
- Файлы: `PostVacationMemo.vue`, `postVacationMemoSlides.ts`, `.pvm-*` в `main.css`, `docs/PRODUCT.md`.
- Проверка: localhost/`?pvm=1` и `http://45.12.74.25:8080/?pvm=1` — сверка с `docs/design-refs/post-vacation-memo/series-c-01…06`.

### Памятка после отпуска: Design C на стейдже
- UI: lavender folder-карточка, paper texture (CSS), иллюстрации Vibe отдельно от текста (`/memos/pvm-c-welcome.png` … `pvm-c-tip4.png`).
- Табы 1–5 только визуал (`pointer-events: none`); welcome/intro → 1, tip1–4 → 2–5; неактивные — белый квадрат, вокруг прозрачно.
- Overlay: слабее затемнение + `blur(3px)` (страница читается за карточкой).
- Flow без изменений: **Прочитать** → советы без intro; **Позже** → чип → intro → 4 совета. Превью `?pvm=1`.
- Файлы: `PostVacationMemo.vue`, `postVacationMemoSlides.ts`, `.pvm-*` в `main.css`, `docs/PRODUCT.md`.
- Проверка: `http://45.12.74.25:8080/?pvm=1` — табы не кликаются, CTA работают; Позже → чип → tips.

### Памятка: cover на стейдже + направления ITMO
- Факт: `post-vacation-cover.png` на стейдже `:8080` уже = очки+пальма (sha256 `b2176025…`, 1 105 111 байт = `sketch-old-cat-glasses-palm.png`). Прод `:80` пока старый (916 172).
- Cache-bust: `postVacationMemoSlides.ts` → `?v=glasses-palm` на welcome/intro, чтобы браузер не держал старый PNG по тому же URL.
- Арт-дирекшн (эскизы, без внедрения UI): `docs/design-refs/post-vacation-memo/direction-itmo-frame-card.png`, `direction-modern-type-card.png`, `direction-sticker-in-itmo-scene.png`.
- Проверка: `http://45.12.74.25:8080/memos/post-vacation-cover.png` — Content-Length 1105111; `?pvm=1` hard refresh.

### Памятка: cover — кот в очках + пальма
- Product cover welcome/intro: `frontend/public/memos/post-vacation-cover.png` ← эскиз `sketch-old-cat-glasses-palm.png` (очки на лбу, пальма, лайм-тень).
- Эталон: `docs/design-refs/post-vacation-memo/cover.png`. Пути в `postVacationMemoSlides.ts` без смены (`/memos/post-vacation-cover.png`).
- Проверка: стейдж `?pvm=1` — welcome и intro с новым артом.

### База знаний ИИ: уточнения в диалоге («ещё другие», «это все?»)
- Симптом: после списка программатиков вопрос «напиши ещё другие…» → отказ «только по Базе знаний».
- Причина: follow-up не распознавался (`isKbClarifyingFollowUp`), «программатик» не был workplace-hint → RAG/модель без склейки с темой; модель ставила OFFTOPIC на «другие».
- Фикс: шире детект уточнений + workplace (programmatic/контакты…); склейка с прошлым вопросом уходит в GPT; retry/guard против ложного OFFTOPIC при живом RAG; клиент не принимает OFFTOPIC на уточнении в треде.
- Файлы: `knowledgeAiIntent.ts`, `yandex-ask.post.ts`, `yandexGpt.ts`, `useKnowledgeAiAnswer.ts`, `scripts/knowledge/check-kb-dialog-followup.mjs`.
- Проверка: `node scripts/knowledge/check-kb-dialog-followup.mjs`; на стейдже чат — программатики → «это все?» → «напиши ещё другие…» (дописать остаток или «в статье больше нет», не шаблонный отказ). Погода/анекдот по-прежнему отказ.

### База знаний ИИ: DayOfff + акты РП + списания AFINA
- DayOfff: sense до hard-якорей (взять → отгул `kb-30077`, войти → SaaS `kb-27877`, неясно → два ответа); синоним «дейоф» ↔ dayofff; нарезка разделов SaaS.
- Акты (`kb-31980`): интент «акты / YDirect / VKR» не уводит в «Контакты»; секции Яндекс / VKR / Add Cost SMM; `INDEX_VERSION = 6`.
- Списания (`kb-28468`): «списания в afina» больше не sense-доступы; якоря Прочее (PPC) / доп.расходы SMM / комментарии.
- Регрессия: Контакты / доступы / UTM сохранены. Проверка: `node scripts/knowledge/check-rag-dayoff-acts-writeoffs.mjs`, `check-rag-access-utm.mjs`.

### Памятка: cover welcome — 310×340 + padding-bottom 100
- `.pvm-visual--welcome .pvm-cover`: ширина **310px**, высота **340px** (`border-box`), **padding-bottom: 100px** (контент 240px). Как в DevTools-эталоне.
- Проверка: `?pvm=1` — кот+чемодан, снизу 100px поля до «С возвращением!».

### База знаний: отпуска в Vibe — две статьи
- Общую `kb-vibe-vacations` («Всем») сняли. Вместо неё:
  - `kb-vibe-vacations-digital` — только Digital (двухэтапное согласование, лимиты на месяц);
  - `kb-vibe-vacations-other` — остальные отделы, без этих пометок.
- Merge на деплое удаляет retired id и обновляет платформенные Vibe-статьи из сида (`merge-knowledge-articles-seed.mjs`).
- Проверка: сотрудник Digital видит только Digital-статью; SEO/DEV и др. — «Отпуска в Vibe» без лимитов и двух этапов.

### Памятка: welcome — полный текст + cover 340×340
- Вернули приветственный абзац; блок советов без «о том»; cover welcome/intro зафиксирован **340×340** (кот+чемодан). Проверка: `?pvm=1`, `?pvm=tips`.

### Памятка после отпуска: welcome доведён
- Welcome: crop кота+чемодана (`object-fit: contain`, `object-position: center bottom`); текст двух фраз без «о том».
- **Прочитать** → сразу совет 1; вводная «Вот четыре совета» только после **Позже** (чип / `?pvm=tips`), арт — тот же `post-vacation-cover.png` (не дракон).
- Последний совет: «идеално» дословно по ТЗ.
- Файлы: `postVacationMemoSlides.ts`, `usePostVacationMemo.ts`, `PostVacationMemo.vue`, `main.css`.
- Проверка: `?pvm=1` → Прочитать / Позже+чип; `/vacations?pvm=tips`.

### База знаний: статьи про разделы Vibe (отпуска, банк идей)
- В `server/data/knowledge-articles.json` опубликованы общие статьи: `kb-vibe-vacations` («Отпуска в Vibe»), `kb-vibe-ideas` («Банк идей в Vibe»).
- Текст из `docs/PRODUCT.md` (заявка vs бронь, этапы, баланс; этапы идей; топ-5 авторов только по реализованным `done`).
- При деплое подхватываются merge-seed’ом (`merge-knowledge-articles-seed.mjs`).
- Проверка: статьи в `/knowledge` и `/admin/knowledge`; чат ИИ — «как оформить отпуск в вайбе», «что такое бронь», «как пользоваться банком идей».

### База знаний ИИ: доступы (AFINA / гостевые / ОП) + регламент UTM
- Sense «доступы»: «как зайти в афину» без слова «доступ»; гостевой+Директ → гостевые (не ambiguous); clear sense оставляет **одну** статью в контексте.
- UTM (`kb-23420`): короткий якорь `utm` больше не отбрасывается; интент UIS/Roistat/Calltouch → регламент тегирования, не Контакты/гостевые; нарезка секций коллтрекинга; lookalike `Calltouсh`; вопрос «когда … Calltouch» поднимает блок «обязательно размечать», не шаблоны РК; отказ «нет прямого ответа…» с фактами дальше не обнуляет citations; `INDEX_VERSION = 5`.
- Файлы: `knowledgeRag.ts`, `knowledgeRagLexical.ts`, `knowledgeRagSense.ts`, `knowledgeRagEvalCases.ts`, `yandex-ask.post.ts`, `yandexGpt.ts`, `scripts/knowledge/check-rag-access-utm.mjs`.
- Проверка: `node scripts/knowledge/check-rag-access-utm.mjs`; на стейдже чат под Драго — вопросы по доступам и UTM.

## 2026-08-25

### База знаний ИИ: починка индекса + якоря секций «Контактов»
- **Регрессия:** в `ed7e4a9` случайно удалили `INDEX_FILE` / `INDEX_VERSION` → RAG-индекс не читался/не писался, чат уходил в lexical fallback («в базе нет», DayOfff/маркетплейсы в цитатах).
- Восстановлены константы индекса; `INDEX_VERSION = 4` (новая нарезка).
- `stripHtml` снова **сохраняет переносы строк** — иначе шапки «Дизайнеры» / «Юристы» схлопывались и `rareTokenHeadingHits` всегда был 0.
- Нарезка секций обобщена (не только `Programmatic`): юристы, бюро переводов, дизайнеры, Яндекс Менеджер, Google 360, Click.ru, наружка.
- Якорь секции Контактов (в т.ч. «Менеджер Яндекса») → только `kb-20409`.
- Файлы: `knowledgeRag.ts`, `knowledgeRagLexical.ts`, `scripts/knowledge/check-rag-contacts.mjs`.
- Проверка: `node scripts/knowledge/check-rag-contacts.mjs`; после деплоя стейджа — переиндекс (cron/admin) и 6 вопросов чата под Драго.

### Telegram: текст поста с кодом ChatGPT
- Шаблон: «Кто просил код от chatGPT?» + строка с кодом (`chatgptCodeTelegram.ts`).
- Env без изменений: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`|`TELEGRAM_CHANNEL_ID` (см. `.env.example`).
- Проверка: `…/api/cron/chatgpt-code-telegram?dry_run=1`; боевой пост — после chat_id на стенде.

### База знаний ИИ: якоря всех блоков «Контактов»
- «Кому писать / контакты» → только статья «Контакты» (`kb-20409`), не КЛАДОВКА/регламенты/Метрика.
- Hard retrieval обобщён: не только `Programmatic`, но юристы / Яндекс / дизайнеры / переводы / Click.ru и др. при интенте «кому писать / контакты».
- Шапка секции = короткая строка с якорем в начале или «А / Б»; регламенты дизайна/юристов и DayOfff mid-body не считаются шапкой.
- Слабые якоря (`агентства`, `менеджера`, `контакты`) уступают доменным (`яндекса`, `юристу`).
- Файлы: `knowledgeRagLexical.ts`, `knowledgeRag.ts`, `yandexGpt.ts`, `scripts/knowledge/check-rag-contacts.mjs`.
- Проверка: `node scripts/knowledge/check-rag-contacts.mjs`; на стейдже чат под Драго — 6 вопросов по Контактам.


### ChatGPT-коды → корпоративный Telegram (параллельно /vpn)
- Cron каждые ~2 мин: IMAP (те же критерии, окно ~1 ч) → `sendMessage` бота в канал.
- Дедуп: `server/data/chatgpt-code-telegram-state.json`. UI «Код ChatGPT» в `/vpn` не трогали.
- Env: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`|`TELEGRAM_CHANNEL_ID`, плюс `EMAIL_*`, `CRON_SECRET`.
- Файлы: `api/cron/chatgpt-code-telegram.post.ts`, `utils/chatgptCodeTelegram*.ts`, `telegramBot.ts`, `deploy/scripts/run-chatgpt-code-telegram.sh`, systemd timer, `docs/CHATGPT-TELEGRAM.md`.
- Проверка: `curl -X POST -H "X-Cron-Token: …" '…/api/cron/chatgpt-code-telegram?dry_run=1'`.

### База знаний: кейсы по блокам «Контактов»
- В `knowledgeRagEvalCases` — Programmatic, юристы, Яндекс, Google 360, дизайнеры, переводчики, Click.ru, наружка.
- Локальный прогон фрагментов: `node scripts/knowledge/check-rag-contacts.mjs` (без Yandex).

### VPN: кнопка «Код ChatGPT» из корпоративной почты
- В помощнике `/vpn`: приветствие «Привет! Чем я могу помочь?»; чип **Код ChatGPT** рядом с VPN/Прокси.
- Сервер читает IMAP (`EMAIL_LOGIN` + `EMAIL_PASSWORD` или `PASSWORD`), письма `noreply@tm.openai.com`, код после `Please use the following code to help verify your identity:`.
- Стек за последний час: первый запрос — самый свежий; **Код не подошёл** — предыдущий; иначе «Больше кодов не приходило» / «Код не пришёл».
- Файлы: `pages/vpn/index.vue`, `api/vpn/chatgpt-code.post.ts`, `utils/openaiChatgptMailCode.ts`. На сервере те же env.

## 2026-08-24

### База знаний ИИ: ответ на все части вопроса + контакты
- Успех: вопрос про Programmatic тянет блок из «Контактов» (площадки). Доработка промпта: отвечать на каждый вопрос в сообщении; «кому писать» → ФИО + контакт, не только названия.
- Файл: `yandexGpt.ts`.

### База знаний ИИ: Programmatic → только «Контакты»
- Ложные совпадения: разрез mid-line давал DayOfff «заголовок»; `программатик` ловился внутри `программатики` в AFINA.
- Якорь-секция = латинский `Programmatic` с начала строки; в «Ещё по теме» остаётся «Контакты». Промпт: до 5 ФИО + специализация + контакт из контекста.
- Индекс RAG v3. Файлы: `knowledgeRag.ts`, `knowledgeRagLexical.ts`, `yandexGpt.ts`.

### CI: артефакт build без 413 (картинки БЗ)
- Падение `build:staging` с `413 Request Entity Too Large` / `FATAL: too large`: в artifacts не кладём `frontend/.output/public/knowledge` (~100MB); перед деплоем подмешиваем из checkout.
- Файлы: `.gitlab-ci.yml`, `deploy/scripts/deploy-from-ci.sh`, `docs/CI-CD.md`.

### База знаний ИИ: якорь Programmatic сильнее случайного совпадения
- «programmatic» вскользь в DayOfff больше не перебивает блок Programmatic в «Контактах».
- По сильному якорю (латиница / длинное слово) сначала ищем фрагменты с заголовком секции, без семантики «расчётов→коллтрекинг».
- Файлы: `knowledgeRag.ts`, `knowledgeRagLexical.ts`. Проверка: `node scripts/knowledge/check-rag-morphology.mjs`; чат про Programmatic → «Контакты», не UTM/DayOfff.

### База знаний ИИ: длинная статья «Контакты» — ответ по нужному блоку
- Вопрос про программатики больше не уезжает в Яндекс.Метрику: из «Контактов» в контекст берётся блок Programmatic, а не первые абзацы.
- Синоним программатик ↔ programmatic; якорь запроса обязателен (писать/лучше не считаются смыслом).
- Файлы: `knowledgeRag.ts`, `knowledgeRagLexical.ts`, `yandexGpt.ts`. Проверка: `node scripts/knowledge/check-rag-morphology.mjs`; чат «какие есть программатики…» → astralab/solta/adheads/hybrid, не partners@metrika.ru.

### База знаний ИИ: «привет» больше не ищет статьи
- Приветствие не уходит в RAG: `\b` в JS не ловит кириллицу, «привет» склеивалось с «приветствие» в регламенте писем.
- Стеммер не считает общей основой разные лексемы с общим началом (привет ≠ приветствие); увольнение/уволиться по-прежнему находятся.
- Файлы: `knowledgeAiIntent.ts`, `yandex-ask.post.ts`, `knowledgeRagLexical.ts`. Проверка: `node scripts/knowledge/check-rag-morphology.mjs`; чат «привет» → «Здравствуйте!…», без статьи про письма.

### База знаний открыта на проде
- Снят замок с `/knowledge` и `/admin/knowledge` в пилоте `LAUNCH_SCOPE=vacations` (меню без «Скоро»).
- Файл: `useLaunchScope.ts`. Проверка: бой `http://45.12.74.25/knowledge` — раздел открывается; остальные черновики по-прежнему с замком.

### Админка базы знаний: картинки в редакторе можно растянуть
- В WYSIWYG клик по картинке — ручка, ширина с сохранением пропорций.
- Файл: `KnowledgeWysiwygEditor.vue`.

### База знаний ИИ: поиск по словоформам
- Словесный слой RAG сравнивает основу слова, не только точное вхождение: «уволиться» находит «увольнение».
- Фильтр «значимых слов» больше не отбрасывает семантический hit из‑за другой формы.
- Файлы: `knowledgeRagLexical.ts`. Проверка: `node scripts/knowledge/check-rag-morphology.mjs`.

### База знаний ИИ: «как уволиться» = увольнение
- Синонимы: уволиться / уволится / хочу уволиться / процесс увольнения → статьи про увольнение.
- Файлы: `knowledgeRagLexical.ts`, `knowledgeAiIntent.ts`, `knowledgeRagEvalCases.ts`.
- Проверка: `node scripts/knowledge/check-rag-rewrite-safety.mjs`; чат «как уволиться» → не «нет в базе», а статьи про увольнение.

### База знаний ИИ: «Структура» ведёт на сотрудницкую схему
- В «Ещё по теме» ссылка **Структура** всегда `/organization`, даже если спрашивает admin/HR (не `/admin/organization`).
- Файл: `yandex-ask.post.ts`. Проверка: чат → «кто руководит…» → клик «Структура» → `/organization`.

### База знаний ИИ: Bitrix-квадратик у ФИО
- В ответах про людей (руководитель отдела / «кто такой …») сразу после ФИО — квадратик ↗ в профиль Bitrix (как в визитке).
- Файлы: `knowledgeOrgAnswer.ts`, `useKnowledgeAiAnswer.ts`, `knowledge/index.vue`, `main.css`.
- Проверка: «кто руководит отделом разработки» → Музыка Сергей + ↗; «кто такой Ревзина» → ФИО + должность + ↗.

### База знаний ИИ: руководители отделов из Структуры
- Вопросы «кто руководит…», гендир, состав отдела — ответ из `org-structure.json` (не из статей RAG).
- В «Ещё по теме» — ссылка **Структура** (`/organization`; с 2026-08-24 не админка).
- Файлы: `knowledgeOrgAnswer.ts`, `yandex-ask.post.ts`, `useKnowledgeAiAnswer.ts`, `knowledge/index.vue`.
- Проверка: `python3 frontend/scripts/check-knowledge-org-answer.py`; в чате «кто руководит отделом разработки» → Музыка Сергей + ссылка Структура (не Новоторцева).

### Памятка: старый кот снова на «С возвращением!»
- Welcome: `/memos/post-vacation-cover.png`. Вводная «Вот четыре совета»: `/memos/post-vacation-cover-dragon-awake.png`.
- Файл: `postVacationMemoSlides.ts`. Проверка: `?pvm=1` — на первой карточке прежний кот, на intro — текущий арт советов.

### База знаний: HTML-статьи без «сырого кода» ссылок
- Причина: редактор считал Bitrix-тело без `<p>`/`<div>` маркдауном и экранировал `<a>`/`<br>` → на странице статьи теги как текст.
- Фикс: детект inline-HTML + раскодирование `&lt;…&gt;` при чтении; сид обёрнут в `<div>`; merge на деплое обновляет экранированные `body`.
- Файлы: `knowledgeArticleHtml.ts`, `KnowledgeWysiwygEditor.vue`, `knowledge-articles.json`, `merge-knowledge-articles-seed.mjs`.
- Проверка: `/knowledge` → «Чек-листы» — кликабельные ссылки, без видимых `<a href=…>`.

### Банк идей: «Удалить» только у автора (вид сотрудника)
- На `/ideas` кнопка «Удалить» только у своей идеи. Админ в режиме сотрудника чужие не удаляет.
- Чужие идеи снимает admin/HR на `/admin/ideas`.
- Проверка: зайти сотрудником (или админом в режиме «Сотрудник») → у карточки Малковой нет «Удалить»; у своей — есть.

### Уведомления: «прочитано» больше не сбрасывается + вложения идей
- Админ-колокольчик: после «прочитано» синк Bitrix / повторный вход не создаёт ту же запись заново.
- Сотрудник: mark/list учитывает все id сессии (bitrix/platform), иначе `seen` не писался.
- Банк идей: файл реально сохраняется (`server/data/idea-attachments/`); плашка «файл» открывает его. Старые идеи с одним именем — загрузка в админке.
- Проверка: отметить уведомление → выйти/войти → остаётся прочитанным; идея с файлом → клик «файл» открывает.

### Отпуска: лимит группы считает бронь и заявку вместе
- Слот месяца в Digital/QA: бронь **или** заявка (`pending`/`approved`) на этот месяц. 1 человек в подгруппе, 5 на отдел.
- Раньше заявка проходила поверх чужой брони в той же группе.
- Существующие записи не трогали.
- Файлы: `vacationReservationCaps.ts`, `vacationReservationCapMutations.ts`, `vacationRequestMutations.ts`, `EmployeeVacationPanel.vue`.
- Проверка: `node frontend/scripts/test-vacation-reservation-caps.mjs`; коллега с бронью на месяц → `+бронь` серая и новая заявка на этот месяц отклоняется.

## 2026-08-21

### База знаний ИИ: не клеить чужие статьи к «нет в базе»
- «Дни рождения клиентов» есть в AFINA (`ДР клиентов` в kb-20520); раньше семантика тянула поступления/отчёты по слову «клиент».
- Retrieval: синонимы ДР + фильтр по значимым словам запроса; если модель пишет «нет информации» — цитаты не отдаём.
- Проверка: `/knowledge` → «где могу посмотреть дни рождения клиентов?» → AFINA / меню ДР, без блока про поступления.

### База знаний ИИ: рабочие вопросы снова в поиск

- Убран whitelist «нет ключевых слов → OFFTOPIC» (ломал эйчар/клиенты/Афина).
- В оффтоп до RAG — только явный мусор (коты, наркотики, погода…).

### База знаний ИИ: память уточнений снова работает

- «а ещё?» / «а какие ещё изменения?» не режем как оффтоп, если в истории был рабочий вопрос.
- RAG ищет по склейке «прошлый вопрос + уточнение».

### База знаний ИИ: оффтоп без «допишите статью»

- Нерабочие вопросы (коты, покупки, наркотики, «люблю…») → OFFTOPIC, без CTA про статьи/HR.
- «Нет в базе» для рабочих тем — только факт, без предложения дописать (при сомнении не предлагаем).

### База знаний ИИ: привет без Yandex + троттлинг embeddings

- «привет / как дела» — локальный chitchat, без RAG (раньше уходило в Yandex → 429 → «перекур»).
- Embeddings: очередь ~120 мс + retry на 429 (лимит 10 req/s).

### Вход по паролю Vibe (локальные хеши, без Bitrix)

- Паролей Bitrix на Vibe **нет** и не было — только демо `*.vbi.local` и OAuth.
- Новый файл `server/data/vibe-passwords.json` (scrypt): HR задаёт пароль в Админ → Сотрудники (🔑).
- `POST /api/auth/vibe-login` сравнивает ввод с хешем и выдаёт cookie-сессию Vibe. Портал не вызывается.
- Кнопка «Войти через Битрикс24» остаётся запасным путём.

### Вход логин/пароль Bitrix без правок портала + авто-RAG после деплоя

- Форма на экране входа → `POST /api/auth/bitrix-password` → OAuth `grant_type=password` на уже существующий `/oauth/token/` → cookie-сессия **Vibe** (без PHP/модулей на crm.vbi.ru).
- Если портал не отдаёт password grant — кнопка «Войти через Битрикс24» остаётся; выключить форму: `BITRIX_PASSWORD_LOGIN=0`.
- После деплоя: Nitro warm-plugin + `deploy-scripts/run-knowledge-rag-reindex.sh` (CRON_SECRET, localhost).
- Cron/imbot stub остаются «открытыми» осознанно: cron — секрет + обычно loopback; imbot — Bitrix бьёт в URL без cookie Vibe.
- Колокольчик у ~11 учёток: без правок портала / моста не чинится; в Vibe уведомление есть, админу — алерт при FAIL.

### База знаний: явный ответ «нет в базе» + приглашение дописать

- Не путать с offtopic (погода/шутки). Текст предлагает дописать статью или написать HR.
- Аудит доступа: UI без логина не открывается; бизнес-API под сессией (исключения: auth, cron+секрет, stub imbot).
- При FAIL колокольчика Bitrix у согласующего — алерт админу (в Vibe уведомление уже есть). Корневой фикс — мост `vbihr|vacation`.

### База знаний: память диалога, отделы, перекур при сбое ИИ

- Небольшая память чата (последние реплики) уходит в `yandex-ask`.
- Видимость статей по отделам (общие = всем; иначе только свой отдел); шильдики ITMO; правка в админке.
- При сбое Yandex: алерт админу + текст «Бот ушёл на перекур…» и упрощённый ответ.
- Доп. двусмысленности: доступы (AFINA / гостевые / продажи), отпуск Digital vs SEO.

### База знаний: «дейоф» — по смыслу вопроса (отгул | SaaS), при сомнении два ответа

- `knowledgeRagSense`: «взять дейоф» → отгул; «войти в дейоф» → DayOFFF; неясно → два ответа.
- Не жёсткий синоним dayoff=отгул; смотрим общий смысл фразы.

### База знаний: DayOff ≠ отгул в синонимах RAG

- DayOFFF / дейоф — внутренний SaaS (`kb-27877`); отгул — отдельная статья (`kb-30077`). В `knowledgeRagLexical` группы разведены.

### База знаний: гибрид смысл+слова и осторожная переформулировка

- Retrieval для ИИ: cosine + словесный score; синонимы и нейро-rewrite только если `isRewriteSafe` (не уводит тему).
- Кейсы на перефразах + `POST /api/admin/knowledge/rag-eval`; локально `scripts/knowledge/check-rag-rewrite-safety.mjs`.
- Сниппеты в UI не добавляли; фильтр по отделам — позже жёстким разделением данных.

### База знаний: RAG — поиск по смыслу для «Спросить ИИ»

- **Продуктовое правило:** ИИ подбирает статьи по смыслу вопроса, не по совпадению слов (см. PRODUCT §10.0).
- Эмбеддинги Yandex Cloud (`emb://…/text-search-doc|query`), индекс чанков на сервере, контекст собирается в `yandex-ask` (клиент не шлёт сырой context).
- Классическая вкладка «Поиск» пока по словам.
- Файлы: `yandexEmbeddings.ts`, `knowledgeRag.ts`, `yandex-ask.post.ts`, `useKnowledgeAiAnswer.ts`.

### База знаний: длинные заголовки в админ-редакторе не обрезаются

- Причина: однострочный `input` в колонке `max-width: 720px` — хвост названия уезжал за край поля.
- Заголовок — `textarea` с автовысотой и переносом; колонка редактора на всю ширину карточки.
- Файлы: `admin/knowledge.vue`, `main.css`.

## 2026-08-20

### База знаний: «Спросить ИИ» слева и по умолчанию

- На `/knowledge` вкладки: **Спросить ИИ** | Поиск; старт в режиме ИИ.
- Файл: `pages/knowledge/index.vue`.

### База знаний: убраны пустые разделы меню Bitrix

- Из сида удалены `kb-2890` / `kb-2982` (пустой `<h2>`, не статьи) — в UI было 177 из‑за фильтра `title`.
- Migrate пропускает такие записи. В сиде теперь **177** статей.

### База знаний: полный перенос статей из Bitrix `/devs/`

- Скрапинг дерева меню `/devs/` → `knowledge-articles.json` + картинки в `frontend/public/knowledge/article-*/` (после чистки пустых разделов — 177).
- Скрипты: `scripts/bitrix/scrape-devs-articles.mjs` (все ссылки из меню / `--only-missing`), `migrate-devs-to-knowledge.mjs` (body без chrome, локальные PNG).
- На **проде** раздел `/knowledge` по-прежнему с замком (`LAUNCH_SCOPE=vacations`); данные и код уже на бой для открытия позже.
- Проверка на стейдже (`:8080`): `/knowledge` — ~179 статей, картинки открываются.

### База знаний: починка картинок в статьях

- **Причина:** после миграции HTML ссылался на `/knowledge/article-*/…`, но папки с PNG лежали только локально (untracked) и не попали в git → на стейдже 404. Merge сида не перезаписывал `body` у уже существующих статей.
- В репозиторий добавлены ассеты `frontend/public/knowledge/article-{20409,20520,22925,27095,27877}/`.
- Из тел статей убран мусор Bitrix (`<link>`/`<script>` на `/devs/asset/...`).
- Merge на деплое: `merge-knowledge-articles-seed.mjs` обновляет `body`/`coverImage`, если в сиде есть локальные `/knowledge/article-…` или на сервере остался chrome `/devs/asset/`.
- Правило: картинки статей **всегда коммитить** вместе с правкой `knowledge-articles.json`; иначе пути в HTML есть, файлов на стенде нет.
- Проверка: статья с картинками на `:8080` (например AFINA / DayOff) — PNG открываются, не 404.

### База знаний: тон и структура ответа ИИ (этап 4)

- Промпт: вежливо, по делу, без воды; без «открой статью» / «если нужно уточнение».
- Формат пузыря: ответ модели → пустая строка → `Ещё по теме:` + кликабельные статьи через запятую.
- «Ещё по теме» для ИИ строже обычного поиска: нужно совпадение нескольких слов запроса / сильный score (чтобы «контакты» в чужой статье не тянуло SEO/ОП).
- Chitchat («спасибо», «отлично») → короткий ответ без статей; оффтоп (погода и т.п.) → отказ «только по Базе знаний», **без** блока «Ещё по теме» (фикс детекта кириллицы).
- Грубость / «ты не то говоришь» → «Прошу прощения, уточните вопрос…», без статей.
- Бессмыслица («мяу») и пустой поиск по базе → тот же отказ, что на оффтоп; без подстановки случайной статьи.
- Чат ИИ: автоскролл к новому ответу; пока ищет — волна из 3 фиолетовых кружков слева.
- Файлы: `yandexGpt.ts`, `useKnowledgeAiAnswer.ts`, `useKnowledgeAiChat.ts`, `knowledge/index.vue`, `knowledgeAiIntent.ts`, `knowledgeSearch.ts`, `main.css`.

### База знаний: Yandex GPT выкачен на стейдж

- Endpoint `POST /api/knowledge/yandex-ask` + `yandexGpt.ts`; чат «Спросить ИИ» зовёт модель, при ошибке — шаблонный ответ.
- Env: `YANDEX_GPT_FOLDER_ID`, `YANDEX_GPT_API_KEY` (или IAM), опционально `YANDEX_GPT_MODEL_URI`.
- Проверка: `/knowledge` на `:8080` → «Спросить ИИ».

### VPN: Бельгия Ahost (`188.190.10.62`)

- AmneziaWG: `http://188.190.10.62:51821` (UDP 51820). WireGuard: `http://188.190.10.62:51831` (UDP 51830).
- Хостинг — **Ahost**. Из Vibe выдаём только с этого сервера.
- Имена пиров: WireGuard и AmneziaWG — `Фамилия_Belg_Ahost`; второй Amnezia — `_2`.
- Миграция ключей на Бельгию; учёт в `vpn-keys.json` обновлён. Кому нужен свежий конфиг — заново скачать из `/vpn`.
- Env: `WG_EASY_*`, `AWG_EASY_*`. Файлы: `vpnKeysStore.ts`, `wgEasyClient.ts`, rule `vpn-key-limits.mdc`.

## 2026-08-19

### База знаний: Yandex GPT в чате по статьям

- Подключен Yandex GPT в режиме чата «Спросить ИИ» по базе знаний (серверный вызов Yandex Cloud Foundation Models).
- Добавлен endpoint: `POST /api/knowledge/yandex-ask` (текст вопроса + контекст статей → ответ нейронки с цитированием).
- Требуемые env (в `.env`): `YANDEX_GPT_FOLDER_ID` и `YANDEX_GPT_IAM_TOKEN` или `YANDEX_GPT_API_KEY`. `YANDEX_GPT_MODEL_URI` опционален (по умолчанию `gpt://<folderId>/yandexgpt-lite`).
- Пока без тяжёлых файлов (этап 3 запускается с “лёгкого текста” и подготовкой пайплайна).

## 2026-08-18

### Редактор статей: на проверку, без черновика и тегов

- `/admin/knowledge`: нет выбора «Черновик» и поля тегов. **Сохранить** → статус «На проверке»; админ публикует кнопкой «Опубликовать».
- Пустая цитата или пустой блок кода удаляются вместе с рамкой.
- Каркас как карточка ITMO: зерно `#e4e4de`, крупные скругления, чипы инструментов (лайм только на акцентах: «Опубликовано», спойлер, hover копирования).
- Панель: пилюля «Заголовок» (H2–H4), «Список» (• / 1.), курсив «к», подчёркивание U. Спойлер мерцает спокойнее; у кода иконка копирования. После цитаты/заголовка/кода есть абзац, чтобы писать дальше. «Сохранить» в одном ряду с инструментами, панель закреплена при скролле.
- Ссылка: ПКМ / ⌘K → «Добавить ссылку» → окно Текст/URL. URL читается из буфера в тот же жест клика; поле сразу выделено.
- Sticky-панель инструментов: `top` = высота фиолетовой шапки (69px), до кнопок 14px, как на эталоне.
- Файлы: `pages/admin/knowledge.vue`, `KnowledgeWysiwygEditor.vue`, `useAdminKnowledge.ts`, `knowledgeArticlesStore.ts`, API `admin/knowledge`.
- Проверка: localhost `/admin/knowledge` → скопировать https-ссылку → выделить слово → ПКМ «Добавить ссылку» или ⌘K.

### Админ может поставить отпуск групхеду при пересечении с другим ГХ

- Правило «не два групхеда в одни даты» остаётся для сотрудников. Админ системы сохраняет заявку в обход.
- Проверка: `/admin/vacations` → Добавить отпуск (например Носков 20–21 авг, если другой ГХ уже в отпуске).

### Админка базы знаний: ширина и правки редактора

- Каркас редактора на всю ширину контента, колонка текста по центру.
- После сохранения статья остаётся открытой, статус «сохранено» больше не сбрасывается.
- Можно печатать пробел в заголовке и лиде (убран `v-model.trim`). Есть предупреждение про несохранённое, ошибка загрузки списка, копирование кода и спойлер.
- Проверка: `http://45.12.74.25:8080/admin/knowledge`

### Админка: WYSIWYG базы знаний как на Хабре

- Убран верхний блок-дубль «База знаний». Статья пишется как на Хабре: крупный заголовок, вводный абзац, визуальный редактор.
- Спойлер скрывает текст до клика (как в Telegram). Блок кода — тёмный, с кнопкой «Копировать» (как в Cursor).
- Тело статьи хранится HTML. Компонент: `KnowledgeWysiwygEditor.vue`.
- Проверка: `http://45.12.74.25:8080/admin/knowledge` (под админом).

## 2026-08-17

### Админка: редактор базы знаний (`/admin/knowledge`)

- Для админа добавлен CRUD-экран статей базы знаний: создать, редактировать, удалить, статусы draft/published.
- Экран заточен под тест шаблонов и инструментов текстового редактора (markdown-snippets: H2, список, ссылка, заметка), без пользовательского поиска.
- Серверное хранилище: `frontend/server/data/knowledge-articles.json`; API: `GET/POST /api/admin/knowledge`, `PATCH/DELETE /api/admin/knowledge/:id`.
- Проверка: `http://45.12.74.25:8080/admin/knowledge` (под админом).

### Памятка: дракон с чемоданом, не спящий из уведов

- «С возвращением» и вводная: тот же карандашный дракон, но бодрствует и сидит на чемодане. Спящую позу из empty-state уведомлений больше не копируем.
- Проверка: `?pvm=1`.

### Памятка: дракончик с уведомлений

- «С возвращением» и вводная: тот же карандашный дракон, что empty-state уведомлений (`notifications-empty-dragon.png`).
- Проверка: `?pvm=1`.

### Памятка: кот как дракончик в уведомлениях

- Вводная и «С возвращением»: полосатый кот на фиолетовом чемодане, карандаш, широкий кадр чтобы чемодан не обрезался.
- Проверка: `?pvm=1`.

### Памятка: вводная карточка в карусели

- Из чипа и «Прочитать» карусель начинается с «Вот четыре совета» (кот на чемодане), не сразу с первого совета.
- Проверка: `?pvm=1` → Позже → чип → открыть.

### Памятка: слайд про выходные

- Текст «маленький отпуск»: кино, боулинг или прогулка. Без тире.
- Проверка: `?pvm=1` → Прочитать, 3-я карточка.

### Памятка: тексты советов заказчика, цветок и «Спасибо»

- Четыре слайда карусели по формулировкам заказчика (опечатки поправлены: отпуск, режима, моменты, составь).
- На слайде про стол: маленький суккулент как у кота, лайм и фиолетовый горшок.
- На последнем слайде вместо стрелки кнопка «Спасибо».
- Проверка: `?pvm=1` → Прочитать.

### Памятка: стикеры карусели без серого холста

- У советов был запечённый серый фон (как шахматка Photoshop) поверх фиолетовой шапки. Вырезал, PNG с настоящей прозрачностью.
- Проверка: `?pvm=1` → Прочитать, слайд «Войди в ритм плавно»: вокруг кота видна геометрия, не прямоугольник.

### Памятка: «С возвращением!», Позже / Прочитать

- Заголовок с «!». Текст обложки обновлён; вместо эмодзи — лаймовое сердце ITMO (обводка, сдвиг).
- Слева внизу: **Позже** (чип в угол) и **Прочитать** (сразу карусель).
- Проверка: `?pvm=1`.

### Памятка: кот не перекрывает текст, полёт по дуге без рывка

- Обложка больше не выезжает на абзацы: картинка в верхней зоне, текст читается целиком.
- Дуга в угол: плавная кривая без overshoot и без рывка в конце (`transition` на transform во время полёта выключен).
- Проверка: `?pvm=1` → «Спасибо» → чип в углу.

### Кот оценки не появляется, если угол занят

- Правый нижний угол — один оверлей: `useBottomRightSlot`. Памятка после отпуска занимает слот, пока не `hidden`.
- `PageRateCatHost` не монтирует кота, если слот занят. После исчезновения чипа кот может выехать по обычным правилам.
- Правило: `.cursor/rules/bottom-right-slot.mdc`.

### Памятка после отпуска: карточка и карусель, спокойный текст

- Карточка выше, текст больше не обрезается. Сверху фиолетовая геометрия ITMO, снизу кремовое поле, лаймовая полоса между ними.
- Тексты в тоне спокойной памятки: цельные абзацы, без обрубленных фраз. Welcome по-прежнему без акцента на хандру.
- Превью: `?pvm=1` на localhost или стейдже. На бое не выкатываем без «ок на прод».
- Файлы: `postVacationMemoSlides.ts`, `PostVacationMemo.vue`, `main.css`.

### Памятка после отпуска: сначала «С возвращением», советы в уголке

- Первый вход: одна карточка «С возвращением» + «Спасибо». Карусель советов не сразу.
- «Спасибо»: карточка схлопывается и по дуге улетает в правый нижний угол (чип на 10 рабочих дней).
- Клик по чипу открывает карусель. Пролистал до конца — чип пропадает. В уведомлениях запись остаётся (`post_vacation_memo`, `/vacations?pvm=tips`).
- localStorage `vbi-post-vacation-memo-v2`. Превью: `?pvm=1` (welcome). На бое превью выкл.
- Файлы: `PostVacationMemo.vue`, `usePostVacationMemo.ts`, `postVacationMemo.ts`, `postVacationMemoSlides.ts`.

### Отпуска: еженедельный снапшот `vacations.json`

- Раз в неделю (вс 03:00 МСК) копия рабочего файла на диск: заявки, брони, лимиты, статусы согласования.
- Каталог: `/var/www/vbi-hr/server/data/backups/vacations/vacations-YYYY-MM-DD.json`, хранятся 12 недель.
- Не зависит от Nitro (прямой `cp` + проверка JSON). Timer: `vbi-hr-vacations-backup.timer`.
- Проверка: `sudo systemctl start vbi-hr-vacations-backup.service` → файл за дату в `backups/vacations/`.

## 2026-08-15

### Демо: Алина — тест большой «Твоя команда» без Ревзиной

- `alina@vbi.local` / `employee123` — директор QA-отдела «Тестировщики» (~29 чел.) в профиле, фиксированная карточка + скролл.
- Зона: `departmentTeamScope` («Алина Тестова» / «Мария Тестова» → Тестировщики).
- Проверка: localhost (QA вкл.) → вход Алина → `/profile` → «Твоя команда Тестировщиков».

### Профиль: второй экран — ачивки + команда + активность в одном fold

- Свой `/profile` (desktop): сетка высотой `100dvh − 64px` — всё видно без листания «туда-сюда».
- Ачивки не меняем. Команда и активность заполняют оставшуюся высоту; лишнее — скролл внутри поля (видимая полоса).
- Файлы: `profile/index.vue`, `main.css`.
- Проверка: `alina@vbi.local` → проскроллить к блокам под героем → ачивки, команда и активность в одном экране; в команде доскролл до последнего.

### Профиль: большая команда — фиксированная карточка + скролл внутри

- Список в `.profile-team__scroll`: жёсткие `height`/`min`/`max` = `22rem` + `overflow-y: scroll` и видимый scrollbar (как у активности).
- Раньше `.card`/`profile-hub-card` с `overflow:hidden` обрезали аватары пополам, а без фиксированной высоты скроллпорт не работал.
- Файлы: `profile/index.vue`, `main.css`.
- Проверка: `alina@vbi.local` → `/profile` → в «Твоя команда» полоса прокрутки справа, доскролл до последнего сотрудника.

### Профиль: у директора отдела — вся команда, не только прямые

- Баг: у Ревзиной (и других директоров отдела) в «Твоя команда» были только прямые `manager`.
- Fix: зона как у месячных напоминаний — весь Digital / DEV / SEO / … (`departmentTeamScope.ts` + `profileTeamForUser`).
- Проверка: войти как Ревзина → `/profile` → «Твоя команда Digital» — все из отдела Digital, не только групхеды.

### Сотрудник: скролл «Общего» календаря доезжает до конца

- Баг: на больших командах низ таблицы обрезался (`max-height` от `100dvh` больше реальной зоны), scrollbar «заканчивался» раньше последних строк.
- Fix: для `employee-team` высота считается от верха таблицы до низа рабочей зоны (как у руководителя), без переопределения CSS-переменной на frame.
- Проверка: `/vacations` → «Общий» → прокрутить вниз — последняя строка команды видна целиком.

### Отпуска: даты в «Общем» на больших экранах не обрезаются

- На ≥1500×850 шрифт плашек снижен с `0.78rem` до `0.6rem`, чтобы диапазоны вроде `31.08–13.09` влезали в ячейку месяца.
- Проверка: `/vacations` → «Общий», широкий монитор — цифры внутри зелёных плашек целиком.

### Справочник: удалённый сотрудник больше не возвращается

- Причина: merge при деплое и синк Bitrix могли вернуть запись из репо / «kept roster».
- Fix: denylist учитывается при merge деплоя, чтении справочника и синке; удаление ждёт ответ сервера.
- Проверка: удалить в `/admin/employees` → обновить страницу → человека нет; после деплоя стейджа — тоже нет.

### Кот оценки: пузырь «Спасибо» больше не подрезается

- У хоста кота добавлен `padding-top`: `overflow: hidden` для выезда не срезает панель комментария сверху.
- На стейдже и на бою одинаково.

### Кот оценки: на стейдже без таймеров 1 ч / 2 мес

- На `:8080` и localhost кот приходит сразу на открытом разделе (удобно тестировать).
- На бою гейты без изменений: ≥1 ч в разделе + раз в 60 дней.

### Кот оценки на открытых разделах (раз в 2 месяца)

- Кот может прийти на: база знаний, отпуска, идеи, VPN, профиль (если раздел открыт по launch scope).
- Не чаще **1 раза в 2 месяца** на пользователя; день прихода свой (стабильный hash), чтобы не всем разом.
- Показ только если в **этом** разделе суммарно ≥ **1 час** активного времени (вкладка видима).
- В отзыве и админ-уведомлении — название раздела (`page`).
- Хост: `PageRateCatHost.vue`, правила: `usePageRatingGate.ts`, `pageRatingSections.ts`.

### База знаний: пузырь ниже + resize внутри поля

- Пузырь «Спасибо!» / комментарий опущен ближе к морде; хвостик на одной высоте в обоих шагах.
- Растягивание — верхний правый угол внутреннего поля текста (не внешняя рамка).

### База знаний: пузырь комментария над котом + resize вверх

- Панель «Спасибо!» / комментарий вынесена над сценой: кот и бумажка свободны, хвостик к морде.
- Тянуть за верхний правый угол — высота растёт вверх.
- Ролик и бумажка не менялись.

### База знаний: пузырь комментария выше и растёт вверх

- При ≤4★ панель закреплена снизу у морды (`bottom`), не заезжает на лапы; растягивание поля уходит вверх.

### База знаний: ответ кота тоже пузырь

- «Спасибо!» и форма комментария — тот же речевой пузырь над мордой, что и «Оцените удобство».
- Ролик и бумажка не менялись.

### База знаний: «Оцените удобство» — пузырь у кота

- Плашка перенесена в сцену над мордой, стиль речевого пузыря (хвостик вниз), лаймовая тень.
- Ролик и бумажка не менялись (locked).
- Проверка: `/knowledge`, сброс `vbi-kb-page-rating-v1` — после ролика пузырь сидит у кота.

### База знаний: подсказки классического поиска

- В строке поиска фиксировано «Например:», печатается только запрос.
- Набор: кейс Грузовичкоф, корпоративный GPT, шаблоны договоров, регламент отпуска, AFINA CRM, телефон, юрлицо, цены, задачи, фрод, NiceTalk.
- Файлы: `data/knowledgeSearchPhrases.ts`, `components/KnowledgeSearchGhost.vue`.

### Банк идей: категория «Корпоративы и развлечения»

- В списке категорий вместо «Благополучие» — «Корпоративы и развлечения» (`IDEA_CATEGORIES`).
- Уже сохранённые идеи со старым именем подхватывают новое при чтении очереди.
- Проверка: `/ideas` → фильтр и форма «Предложить идею».

### База знаний: кот не откатывается, шов бежевый

- Кот вынесен в `KnowledgeRateCat.vue`, плейсхолдер поиска — в `KnowledgeSearchGhost.vue`: печать текста больше не патчит DOM кота.
- После 2.8 с класс `is-parked` держит `translateX(0)`; время выезда только вперёд.
- Хвост без `mix-blend-mode: screen` (белый шов), цвет `#f3eee5`, нахлёст 16px.
- Проверка: `/knowledge`, `localStorage.removeItem('vbi-kb-page-rating-v1')`, жёсткое обновление.

### База знаний: кот не откатывается, хвост не двоится

- Выезд больше не CSS-animation (её срывал ререндер страницы) — `translateX` из `currentTime` ролика, после 2.8 с заморозка в `0`.
- Хвост бумажки синхронится по кадрам (`requestVideoFrameCallback`), нахлёст 12px с мягким стыком.
- Пути: `pages/knowledge/index.vue`, `assets/main.css`, `public/knowledge/rating-paper-tail.png`.
- Проверка: `/knowledge`, `localStorage.removeItem('vbi-kb-page-rating-v1')`, жёсткое обновление — кот только слева, после 2.8 с стоит, хвост не отстаёт.

### База знаний: не трогать style анимированного кота

- CSS-переменные хвоста пишутся в `.kb-rate-cat__stage` через `setProperty`, не через `:style` на aside — иначе выезд срывается и кот едет назад.

### База знаний: кот по ТЗ — хвост сразу, звёзды на бумажке, комментарий сверху

- Хвост бумажки (`rating-paper-tail.png`) с первого кадра, стык с обрезом ролика, без чёрной обводки-наложения.
- Сдвиг 2.8 с из-за края, ролик доигрывает; хвост едет вместе с бумажкой по таймкодам.
- Звёзды внутри поля бумажки (не на коте); ≤4 — комментарий над котом; 5★ и после отправки — уходит весь блок со звёздами.

### База знаний: кот только из-за правого края

- Первый кадр: `translateX(100%)` на самом виджете + `forwards`. Без fade и без появления на месте.
- Анимацию выезда не снимать.

### База знаний: без отката кота после выезда

- Класс выезда больше не снимается на 2.8 с (`animation-fill-mode: both` держит `translateX(0)`).
- Ролик по-прежнему доигрывает до конца.

### База знаний: ролик доигрывает, сдвиг не откатывается

- Ролик идёт до конца. На 2.8 с снимается только CSS-выезд (`is-entering` → покой `translateX(0)`), без паузы видео.
- Базовый transform — `0`, не `100%`: после стопа нет отката назад.

### База знаний: кот не откатывается после стопа

- На 2.8 с ролик паузится на этом кадре (не доигрывает и не прыгает на последний).
- После выезда класс `is-parked`: `animation: none; transform: translateX(0)` — без отката к `translateX(100%)`.
- Плашка «Оцените…» абсолютная, не двигает сцену.

### База знаний: стоп кота на 2.8 с

- Выезд **2.8 с**: как только кот в ролике останавливается, виджет больше не едет. К этому моменту кот и вся бумажка уже на экране.

### База знаний: вся бумажка выезжает до посадки кота

- Выезд 3.2 с (устарело — см. 2.8 с выше).
- Виджет `right: 10px`, ширина считает ролик + дорисованный swallowtail.

## 2026-08-13

### База знаний: стоп выезда кота = посадка в ролике (3.5 с)

- Замер QA: walk_stop ~3400 ms, sit_end ~3500 ms @ 30fps. `RATE_WALK_END_SEC` / CSS = **3.5s** (было 3.9 → slip).

### База знаний: выезд кота снова с края (без JS-сдвига)

- Вернул CSS `translateX(100%→0)` на 3.9 с (стоп лап); убрал JS-sync, из‑за которого кот «всплывал» на месте.

### База знаний: выезд кота синхронно с лапами

- Сдвиг виджета идёт от `video.currentTime` и останавливается ~на 3.9 с (лапы в ролике уже стоят); дальше без «проскальзывания».

### База знаний: кот выходит справа, бумажка целиком, звёзды на ней

- Вход: выезд из-за правого края (~5 с, linear), без fade — в ритме перебора лап.
- В конце ролика полная бумажка поверх кадра (`rating-paper-full.png`, swallowtail); звёзды внутри бумажки.
- Кот ≈ в 1,5 раза меньше прежнего виджета.

### База знаний: кот меньше, бумажка целиком со swallowtail

- Виджет оценки ≈ в 1,5 раза меньше.
- В конце ролика — полная бумажка (`/knowledge/rating-paper-full.png`) с раздвоенным правым краем; звёзды сидят на ней.
- Ролик: `/knowledge/rating-cat.webm`.

### База знаний: кот со звёздами вместо плашки оценки

- Оценка: PixVerse-ролик кота (`/knowledge/rating-cat.webm`) справа снизу; поверх бумажки — кликабельные жёлтые звёзды.
- Логика та же: 5 ★ — спасибо и уезжает; ≤4 — комментарий → админ + Bitrix Драго.

### База знаний: без фильтров, оценка страницы, живой placeholder

- Фильтры спрятаны (`KB_FILTERS_ENABLED = false`), код на месте.
- Плашка «Оцените удобство этой страницы»: 5 ★ — спасибо и уезжает; ≤4 — комментарий. Комментарий → админ-уведомления и чат-бот Bitrix Драго Станиславе (`POST /api/knowledge/feedback`).
- В строке поиска фразы печатаются с мигающим курсором; если не печатать 5 сек — следующая. Пока одна: «Например: кейс Грузовичков».
- localStorage: `vbi-kb-page-rating-v1`.

### База знаний: фильтры слева, окно по центру

- Иконка фильтра — первая в ряду чипов.
- Детальные фильтры открываются модалкой по центру экрана, не внутри нижней карточки.

### База знаний: строка снова снизу

- Карточка поиска и чата снова внизу: один паттерн для «Поиск» и «Спросить ИИ». Выдача и диалог — сверху слева.
- Заголовок «Найти в базе» не меняется. Фон сдвинут к карточке.

### База знаний: карточка сверху, фон, без дубля заголовка

### База знаний: быстрые чипы и окно фильтров

- В ряд — только базовые тематики; тип, период, автор и остальные темы — под иконкой фильтра, окно поверх карточки поиска.
- Выдача выровнена по левому краю, не по центру.

### База знаний: карточка поиска как «Найти программу мечты»

- Серая скруглённая панель, крупный заголовок, табы (активный — чёрный pill), поле + «Искать», чипы тематик.
- Под нас: «По базе / Спросить ИИ», чипы из сида + регламент/FAQ/дата/автор.

### База знаний: поиск как у ITMO

- Убрал наслоенные плашки и квадратики на строке — это был плохой паттерн для поиска.
- Как на abit.itmo.ru: toggle-pill «По базе / Спросить ИИ», поле + чёрная «Искать», чипы фильтров (лайм = активно).

### База знаний: короче консоль, ITMO-квадратики

- Строка поиска и фильтры — на 1/3 короче (консоль 66%), по центру.
- Плашки не «колбаса»: скругление 10px, 8 квадратиков на активной рамке, Unbounded на вкладке ИИ.

### База знаний: компактные фильтры и видимая плашка ИИ

- Дата — одна пилюля «Дата · все», период в выпадашке, не два календаря в ряд.
- Задняя плашка лаймовая, выше, текст «Спросить ИИ» чёрный и читаемый.

### База знаний: классический поиск и чат с ИИ (фронт)

- `/knowledge` — пустой холст, строка снизу, переключатель плашек «Найти по базе…» / «Спросить ИИ» (задняя выходит сверху вперёд).
- Классика: Enter, выдача как у Google (название + подсветка), операторы `"фраза"`, `!` (строгое слово), `OR`. Фильтры: дата, автор, тематика, тип (регламент / FAQ). Пустой запрос + фильтры — можно; порции по 5, подгрузка у низа списка.
- ИИ: чат, фильтров нет. Ответ только через `useKnowledgeAiAnswer` — без ссылок на статьи не проходит. История диалога `vbi-kb-ai-chat-v1`, TTL 1 день; переключение режима чат не сбрасывает.
- Сид тот же (`knowledgeBaseCatalog.ts`): у статей появились `type`, `publishedAt`, `visibility: all`. Редактура и доступ по отделам — позже.
- Файлы: `pages/knowledge/index.vue`, `utils/knowledgeSearch.ts`, `composables/useKnowledgeSearch.ts`, `useKnowledgeAiAnswer.ts`, `useKnowledgeAiChat.ts`, `main.css`.
- Проверка: localhost `/knowledge` → Enter «отпуск» → клик по названию; `!аванс`; фильтр тип FAQ без текста; плашка «Спросить ИИ» → вопрос → в ответе ссылки на статьи.

## 2026-08-10

### Админка сотрудников: поле Bitrix ID

- В `/admin/employees` после аватарки — колонка **Bitrix ID** (ручной ввод; синк новых из Bitrix не импортирует).
- Проверка: целое положительное число; пустое поле очищает ID.

### Ачивка «Лучший специалист продаж» (ОП, 1×–5×)

- Каталог: `sales-best-1`…`sales-best-5`, иконка `/achievements/sales-best.png`, секция «Лидерство и инициатива».
- Админ 29-го получает уведомление (`sales_best_pick_due`); выбор/перевыбор на `/admin/sales-best`.
- Ачивка видна сотруднику только с `reveal_on` = первый рабочий день следующего месяца (`firstWorkingDayOfMonth` + производственный календарь).
- В день reveal — запись в **Недавнюю активность** и **Новости коллег**: «Имя стал(а) Лучшим специалистом отдела продаж за март 2026».
- Store: `server/data/sales-best-awards.json`; cron `POST /api/cron/sales-best-pick-due`; тест: `POST /api/admin/sales-best/notify-test`.
- Правило проекта: `.cursor/rules/automate-not-handfix.mdc`.

### Стейдж `:8080` снова отдельный контур + Bitrix (staging)

- Nginx `:8080` → `vbi-hr-staging` (3301), не редирект на бой.
- Третье OAuth-приложение **VBI HR Platform (staging)**; ключи в `/etc/vbi-hr/bitrix.env` (локальная копия `deploy/env/bitrix.env`, в gitignore).
- Бой — своё приложение и `bitrix-production.env`; `(dev)` — только localhost.
- Документация: `docs/BITRIX.md` (три приложения).

### Hotfix: OAuth handoff + CSP + гидрация auth

- Handoff v9: callback 200 HTML → form POST `/api/auth/bitrix-ticket` → cookie → `/?auth=bitrix`.
- Ticket/form: относительные URL (CSP `form-action 'self'`).
- `authReady` всегда в `finally`; plugin на `app:mounted`; Bitrix return не блокирует экран на bootstrap.
- `deploy-remote.sh`: `chown` `server/data` перед restart (EACCES у `deploy`).
- Файлы: `callback.get.ts`, `bitrix-ticket.*.ts`, `oauthLoginTicket.ts`, `useAuth.ts`, `auth.client.ts`, `app.vue`.

## 2026-08-07

### Hotfix: вход через Bitrix — handoff v9 (form POST)

- После security-коммита (HMAC-сессии) cookie с 302 после Bitrix HTTPS→HTTP не садилась; meta-refresh тоже в cross-site chain.
- Callback: **200 HTML** → `form POST /api/auth/bitrix-ticket` (first-party) → Set-Cookie → `/?auth=bitrix`.
- `callback.get.ts`, `bitrix-ticket.post.ts` / `.get.ts`, `oauthLoginTicket.ts`.

### Hotfix: CSP не форсит HTTPS на HTTP-бою

- Убран `upgrade-insecure-requests` из CSP: бой на `http://45.12.74.25` без TLS, директива ломала загрузку JS/CSS.
- `frontend/nuxt.config.ts` — `upgradeInsecure: false` до появления HTTPS.

### Мелочи аудита: доки, мёртвый код, oauth-debug

- Удалены неиспользуемые `platform-base.css` и `digitalVacationGroups.ts`.
- `oauth-debug`: без захардкоженного prod `client_id` — только маска + эвристика redirect.
- Доки: нет `CHAT_FALLBACK`; BITRIX env для боя; TTL сессии 8ч; CLI rollover из корня; README без `.bat`/`backend/`.
- Гендиректор: пустой `manager` — норма; согласует admin/HR (`PRODUCT.md`).

### Аудит: производительность, atomic JSON, debounce Bitrix, откат деплоя

- Детальный календарь: убраны ~25k DOM `.vac-detailed-day-bg` — фон дней одним CSS-градиентом (`--vac-day-paint`) + `content-visibility` на строках.
- Иконки ленты: PNG 1024→80px, ~6.4 МБ → ~56 КБ (`public/activity/icons/`, cache `?v=4`).
- Синк Bitrix на логин: debounce 5 мин + coalesce in-flight; админский POST с `force: true`.
- Все JSON-сторы сервера пишут через `writeJsonAtomic` (temp+rename).
- Деплой: перед rsync копия `.output` → `.output.prev`; откат `deploy/scripts/rollback-remote.sh staging|production`.
- Сводка: `docs/AUDIT-2026-08-07.md`.

### Ремонт по аудиту системы (P0 / часть P1)

Сводка аудита: `docs/AUDIT-2026-08-07.md` (четыре агента, затем закрыты).

- **Права на заявки отпуска:** `POST/PATCH/DELETE /api/vacations/requests` передают `session`; согласование считает сервер (`canApproverReviewRequest` / `nextStateAfterApproval`); чужие заявки и self-approve закрыты; свою согласованную можно править/удалять, пока отпуск не полностью прошёл (`isPastApprovedVacationRequest`, как в UI).
- **Bitrix:** при отклонении ранее `approved` — `removeVacationAbsenceFromBitrix` (как при удалении).
- **Календарь:** праздники **2027**; баланс режет дни по учётном году (`clipIsoRangeToYear`) + заявки соседних папок (хвост через НГ).
- **Надёжность:** `atomicJson.ts` (rename) для `employees.json` / `vacations.json`; очередь записи сотрудников; таймаут 20с на Bitrix fetch.
- **UI/замки:** scroll у `.sidebar`; контраст выходных в emp-календаре; `guardRoute` ждёт `authReady`; балансы детального календаря — один `computed`.
- Проверка: сотрудник не может `PATCH {"status":"approved"}` чужую/свою заявку (403); отпуск 28.12–10.01 списывает дни из обоих годов; reject approved снимает пальму.

### Скиллы vbi-copy и vbi-image

- Проектные Agent Skills: `.cursor/skills/vbi-copy/` (тексты), `.cursor/skills/vbi-image/` (арт/GenerateImage).
- References: голос, шаблоны копирайта; палитра, anti-slop, рецепты промптов.
- Роли copywriter / ui-ux / product-design ссылаются на эти скиллы.
- Без сторонних сервисов (не CellCog). Вызов: по контексту или `@vbi-copy` / `@vbi-image`.

### Безопасность: сессия, CSP, секреты, API

- Cookie: TTL 8ч + sliding, HMAC-подпись (`VBI_SESSION_SECRET`); `Secure` только при https URL / `VBI_COOKIE_SECURE`.
- CSP полный + `nosniff` / Referrer-Policy; убран `v-html` у проекции отпуска; HTML в идеях стрипается.
- Секреты: redact webhook/token в ошибках; oauth-debug без длины secret; `VBI_SESSION_SECRET` в env.example.
- API: `ideas/notify`, `ideas/status-notify`, `tenure/gift-orders` → `requireVbiSession` + привязка к текущему пользователю.
- Проверка: после выкладки — перелогин (старые cookie без подписи не работают); экстранет по-прежнему 403.

### Вход только из справочника (анти-экстранет)

- Bitrix OAuth без записи в «Сотрудники» → 403; сессия на каждом API перепроверяет членство в справочнике.
- Синк Bitrix больше не импортирует новых ACTIVE (ни при входе, ни по кнопке admin) — только обновление уже заведённых.
- Демо-логин API на production отключён.
- Файлы: `bitrixAuth.ts`, `bitrixSync.ts`, `session.ts`, `session.post.ts`, `sync-employees.post.ts`, AuthLogin; PRODUCT §9.1.
- Проверка: пользователь экстранета Bitrix → «Войти через Битрикс» → отказ; сотрудник из справочника → вход ок.

### Офбординг: каскад данных при удалении из справочника

- VPN: удаление пиров в wg-easy; при ошибке — админ-уведомление `vpn_peer_delete_failed`.
- Сразу: уведомления, адаптация, лента профиля, оргсхема/manager overlay.
- Аватар — 14 дней; отпуска — 1 год; идеи и авторские обучалки — бессрочно; кошелёк/покупки — 1 год (срок в denylist).
- Файлы: `employeeAccessDenylist.ts`, `wgEasyClient.ts` (`deleteWgClient`), сторы уведомлений/адаптации/профиля/аватаров/отпусков; PRODUCT §9.
- Проверка: удалить сотрудника → VPN учёта нет; колокольчик/адаптация/лента пусты; админ видит алерт только если панель не удалила пир.

### Удаление из справочника → доступ закрыт сразу

- При удалении сотрудника из «Сотрудники» — denylist + сброс сессии; вход Bitrix/демо запрещён; синк Bitrix не возвращает запись.
- Отпуска: хранение 1 год, из общего календаря/оргпанели исчезают; идеи — бессрочно.
- Каскад видимости: очистка ФИО на оргсхеме, overlay руководителя, учёт VPN-ключей платформы.
- Файлы: `employeeAccessDenylist.ts`, `employeesStore.ts`, `session.ts`, `bitrixAuth.ts`, `bitrixSync.ts`; PRODUCT §9.
- Проверка: удалить тестового из `/admin/employees` → следующий запрос API → 401; повторный Bitrix-логин → 403.

### Оргсхема: документация и финальные UX-правила

- PRODUCT §8 — правила панели сотрудников, матчинг нод, без скролла схемы.
- ARCHITECTURE / README — компоненты, `layoutCompressX`, roster-aside.
- Readonly: схема всегда contain в кадр (`overflow: hidden`), правая панель — свой скролл.
- С панелью: сжатие только по X, схема прижата вверх; без ResizeObserver-дрожи (порог + запас scale).

## 2026-08-06

### Оргсхема: клик по отделу → список сотрудников справа

- В режиме сотрудника (и превью «глаз») клик по ноде отдела сжимает схему влево и открывает панель: название + список людей.
- Клик по человеку в списке открывает публичную визитку.
- Матчинг Digital: весь Digital / контекст (Лунин+Попов+Цхай) / SMM (Носков) / аналитика (Левина, Мощев) / DEV отдельно.
- В списке Digital — секции: Дирекция (Ревзина → Жукова → Громов) → Analytics → **Группа Цхай** → Попов → Лунин → Носков. Громов не в SMM.
- Файлы: `pages/organization.vue`, `pages/admin/organization.vue`, `OrgChart.vue`, `OrgUnitRosterAside.vue`, `utils/orgUnitEmployees.ts`, `main.css`.
- Проверка на localhost: `/organization` → клик «Digital отдел» → сверху Ревзина, Жукова, Громов, дальше группы; человек → визитка.
- «Отдел внутренних разработок» / «проектов» → Грошева, Ситников (`Внутренние проекты`); матчинг `внутренн` раньше `разработ`.
- Юристы (подрядчики): Марченко Елизавета, Анащенко Артём — в списке без визитки. Офис-менеджер / HR — панель не открывается. Директора «инкогнито» без карточек — как задумано.
- SEO-блок: аккаунтинг → Пяткова, Гончаров; ORM → команда Новоторцевой; SEO отдел → Трубицына + SEO без AM; SEO&SERM → весь блок **с секциями** (Аккаунтинг / ORM / SEO), как Digital.
- Сжатие при открытой панели — **только по ширине** (`layoutCompressX`); высота/вертикальный масштаб сохраняются.
- Правая панель — фиксированная высота окна, список со скроллом внутри.
- Readonly-схема **без внутреннего скролла**: contain в кадр, открыл — сразу видны все ноды.
- Продуктовые правила: **[PRODUCT.md](./PRODUCT.md)** §8.

### Оргструктура: руководитель отдела из справочника

- В карточке отдела поле «Руководитель» — dropdown из раздела «Сотрудники» (не ручной ввод).
- В превью клик по ФИО руководителя отдела открывает карточку сотрудника.
- Файлы: `OrgUnitFields.vue`, `OrgChart.vue`, `main.css`.

### Оргструктура: превью заполняет экран (contain)

- Масштаб только в readonly (сотрудник / глаз): `min(availW/cw, availH/ch)×0.9`, потолок до ~2.55× на широких — без низких boostCap.
- Редактор без авто-zoom (`fitScale=1`). У readonly-доски снят `max-width:100%`, чтобы увеличение не резалось.
- Файлы: `OrgChart.vue`, `main.css`.
- Проверка: глаз вкл — схема крупно в сером поле; глаз выкл — редактор как раньше.

### Оргструктура: крупнее превью на мониторах

- В режиме сотрудника / глаза схема сильнее заполняет экран: ноут ~до 1.34×, средний ПК ~1.52×, большой ~1.78×; сжатие только если не влезает.
- Файлы: `OrgChart.vue`, `main.css`.
- Проверка: глаз вкл на ноуте и на большом мониторе — меньше серой пустоты, схема читаемее.

### Оргструктура: превью снова крупнее (без занижения readonly)

- В `readonly` масштаб/высота считаются по реальной высоте схемы (`contentBounds.height`), чтобы превью не уменьшалось из-за минимальных резервов.
- В `readonly` уменьшена «подушка» при расчёте `fitScale`, чтобы схема заполняла серое поле сильнее.
- Файлы: `OrgChart.vue`.

### Оргструктура: сотрудники видят /organization и кликают ФИО

- На production в режиме `vacations` страница `/organization` доступна сотрудникам (замочек снимается), содержимое берётся из админского орг-JSON на сервере.
- В OrgChart (readonly) кликабельны ФИО руководителя отдела: открывается карточка сотрудника; директоров открыть нельзя.
- Файлы: `useLaunchScope.ts`, `pages/organization.vue`, `components/OrgChart.vue`.
- В админской оргсхеме руководитель группы теперь выбирается из централизованного списка руководителей (из справочника «Сотрудники»), без ручного текста.
- Поиск сотрудника для визитки оставлен детерминированным: нормализация `ё/е` и пробелов, без «угадываний» по частям строки.
- Файлы: `components/OrgChart.vue`, `useEmployeeVisitingCard.ts`.

## 2026-08-05

### VPN: подсказка автовключения прокси

- После выбора «Прокси» бот напоминает включить автовключение с запуском компьютера.
- Файлы: `pages/vpn/index.vue`.

### VPN: «объясните по-человечески»

- На шаге клиента справа от CTA — кнопка «Я ничего не понимаю»; бот пишет пошаговую инструкцию под устройство (Windows/Android/iPhone/Mac).
- Файлы: `pages/vpn/index.vue`.
- Проверка: `/vpn` → VPN → Windows → кнопка справа → шаги про Assets и `*_x64.exe`.

### VPN: выбор устройства и ссылки на клиенты

- После VPN — шаг «Какое именно устройство?»: Mac / iPhone / Windows / Android.
- Mac → WireGuard App Store; iPhone → [AmneziaWG в App Store](https://apps.apple.com/us/app/amneziawg/id6478942365?l=ru); Windows/Android → [релизы AmneziaVPN](https://github.com/amnezia-vpn/amnezia-client/releases) с подсказкой имени файла (`*_x64.exe` / `*_android9+_arm64-v8a.apk`).
- Файлы: `pages/vpn/index.vue`, `docs/PRODUCT.md`.
- Проверка: `/vpn` → VPN → iPhone / Windows / Android — разные CTA и инструкции.

### Оргструктура: белая подложка обнимает схему

- Масштаб и центр — относительно серого рабочего экрана (не огромного белого поля).
- Белая доска `fit-content` вокруг схемы, без пустых белых зон.
- Файлы: `OrgChart.vue`, `main.css`.

### Оргструктура: линии в превью + центр + без заголовка

- Фикс разрыва линий при глазе: якоря считаются в локальных координатах canvas с учётом CSS scale.
- Масштаб: Mac/ноут ≈ 1:1; большой ПК (~≥1680px) чуть крупнее; сжатие только если схема не влезает.
- Схема по центру экрана (и в редакторе, и в превью).
- Убран заголовок «Структура компании» (везде).
- Файлы: `OrgChart.vue`, `admin/organization.vue`, `main.css`.

### Оргструктура: масштаб на больших экранах + шлифовка

- Режим просмотра (сотрудник / глаз): схема авто-масштабируется под экран (до ~1.42×), по центру на белой подложке.
- Страница сотрудника без заголовка и админ-кнопок; в превью админа — только глаз «назад».
- Шлифовка: спокойнее линии, плотнее карточки, ФИО в группе жирнее, мягче фон рамки группы.
- Файлы: `OrgChart.vue`, `organization.vue`, `admin/organization.vue`, `main.css`.
- Проверка: большой монитор → глаз вкл / `/organization` — схема крупнее и по центру.

### Оргструктура: хранение на сервере

- Схема больше не только в `localStorage`: `GET/PUT /api/org-structure` → `server/data/org-structure.json`.
- Чтение — любой авторизованный; запись — admin/hr.
- Если на сервере пусто, а в браузере есть локальная схема — одноразовая загрузка на сервер (миграция с ноута).
- Деплой не затирает существующий `org-structure.json` на сервере.
- Файлы: `orgStructureStore.ts`, `api/org-structure/*`, `useOrgStructure.ts`, `useAppBootstrap.ts`, `deploy-remote.sh`.
- Проверка: открыть `/admin/organization` на ноуте (где схема есть) → hard refresh на ПК → та же схема.

### Оргструктура: высота отдела без руководителя

- Карточки без ФИО руководителя снова по тексту (сброс лишней `height` от ресайза).
- «+ Руководитель» вне потока (по ховеру), не раздувает карточку.
- Ресайз сохраняет высоту только если тянули по вертикали.
- Файлы: `OrgUnitFields.vue`, `OrgChart.vue`, `useOrgStructure.ts`, `main.css`.

### Оргструктура: ресайз карточек отделов

- У отделов (соло и в группе) — ручка размера; минимум по тексту, дальше свободно.
- `unit.width` / `unit.height` в `vbi-org-structure-v1`.
- Файлы: `useOrgStructure.ts`, `OrgChart.vue`, `main.css`.

### Оргструктура: свободный ресайз рамки группы

- Мин. ширина/высота группы снижены (380→160 / 140→100) — рамку можно подогнать под контент.
- Ручка ресайза крупнее (hit-area 22px).
- Файлы: `useOrgStructure.ts`, `OrgChart.vue`, `main.css`.

### Оргструктура: крестик группы поверх рамки

- Кнопка «×» удаления группы смещена наружу угла (`top/right: -10px`), не съедает место внутри и не мешает ресайзу ширины.
- Файлы: `main.css`.
- Проверка: `/admin/organization` → тянуть правый нижний угол рамки без большого правого отступа.

### Оргструктура: ФИО руководителя — свободная плашка в группе

- Подпись группы (напр. «Анна Трубицына») стала плашкой внутри рамки: таскается свободно, не по сетке; это не отдел (без портов/крестика).
- Позиция: `group.labelX` / `group.labelY` в `vbi-org-structure-v1`.
- Файлы: `useOrgStructure.ts`, `OrgChart.vue`, `main.css`.
- Проверка: `/admin/organization` → потянуть ФИО внутри группы куда угодно.

### Оргструктура: превью «глаз» как у сотрудников

- Слева от «+ Директор» — переключатель глаза: выкл = редактор, вкл = вид сотрудника (без крестиков, портов, «+ Руководитель», ручек mid, кружков на локтях, кнопок добавления).
- Файлы: `pages/admin/organization.vue`, `OrgChart.vue`, `main.css`.
- Проверка: `/admin/organization` → глаз вкл → чистая схема; глаз выкл → снова редактор.

### Оргструктура: связи на бое + кружки на развилках

- Снят hard-lock `orgLinksEnabled=false` на production-хосте; в `build-and-deploy.sh production` → `ORG_LINKS=true`.
- На локтях ортогональных линий — кружки-стыки (ITMO: серый fill + чёрный stroke); дедуп общих точек.
- Жест рисования без `setPointerCapture` (как в прежних фиксах) — порты + window listeners.
- ITMO-геометрия директоров обрезается внутри `.org-exec-face` (не вылезает за карточку/поле); drag clamp по размеру блока.
- **Фикс схлопывания схемы:** `anchorPoint` для `bottom` без `rect.bottom`; canvas без `overflow: hidden` (карточки больше не клипаются); кнопки/поля с `@pointerdown.stop`; drag/resize без `setPointerCapture` и заблокированы во время рисования связи; SVG-пути в try/catch.
- Файлы: `OrgChart.vue`, `OrgNodePorts.vue`, `OrgUnitFields.vue`, `InlineField.vue`, `orgLinkPath.ts`, `main.css`, `useAppEnv.ts`, `build-and-deploy.sh`.
- Проверка: `/admin/organization` → «+ Руководитель», порты, drag — схема не пропадает.

### Оргструктура: гибкий редактор

- В группе: свободное позиционирование отделов (drag), ширина по тексту.
- Кружки на линиях только на реальных локтях/развилках (не на прямой, не у порта).
- Скругления локтей стабильнее (STUB 28, simplify collinear).
- Регулировка «высоты» линии: тянуть среднюю секцию / ручку на линии (сохраняется `link.mid`).
- Файлы: `orgLinkPath.ts`, `OrgChart.vue`, `useOrgStructure.ts`, `main.css`.
- Проверка: `/admin/organization` — двигать отделы в группе; тянуть линию от гендира; кружки только на развилках.

### Очередь согласования: скролл внутри окна

- Список заявок руководителя скроллится внутри белой панели.
- Причина бага: глобальный `.card > .list-reset { overflow: hidden }` перебивал `overflow-y: auto`.
- Файлы: `main.css`.
- Проверка: localhost:3000 → руководитель → Согласование → очередь крутится внутри окошка.

### Оргструктура: отделы в группе

- Внутри группы: CSS grid 2 колонки (`max-content`), ширина отдела по тексту; 3 отдела → 2+1.
- Drag отделов внутри группы: старт с карточки/названия (не блокируется editable-line); кнопки/порты по-прежнему не начинают drag.
- Мин. ширина рамки группы 380px.
- Файлы: `OrgChart.vue`, `InlineField.vue`, `useOrgStructure.ts`, `main.css`.
- Проверка: hard-refresh `/admin/organization` → компактные 2+1; потянуть SEO на другое место.

### Бренд в сайдбаре: только VIBE VBI

- Убрана подпись под брендом (раньше «График отпусков» / «Панель администратора» и т.п.).
- Файл: `app.vue`.
- Проверка: в сайдбаре только `VIBE VBI`.

### Прод: структура открыта админу

- Whitelist `/admin/organization` в пилоте `LAUNCH_SCOPE=vacations` — без замка в меню админа.
- Сотрудничья `/organization` по-прежнему с замком.
- Файлы: `useLaunchScope.ts`.
- Проверка: на бое под админом пункт «Структура» кликабелен → `/admin/organization`.

### Bitrix: перенос дат отпуска — update пальмы, без Element already exists

- При смене дат после согласования: `lists.element.update` того же отсутствия, а не delete+add.
- Конфликт `Element already exists` → находим элемент и обновляем даты (в т.ч. по `bitrix_absence_id`).
- Поиск по `ELEMENT_CODE` (`vbi-hr-vac-{id}`) — работает, когда FILTER по CODE запрещён и старые даты уже не совпадают.
- Файл: `frontend/server/utils/bitrixVacationAbsence.ts`.
- Проверка: изменить даты согласованной заявки → в графике отсутствий Bitrix новые даты, без алерта админу.

### Сайдбар: Магазин · кошелёк

- «Кошелёк» не отдельный пункт: вход из Магазина, в меню «Магазин · кошелёк».
- Файлы: `usePlatformContext.ts`, `pages/store.vue`.

### VPN: выдача ключей на бою для всех сотрудников

- Whitelist `/vpn` в пилоте `LAUNCH_SCOPE=vacations` — пункт меню без замка у сотрудников.
- Помощник: WireGuard (Mac) / AmneziaWG / прокси; лимиты 1+2; конфиг+QR; имена `LastName_Amst_Wire` / `LastName_Amst_Aeza` (фамилия транслитерируется в латиницу).
- Env на сервере: `WG_EASY_*`, `AWG_EASY_*` (см. `deploy/env/bitrix-production.env.example`).
- Файлы: `useLaunchScope.ts`, `pages/vpn/index.vue`, `server/api/vpn/keys.*`, `wgEasyClient.ts`, `vpnLiveKeys.ts`.

### VPN: латинизация фамилии в названии конфигурации

- При формировании `clientName` для peer'а/конфига кириллица (фамилия) транслитерируется в латиницу ASCII, чтобы у части пользователей не было проблем с именами файлов.
- Файл: `frontend/server/utils/vpnKeysStore.ts`.

## 2026-08-04

### VPN: черновик раздела-помощника (localhost)

- Страница `/vpn` в меню; чат на весь экран контента (без скролла страницы).
- **Кошелёк** убран из меню — вход из **Магазина** (карточка → `/wallet`).
- Ссылки: прокси → Flowseal releases; Mac → WireGuard App Store; Win/Android/iPhone → AmneziaWG releases.
- Лимиты: **1 WireGuard**, **2 AmneziaWG**; пояснения в чате.
- Выдача ключа: активная кнопка → `POST /api/vpn/keys` (wg-easy, только create; конфиг + QR в чате). Env `WG_EASY_*` / `AWG_EASY_*`.
- Если пир удалили вручную в админке — запись в `vpn-keys.json` снимается, можно выдать новый (панель сама не чистится).
- Файлы: `pages/vpn/index.vue`, `server/api/vpn/keys.*`, `server/utils/wgEasyClient.ts`, `vpnKeysStore.ts`, `vpnLiveKeys.ts`, `data/vpnLimits.ts`.

### Визитка: стрелка Bitrix как на профиле

- Рядом с ссылкой «Bitrix» в футере визитки — квадратный значок ↗ (тот же SVG, что у ФИО на чужом `/profile`).
- Файл: `EmployeeVisitingCard.vue`.

### Bitrix: ложные «не удалось занести отсутствие» (Жукова / Ревзина) + Грошева

- **Жукова (2), Ревзина (1):** отсутствие уже было в графике; при чужом approve ресинк не находил элемент (`FILTER.CODE` запрещён, выборка по пользователю ≤50) → `Element already exists` и алерт админу.
- **Грошева:** в `FIELDS` нужен `PROPERTY_1`, не `PROPERTY_USER` («Пользователь is required»).
- Фикс: поиск по `bitrix_absence_id` / пользователь+`ACTIVE_FROM`; дефолт полей `PROPERTY_1` / `PROPERTY_7`; не ресинкать всех `synced` при каждом approve.
- Код: `frontend/server/utils/bitrixVacationAbsence.ts`. После выкладки на прод: `POST /api/bitrix/sync-vacations` для failed.

### Документация: сводка bot-напоминаний по отпускам

- PRODUCT §1.3.1, BITRIX (тексты, timers UTC/МСК), ARCHITECTURE (cron API), README → ссылки.
- Расписание на бою: сотрудник **12:00 МСК** (проверка каждый день, отправка 1 раз за 21 день); руководитель **1-е / 15-е в 11:15 МСК**.

### Напоминание руководителю 1-го: отпуска команды в текущем месяце

- 1-го числа (**11:15 МСК**) бот пишет список **approved** со **стартом в текущем месяце** (те же зоны, что у напоминания 15-го; Юдин не получает).
- Текст: «В этом месяце в отпуск из вашей команды идут:» + «Не забудьте учесть их отсутствие.»
- API: `?outlook=current`; timer `vbi-hr-vacation-manager-current-month-reminders.timer`.

### Напоминание руководителю 15-го: отпуска команды в следующем месяце

- 15-го числа (**11:15 МСК**) чат-бот пишет руководителю список **approved** отпусков со **стартом в следующем месяце**.
- Ревзина — весь Digital; Музыка / Трубицына / Волдайский / Малиновская / Лашин — весь отдел; групхеды — прямые подчинённые; **Юдин не получает**.
- API: `POST /api/cron/vacation-manager-month-reminders` (`force=1&dry_run=1` для проверки).
- Timer: `vbi-hr-vacation-manager-month-reminders.timer` (тоже 11:15 МСК).
- Напоминание сотруднику за 3 недели — проверка каждый день в **12:00 МСК**, отправка **один раз** ровно за 21 день до старта.
- Файлы: `vacationManagerMonthReminder.ts`, systemd timers, `docs/BITRIX.md`, `docs/PRODUCT.md`.

### График отпусков: без визитки по клику на ФИО

- В календаре руководителя (детально / по месяцам) и в **календаре команды сотрудника** ФИО больше не открывает публичную визитку.
- Визитка по клику — в профиле («Твоя команда») и в банке идей.
- Файлы: `VacationDetailedCalendar.vue`, `VacationMonthlyCalendar.vue`.

### Календарь сотрудника: белая рамка закрывает вкладки

- Строки обычной высоты; при короткой команде белое поле растягивается **только до низа** вкладок «Мой / Общий» (не до края экрана).
- Файлы: `EmployeeVacationPanel.vue`, `main.css`.
- Проверка: Бухгалтерия (2 чел.) → «Общий» → вкладки внутри белой рамки, под ней серый фон.

### Календарь: высота строки 21px, рост только при 2 строках должности

- Базовая высота ячеек **21px** (в т.ч. при свёрнутой «Должности»; убран раздувающий `min-height: 44px` у трека).
- При открытой колонке растёт только строка с должностью в 2 линии; ФИО/остаток не раздуваются сами по себе.
- Белый фон таблицы **по высоте строк**, не до низа большого экрана (`max-height` вместо `height: 100%` у fill-viewport).
- Файл: `main.css`.
- Проверка: команда ~29 на высоком мониторе — под последней ФИО сразу серый фон страницы, без белой дыры.

### Календарь руководителя: должность целиком, до 2 строк

- Ширина колонки «Должность» = замер фразы «Специалист по контекстной»; длиннее — перенос на 2-ю строку.
- Высота строки растёт **только** у сотрудников с переносом должности; однострочные остаются компактными.
- Файлы: `VacationDetailedCalendar.vue`, `VacationMonthlyCalendar.vue`, `main.css`.
- Проверка: «Директор» / «Тестировщик» — одна высота; «Ведущий специалист по контекстной рекламе» — выше на одну строку.

### Детальный календарь: праздники как выходные + колонка «сегодня»

- Нерабочие праздничные дни производственного календаря 2026 (`isRuHoliday`) в детальном виде руководителя подсвечиваются бледно-синим, как сб/вс (`--vac-grid-weekend`).
- Колонка текущего дня — бледно-фиолетовая (`#ebe6fc`), как подсветка строки фокуса.
- Файлы: `VacationDetailedCalendar.vue`, `main.css`.
- Проверка: руководитель → Детально → январь (1–2, 5–9) и 9 мая / 12 июня / 4 ноября / 31 декабря — синие столбцы; сегодня — фиолетовый.

### Bitrix: пальма обновляется при переносе согласованного отпуска

- Если заявка `approved` перенесена (изменились `start/end`) в VBI HR, то в Bitrix «график отсутствий» пересоздаётся так, чтобы даты (`ACTIVE_FROM/ACTIVE_TO`) совпали с новыми.
- Файлы: `frontend/server/utils/bitrixVacationAbsence.ts`, вызов из `frontend/server/utils/vacationRequestMutations.ts`.

## 2026-08-03

### Визитка: меньше карточка, тоньше рамка

- Ширина ~540px, рамка 7px (было 14), фото/типографика плотнее.
- Бэклог на прод: `birthday` из Bitrix (`PERSONAL_BIRTHDAY`) → поле сотрудника.
- Файл: `EmployeeVisitingCard.vue`.

### Визитка: перенос эталона 1:1 в локал

- Возврат с приёмки: не «похожая» карточка, а вёрстка по `LOCKED-etalon-v1` / close-avatar.
- Рамка с квадратиками в полосе, лаймовый ×, бейдж, поля, футер с разделителями, barcode PNG с эталона (`public/employee-card/barcode-strip.png`).
- Файл: `EmployeeVisitingCard.vue`.
- Проверка: клик по ФИО → сверить с PNG в `docs/design-refs/employee-visiting-card/` (контролёр: эталон+код, без браузерного спама).

### Визитка: UI как в эскизе (рамка / бейдж / barcode)

- Подтянули локал к `docs/design-refs/employee-visiting-card/`: толстая рамка + квадратики, чёрный бейдж, капс-ФИО Unbounded, поля value справа, футер в ряд, штрих-полоса.
- Убрали lime drop-shadow «карточки ради карточки». Даты `ДД.ММ.ГГГГ`, стаж «N ГОДА M МЕСЯЦ». «Идеи» — всего у автора (не только done).
- Файлы: `EmployeeVisitingCard.vue`, `tenureAnniversary.ts` (`formatHiredAtDot`, `tenureCardLabel`, `formatBirthdayDot`).
- Проверка: клик по ФИО → визитка как эскиз, без затемнения.

### Банк идей: локал больше не глотает идеи Даши/Васи

- Причина: `getDeployAppEnv()` принимал `BITRIX_REDIRECT_URI=http://localhost:3000/...` за production; `GET /api/ideas` резал записи с «тест» в ФИО (`Даша Тестова`).
- После создания идея мигала в UI (POST без фильтра), после перезахода исчезала у всех.
- Фикс: localhost → `development`; убран word-filter тест/qa/demo (антипаттерн). На бое демо не сидим, а не прячем словами.
- Файлы: `server/utils/appEnv.ts`, `server/api/ideas/index.get.ts`.
- Проверка: локал → идея от Кати/Даши → выход → Вася → идея в «Все идеи»; снова Даша — на месте.

### Визитка сотрудника (поповер у клика)

- Компактная ID-карточка у курсора, **без затемнения** фона (эталон `docs/design-refs/employee-visiting-card/`).
- Поля: аватар платформы, должность, отдел, дата приёма / стаж, ДР (`birthday`), ачивки, идеи; Вишлист (скоро), Bitrix.
- Точки входа: календарь отпусков (ФИО), профиль «Твоя команда», банк идей (автор / топ авторов). Структура — позже.
- Файлы: `EmployeeVisitingCard.vue`, `useEmployeeVisitingCard.ts`, `profile/index.vue`, `ideas/index.vue`, календари.
- Проверка: клик по коллеге в профиле или автору идеи → карточка рядом; Esc / × / клик снаружи — закрыть.

### Напоминание за 3 недели до отпуска (чат-бот Bitrix)

- Ежедневный cron: approved-отпуск со стартом **ровно через 21 день** → «До отпуска осталось 3 недели» от чат-бота (`imbot.message.add`): заявление + передача проектов.
- Env: `BITRIX_IMBOT_ID`, `VACATION_PRE_REMINDER_CRON_SECRET`.
- Текст п.2: «Поставьте задачи на передачу проектов на время отпуска» (без ссылки на шаблон).
- Хвост «Памятка…» + URL только для Digital (`/devs/21301/`) и SEO/ORM (`/devs/24611/`); остальным отделам не пишем.
- `POST /api/cron/vacation-pre-reminders` (+ `dry_run=1`), журнал `vacation-pre-reminders.json`.
- Timer: `deploy/systemd/vbi-hr-vacation-pre-reminders.timer`.
- Файлы: `vacationPreReminder.ts`, `bitrixImbot.ts`, `docs/BITRIX.md`.
- Проверка: dry_run на сервере; после регистрации бота — тестовая отправка себе.

### Bitrix-отпуска: без calendar.event.add (профиль HR)

- Вебхук от Драго → у `calendar.event.add` всегда `CREATED_BY=Драго`, и Bitrix показывает absence в **её** «Отсутствиях», даже при верном `ownerId` сотрудника.
- Синк только через **график отсутствий** (`lists.element.add`, `PROPERTY_USER`).
- Удалены чужие calendar-события с профиля Драго (Бацюсь, Скворцов, «Отпуск ежегодный»).
- Файлы: `bitrixVacationAbsence.ts`, `docs/BITRIX.md`.
- Проверка: профиль Драго → «Отсутствия» без чужих VBI HR; у сотрудника пальма из графика отсутствий.

### Bitrix-отпуска: повторный синк failed без дублей

- Если отпуск уже в графике отсутствий Bitrix (вручную или прошлый синк) — привязываем заявку к существующему ID, не создаём второй.
- `POST /api/bitrix/sync-vacations` (admin/hr) — повтор failed/skipped → галочка «Битрикс» системно.
- Файлы: `bitrixVacationAbsence.ts`, `api/bitrix/sync-vacations.post.ts`.
- Проверка: у failed-заявки с уже существующим отсутствием в Bitrix → sync-vacations → статус `synced`.

### Bitrix-отпуска: админ-уведомление + защита от чужого календаря

- При fail синка отпуска → уведомление в `/admin/notifications` («Отпуск не ушёл в Bitrix»).
- Синк только `lists.element.add` (пальма по `PROPERTY_USER`). **`calendar.event.add` отключён**: `CREATED_BY` = владелец вебхука (Драго) → чужие отпуска в её «Отсутствиях».
- Без `bitrix_user_id` у сотрудника синк не запускаем.
- Файлы: `bitrixVacationAbsence.ts`, `adminNotificationsStore.ts`, `useAdminNotifications.ts`.
- Проверка: сломать вебхук → согласовать отпуск → админ видит уведомление; календарь HR не засоряется.

### Bitrix-синк отпусков: fallback на OAuth при битом вебхуке

- Причина крестика у Скворцова и ещё ~11 заявок (1–13.07.2026): вебхук отвечал `Invalid request credentials`; автосоздание в Bitrix падало, отпуск потом завели вручную — статус `failed` не обновлялся.
- Теперь при credentials-ошибке вебхука — повтор через OAuth service token (как уведомления).
- Файлы: `bitrixVacationAbsence.ts`, `docs/BITRIX.md`.
- Проверка: согласовать отпуск при рабочем OAuth даже если вебхук битый → **Битрикс ✓**.

### Сотрудник: вертикальный скролл «Общего» календаря

- Баг: таблица обрезалась рамкой без scrollbar (flex-высота не доходила до `.vac-table-scroll`).
- Починка: цепочка `height/min-height:0` до scroll-контейнера + явный `overflow-y: auto`.
- Файлы: `main.css`.
- Проверка: `/vacations` → вкладка **Общий** → колесо/трекпад листает список сотрудников внутри рамки.

### Календарь руководителя: рамка по числу сотрудников

- Маленькая команда (меньше 12 человек): белая рамка по последней строке, без пустого поля до низа экрана.
- Большая команда (≥12): снова `fill-viewport` — рамка до низа окна, скролл внутри таблицы.
- Файлы: `VacationTeamCalendar.vue`.
- Проверка: `/vacations` как руководитель, отдел из ~8 человек — рамка обнимает таблицу.

## 2026-08-02

### База знаний: статьи, поиск и фильтры

- Клик по карточке → `/knowledge/[id]` с текстом материала; назад — «Все материалы».
- Сверху: поиск и фильтры по категориям; плейсхолдер «+ новые» скрывается при поиске/фильтре.
- Скругления папки — SVG `clipPath` (`KnowledgeFolderClip.vue`), без острых углов polygon.
- Файлы: `pages/knowledge/index.vue`, `pages/knowledge/[id].vue`, `components/KbCardFace.vue`, `components/KnowledgeFolderClip.vue`, `main.css`, `usePlatformContext.ts`.
- Проверка: localhost `/knowledge` → поиск/фильтр → открыть карточку → страница статьи.

### База знаний: сетка карточек в стиле ITMO

- Раздел `/knowledge` — карточки по moodboard (бейдж → заголовок → текст → автор), палитра VBI: лайм / фиолетовый / чёрная рамка / квадратики.
- Есть вариант «документ» и слот «+ новые материалы».
- В меню сотрудника; на бое останется с замком (не в whitelist `vacations`).
- Файлы: `pages/knowledge/index.vue`, `data/knowledgeBaseCatalog.ts`, `main.css`, `usePlatformContext.ts`.
- Проверка: localhost → **База знаний** в меню → сетка карточек, hover сдвигает всю карточку.

### База знаний: форма «папки» как в референсе

- Силуэт с вкладкой слева сверху (`clip-path`); бейдж во вкладке; шевроны внизу справа.
- Убран дубль заголовка/лида на странице (остаётся только topbar).
- Файлы: `pages/knowledge/index.vue`, `main.css`.
- Проверка: `/knowledge` → карточки-папки, без второго «База знаний» сверху.


### Календарь: sticky числа/дни недели + «Сейчас в отпуске»

- При вертикальном скролле закреплены строки месяцев, чисел и дней недели (и счётчиков директора).
- «Сейчас в отпуске»: только `approved` из **тех же** `yearRequests`, что рисует календарь; `todayIso` + `namesOnVacationOnIso`; срез = видимые в календаре.
- Полоски Gantt: позиция в px; колонка дня **18px** (`--vac-day-col-w`); таблица `max-width` = сумма колонок — без растягивания в простор.
- Три оси отдельно: день **18px**; строка **21px**; ФИО — **по самому длинному** в видимой колонке (DOM-зонд в `body`, не canvas).
- Prop метрики: `vacationNowCount`; aside `z-index: 30`.
- Файлы: `main.css`, `VacationDetailedCalendar.vue`, `utils/measureCssText.ts`, `VacationsManagerExperience.vue`, `ManagerVacationAside.vue`, `utils/vacationCalendar.ts`.
- Проверка: `/vacations` → hard refresh → длинное ФИО целиком; даты 18px; строки 21.5; метрика = полоска на «сегодня».

### Календарь: фикс замера колонки ФИО

- Зонд уезжал за `overflow:hidden` → ширина 0/занижена; canvas без Golos Text обрезал длинные имена.
- Зонд через `Teleport` в `body` + DOM `scrollWidth`; canvas только fallback.
- Баг ПК: замер `scrollWidth` у block-ячеек + ResizeObserver раздувал колонку ФИО → сетка «уезжала».
- Только зонд (`inline-block` + `max-content`), потолок 280px, resize не трогает ФИО.
- Файлы: `VacationDetailedCalendar.vue`, `VacationMonthlyCalendar.vue`, `main.css`.
- Проверка: бой `/admin/how-it-looks` → hard refresh → колонка по длинному ФИО, даты на месте.

### Календарь: sticky ФИО непрозрачны при метрике «Сейчас в отпуске»

- Убраны `opacity` на всю строку и `rgba` фон у focus — отпуска больше не просвечивают сквозь ФИО/должность/остаток.
- Dim только у трека дат; sticky — сплошной фон (`#ebe6fc` / `#ffffff`).
- Файлы: `main.css`.
- Проверка: `/admin/how-it-looks` → клик «Сейчас в отпуске» → горизонтальный скролл — колонки слева глухие.

### Календарь: dim метрики — сетка снова слегка видна

- Opacity был на track и track-inner сразу → ~0.08, сетка/полоски пропадали.
- Один `opacity: 0.35` на `track-inner`; sticky по-прежнему непрозрачные.
- Файлы: `main.css`.
- Проверка: метрика вкл. → у остальных строк видна сетка и бледные отпуска.

### Календарь: без второго прыжка при скрытии «Должность»

- Ширина ФИО сразу резервирует место под шеврон — при toggle не пересчитывается и не дёргается.
- Файлы: `VacationDetailedCalendar.vue`, `VacationMonthlyCalendar.vue`.
- Проверка: свернуть/развернуть должность — один плавный сдвиг, без догона.

### Админ: замок «Как выглядит» + починка графика отпусков

- На бое `/admin/how-it-looks` снова с замком (убрали из whitelist).
- `/admin/vacations` — прежний UI (календарь + «Согласовать/Отклонить»), без копирования aside руководителя.
- `fill-viewport` только при `hideChrome` (рук-ль), чтобы админская страница не ломалась.
- Файлы: `useLaunchScope.ts`, `admin/vacations.vue`, `VacationTeamCalendar.vue`, `.cursor/rules/production-nav-locks.mdc`.
- Проверка: админ → «Как выглядит» с замком; «График отпусков» — год/Детально/Добавить + очередь заявок.

### Админ: год, «+ Добавить» и боковые вкладки на место

- Вернул absolute для ярлыка года и `vac-admin-add-btn--frame`; вкладки снова прижаты к рамке.
- Файлы: `main.css`.
- Проверка: `/admin/vacations` → год на верхнем краю рамки, кнопка справа в углу, Детально/По месяцам сбоку.

### Админ: кнопка не на датах, вкладки встык к рамке

- «+ Добавить» вынесена в chrome рядом с годом (не поверх шапки дат).
- «Детально/По месяцам» в одном ряду с frame — верх по рамке, стык справа без зазора.
- Файлы: `VacationTeamCalendar.vue`, `main.css`.
- Проверка: `/admin/vacations` → кнопка над рамкой; вкладки от верхнего края таблицы.

### Bitrix: отпуск и в календаре, и пальмой

- После согласования: `lists.element.add` (пальма) **и** `calendar.event.add` с `accessibility: absent` (отметка на сетке календаря Bitrix).
- Раньше при успешном lists календарное событие не создавалось — во встречах warning был, на сетке пусто.
- Файлы: `frontend/server/utils/bitrixVacationAbsence.ts`, `docs/BITRIX.md`.
- Проверка: согласовать отпуск → пальма + блок отсутствия в календаре сотрудника на портале.

### Руководитель: UX/дизайн правого меню

- Иерархия: фиолетовая тень только у карточки режима; контролы — лайм; год без градиента.
- «Сейчас в отпуске»: клик подсвечивает строки в календаре; подпись среза «команда» / «весь график»; геометрия плашки как у баланса сотрудника.
- «Вид» всегда в слоте (на согласовании disabled) — высота aside не прыгает; год выше training prompt.
- Счётчик согласований всегда (в т.ч. `0`); pill коралловый.
- HR-переключатель в стиле сегментов.
- Файлы: `ManagerVacationAside.vue`, `VacationsManagerExperience.vue`, `VacationTeamCalendar.vue`, `VacationDetailedCalendar.vue`, `VacationMonthlyCalendar.vue`, `main.css`.
- Проверка: `/vacations` → клик по метрике; Раздел↔Согласование без прыжка «Вид»; pill показывает `0`.

### Руководитель: padding карточки «Режим» как у сотрудника

- У `.vac-aside-mode-card` padding `16px` (как у `.employee-aside--fit`) — переключатель Руководитель/Сотрудник не прыгает при смене режима.
- Файлы: `frontend/app/assets/main.css`.
- Проверка: `/vacations` → переключить режим — toggle на месте.

### Прод: крупные ячейки дат у руководителя как раньше

- Убрано сжатие кегля ×0.9 (`.vac-manager-main …`) и уплотнение шапки дат — они уехали на бой вместе с тестом.
- Ячейки дат / шапка месяца снова как на прежнем проде.
- Файлы: `frontend/app/assets/main.css`.
- Проверка: бой `/vacations` или `/admin/how-it-looks` — числа дней в шапке не «мелкие».

### Руководитель: aside, sticky «Остаток», мусорка у admin

- Правое меню: стопка карточек без внешней рамки; «Сейчас в отпуске» крупнее (как на боевом скрине).
- Sticky: «Остаток» всегда `left: name+должность`, z-index ФИО > должность > остаток — при горизонтальном скролле не наезжает на «Должность».
- `/admin/employees`: у роли `admin` (Редактор системы) нет иконки удаления; `removeEmployee` игнорирует таких.
- Файлы: `ManagerVacationAside.vue`, `main.css`, `pages/admin/employees.vue`, `useEmployees.ts`.
- Проверка: localhost `/vacations` — цифры крупные; скролл сетки с открытой «Должность»; сотрудники с ролью admin — без 🗑.

### Календарь: колонка «Должность» снова sticky

- После восстановления CSS столбец «Должность» уезжал при горизонтальном скролле таблицы (ломались `left` у «Остаток» и пропадали sticky-правила у «Сотрудник»).
- Починены `position: sticky` + `left` для Сотрудник / Должность / Остаток; `--vac-title-col-w` и `--vac-sticky-left-balance`.
- Файлы: `frontend/app/assets/main.css` (ключ предпочтения `vbi-vac-show-title-col-v2` в `VacationTeamCalendar.vue`).
- Проверка: `/vacations` или `/admin/how-it-looks` → горизонтальный скролл сетки — три левые колонки стоят на месте.

## 2026-07-30

### Админ: раздел «Как выглядит» (превью календаря руководителя)

- Пункт меню `/admin/how-it-looks` — тот же UI, что у руководителя на вкладке «Руководитель» (таблица + правое меню).
- Открыт в пилоте `LAUNCH_SCOPE=vacations` (whitelist на бое).
- Общий компонент: `VacationsManagerExperience.vue` (используется и `/vacations` у manager/hr).
- Файлы: `pages/admin/how-it-looks.vue`, `VacationsManagerExperience.vue`, `useLaunchScope.ts`, `usePlatformContext.ts`, `vacations.vue`.
- Проверка: под админом на localhost — «Как выглядит» в меню; на бое — после выкладки.

### Локальный тест: календарь сотрудника = прод + aside руководителя в тех же координатах

- Сотрудник / режим «Сотрудник» у руководителя: `vacations-employee-shell` (как на бое `main`).
- Руководитель: правое меню `268px`, padding контента `12×16`, `margin-top: 8px`, переключатель режима с тем же отступом, что у сотрудника.
- Фиолетовая шапка руководителя = как у сотрудника (`16px 28px`, h1 `1rem`); aside на всю высоту; тулбар с тем же padding сверху; зазор под «РЕЖИМ» 8px.
- Aside руководителя: убраны «Сегодня» и «Заявки»; «Сейчас в отпуске»; переключатели раздела / вида / года; таблица поднята (`padding-top: 8px` у main).
- Шрифт таблицы руководителя ×0.9 относительно общих стилей — как `/admin/vacations` при browser 90%.
- Только localhost — без push в staging.
- Файлы: `vacations.vue`, `ManagerVacationAside.vue`, `VacationTeamCalendar.vue`, `main.css`.
- Проверка: http://127.0.0.1:3000/vacations — у руководителя контролы в правом меню, календарь сразу под шапкой.

### Тест: вёрстка отпусков как на проде при 90%

- На бое нет CSS-scale — красота при **browser 90%**. На тесте оставляем `--platform-zoom: 0.9` (смотреть при browser **100%**).
- Вернули эталонные метрики с `main`: aside `268px`, gutters `clamp(10px…24px)`, gap `8px`, padding рамки календаря `14×16`, content `12×16`.
- Файлы: `main.css`.
- Проверка: http://45.12.74.25:8080/vacations как сотрудник, zoom браузера 100% — как бой при 90%.

### Руководитель: правое меню как у сотрудника

- Переключатель «Руководитель / Сотрудник» снаружи общей рамки, на той же высоте, что в режиме сотрудника.
- Карточки «Сегодня / Сейчас / Заявки» — в отдельной рамке (`.vac-manager-aside-body`).
- Ширина aside ~300px (оба режима).
- Одинаковый правый отступ контента (`14px`) в обоих режимах — меню не «прыгает» к краю при переключении.
- Файлы: `ManagerVacationAside.vue`, `main.css`.
- Проверка: `/vacations` как руководитель — toggle отдельно сверху, меню шире; переключение в «Сотрудник» без скачка по высоте и по отступу справа.

### Масштаб 90% + без съезда вправо (оба сразу)

- CSS `zoom` рисует от центра → либо масштаб ок и aside уезжает, либо наоборот.
- Фикс: `transform: scale(0.9)` + `transform-origin: top left` + компенсация ширины/`margin-right`.
- Строки календаря `21.5px`. Инвариант в комментарии в `main.css`.
- Файлы: `main.css`, `VacationTeamCalendar.vue`.
- Проверка: http://127.0.0.1:3300/vacations — компактно (~29 человек), правое меню целиком на экране, даты совпадают с колонками.

### Вебвизор: не удалять старые CSS/JS при деплое

- Записи с ~16.07 выглядят «сломанными» не у реальных пользователей и не из‑за scale: Вебвизор при просмотре тянет CSS с боя, а `rsync --delete` после каждой выкладки сносил хеши `_nuxt/*.css` — плеер открывает визит без стилей (дефолтные кнопки, UI в углу).
- Деплой: `public/_nuxt` мержится без `--delete`; файлы старше 20 дней чистятся. Остальной `.output` — как раньше с `--delete`.
- Файл: `deploy/scripts/deploy-remote.sh`.
- Уже записанные визиты без файлов на диске не починить; **новые** после выкладки этого деплоя должны открываться нормально.

### Метрика / Вебвизор: убрали transform:scale с корня

- `transform: scale(0.9)` на корне тоже вреден для плеера; масштаб снова через CSS `zoom`.
- Это не объясняет кривые записи за 28–29.07 (scale появился 30.07) — см. пункт про `_nuxt` выше.

### Сотрудник: календарь чуть выше вниз

- Компактнее topbar/тулбар/padding рамки — сетка месяцев чуть выше по высоте.
- Проверка: http://127.0.0.1:3300/vacations → Режим «Сотрудник».

### Aside: «Рассчитать доступные дни к дате» в одну строку

- `--vac-aside-width: 272px` + `white-space: nowrap` у summary.
- Проверка: http://127.0.0.1:3300/vacations → фраза не переносится.

### Руководитель→Сотрудник: календарь крупнее вниз и вбок

- Меньше gutter (~14–28px) и padding рамки — белая сетка шире.
- Flex-цепочка до низа рабочей зоны — рамка и месяцы тянутся вниз; цифры дней чуть крупнее.
- Проверка: http://127.0.0.1:3300/vacations → Режим «Сотрудник».

### Руководитель→Сотрудник: поля календаря на localhost

- Правки gutter раньше шли только в `vacations-employee-shell` (чистый сотрудник) — у Марии/руководителя в режиме «Сотрудник» другой DOM (`vac-manager-layout--employee`), поэтому визуально «без изменений».
- Для embedded: gutter ~40–80px, padding рамки 18×36, gap до aside 24px, aside 220px.
- Проверка: http://127.0.0.1:3300/vacations → Режим «Сотрудник» — заметные поля слева у сетки месяцев.

### Сотрудник: календарь менее вытянутый, вкладки ровнее

- Больше боковые поля (`--vac-cal-gutter-x` до ~72px) и padding внутри рамки — сетка 12 месяцев не растянута на всю ширину.
- Вкладки «Мой календарь / Общий» в одном ряду с рамкой (`vac-emp-calendar-frame-row`) — стыкуются к верху, не «висят» от ярлыка года.
- Ярлык года снова папкой на рамке, с `padding-top` чтобы scale/`overflow` не обрезали.
- Файлы: `EmployeeVacationPanel.vue`, `main.css`.
- Проверка: `/vacations` → режим «Сотрудник» — поля слева/справа шире; вкладки ровно у рамки.

### Отпуска: уже aside и ярлык года у сотрудника

- Правая панель уже: `--vac-aside-width` 248px (сотрудник 240px), колонка руководителя до 248px.
- Кнопка года в режиме сотрудника снова в потоке над рамкой — `absolute` + `translateY(-100%)` обрезались после `scale` / `overflow:hidden`.
- Файл: `main.css`.
- Проверка: `/vacations` как сотрудник — виден ярлык года; правая колонка уже, чем раньше.

### Базовый масштаб: правое меню снова на экране

- `zoom` рисовал UI от центра → контент уезжал вправо, aside/правый край обрезались на всех страницах.
- Замена на `transform: scale(var(--platform-zoom))` + `transform-origin: top left` и компенсация ширины/`margin-right`.
- Высота строки календаря руководителя остаётся `21.5px`.
- Файлы: `main.css`, `VacationTeamCalendar.vue`.
- Проверка: любая страница со shell — сайдбар слева и правая колонка (отпуска) целиком в окне, без горизонтального скролла.

### Календарь руководителя: высота строки 21.5px

- `--vac-team-emp-row-h: 21.5px` — чтобы влез последний человек команды.
- Файл: `main.css`.

### Календарь руководителя: компактнее шапка таблицы

- Меньше отступы/шрифт в thead (месяцы, дни, «Сотрудник/Должность») и `margin-top` блока chrome — больше места под строки команды.
- Файл: `main.css`.
- Проверка: команда ~29 — все на одном экране без вертикального скролла таблицы.

### Календарь руководителя: высота строки 22px

- `--vac-team-emp-row-h: 22px`.
- Файл: `main.css`.

### Календарь руководителя: высота строки 23px

- `--vac-team-emp-row-h: 23px`.
- Файл: `main.css`.

### Календарь руководителя: высота строки 24px

- `--vac-team-emp-row-h: 24px` — чтобы ~29 человек помещались на одном экране ноутбука.
- Файл: `main.css`.

### Базовый масштаб платформы на всех страницах

- `zoom: 0.9` на `.app-viewport:has(.app-shell)` — бывший «масштаб 90%» теперь основной вид всего UI (не только календарь руководителя).
- Файл: `main.css`.

### Календарь руководителя: таблица на первый экран, футер ниже

- Таблица до низа окна (−5px); футер «Следите за нами» снова есть — под первым экраном, долистать скроллом страницы (не внутри таблицы).
- Файлы: `main.css`, `VacationTeamCalendar.vue`.
- Проверка: http://127.0.0.1:3300 — таблица до края; скролл в сайдбаре/сером поле → появляется футер.

### Календарь руководителя: таблица до низа экрана, футер скрыт

- На экране руководителя футер «Следите за нами» скрыт — таблица занимает место до края окна (−5px).
- Замер высоты — до `window.innerHeight`, не до футера.
- Файлы: `main.css`, `VacationTeamCalendar.vue`.
- Проверка: http://127.0.0.1:3300 или staging `:8080` — серой полосы и футера под таблицей нет.

### Календарь руководителя: таблица до низа через flex-цепочку

- Не только JS-max-height: от viewport до frame — `flex:1` / `height:100%`, чтобы белая рамка доходила до футера (−5px).
- Напоминание: правки на **staging `:8080`** и в локальном `npm run dev`; бой `:80` без «ок на прод» не трогаем.
- Файлы: `main.css`, `VacationTeamCalendar.vue`.

### Календарь руководителя: высота до футера и читаемая правая панель

- Учёт `zoom: 0.9` в замере высоты (иначе ~10% серой дыры) + нижний край у футера − 5px.
- При ≥12 сотрудниках рамка на всю доступную высоту (`--fill-viewport`), скролл внутри.
- Правая панель шире, подписи без обрезки, `overflow-x` у контента не клипает aside.
- Файлы: `VacationTeamCalendar.vue`, `main.css`.

### Календарь руководителя: читаемые заголовки и правая панель

- «Должность» / «Остаток» без обрезки (шире колонки, без ellipsis у заголовков).
- Правая панель шире (260px), подписи «Сегодня», «Сейчас в отпуске», «Заявки» не режутся.
- Файл: `main.css`.

### Календарь руководителя: масштаб как 90% страницы

- На экране руководителя (не режим «как сотрудник») весь viewport с `zoom: 0.9` и компенсацией ширины/высоты — объекты соразмерно мельче, как при масштабе браузера 90%.
- Файл: `main.css`.
- Проверка: `/vacations` как руководитель — сайдбар, шапка и таблица чуть компактнее; режим сотрудника без этого zoom.

### Календарь руководителя: высота строки 27px

- `--vac-team-emp-row-h: 27px` (было 32).
- Файл: `main.css`.

### Календарь руководителя: высота строки 32px

- `--vac-team-emp-row-h: 32px` (было 34).
- Файл: `main.css`.

### Календарь руководителя: высота поля до низа экрана

- Строки сотрудников фиксированной высоты (34px); больше не сжимаются под число людей (`fit-screen` убран).
- `max-height` рамки = от верха таблицы до низа окна − 5px (измерение в `VacationTeamCalendar`).
- Маленькая команда не растягивается; большая — скролл внутри таблицы.
- Файлы: `VacationTeamCalendar.vue`, `main.css`.
- Проверка: Костя (~29) — скролл, строки одной высоты; маленькая команда — низкая таблица без пустоты снизу.

### Календарь: без строк отделов

- Убраны фиолетовые строки «Отдел / Команда» — список сотрудников сплошной (детально и по месяцам).
- Файлы: `VacationDetailedCalendar.vue`, `VacationMonthlyCalendar.vue`, `main.css`.

### Календарь: без сворачивания отделов

- Убраны шевроны ▾ и клик по строке отдела в детальном календаре — отделы всегда развёрнуты.
- Файлы: `VacationDetailedCalendar.vue`, `main.css`.

### Календарь: границы ячеек как раньше + полоски между группами

- Откат пунктира и чёрных двойных линий между отделами.
- Сетка ячеек снова мягкая (`#e6e6e0` / inset shadow), как до эксперимента.
- Разделители только на фиолетовых строках отделов — тонкая мягкая полоска `rgba(116, 81, 244, …)`.
- Файлы: `main.css`.
- Проверка: `/vacations` как руководитель — внутри отдела без жирных границ; между отделами — мягкая фиолетовая полоска.

### Защита замков меню на бое

- Клиент: на `45.12.74.25` (порт 80) всегда `launchScope=vacations` и `appEnv=production`, даже если в бандле `full`/`development` (`productionHost.ts`, `useLaunchScope`, `useAppEnv`).
- Деплой: `deploy-remote.sh production` проверяет артефакт через `verify-production-build.sh` и **не выкладывает** сборку без `production` + `vacations`.
- Причина: повторные выкладки локального `npm run build` открывали сотрудникам черновики разделов.
- Проверка: ошибочный бандл на :80 — замки на месте; `deploy-remote.sh production` после голого `npm run build` — abort.

### Календарь руководителя: верхняя полоса снова на рамке

- Легенда + «Календарь / Согласование» сидят на верхнем крае таблицы (`vac-manager-calendar-block`), год справа — без наезда на шапку месяцев.
- Слева переключатель «Календарь / Согласование», справа от него — легенда.
- Боковые вкладки снова с `padding-top: 14px` — уголок рамки ниже ярлыков, как у сотрудника.
- Файлы: `vacations.vue`, `main.css`.

### Календарь руководителя: шрифт таблицы −10%

- ФИО `0.70rem`, должность `0.61rem`, остаток `0.65rem` (−10% от боевых 0.78 / 0.68 / 0.72).
- Файлы: `main.css`.
- Проверка: `/vacations` — чуть мельче, чем на проде.

### Календарь руководителя: столбец «Должность»

- Должность вынесена из ячейки ФИО в отдельный sticky-столбец (детально и по месяцам).
- В шапке слева от «Должность» — двойная стрелка (влево скрыть); при скрытии столбец не занимает место, стрелка вправо остаётся у «Сотрудник».
- Предпочтение в `localStorage` `vbi-vac-show-title-col-v1`.
- Файлы: `VacationTeamCalendar.vue`, `VacationDetailedCalendar.vue`, `VacationMonthlyCalendar.vue`, `main.css`.
- Проверка: `/vacations` как руководитель → стрелка у «Должность»; клик — столбец сворачивается / раскрывается.

## 2026-07-29

### Календарь руководителя: компактный верх

- Легенда коротко («Одобрено» / «На согласовании» / «Бронь») + вкладки «Календарь / Согласование» в одной строке.
- Год — ярлык сверху (`VacationYearTab`); «Детально / По месяцам» — боковые вкладки как у сотрудника.
- Таблица ближе к верху, больше места под строки команды.

### Локально: команда Кости 29 человек в таблице отпусков

- QA: у `Константин Тестов` 28 подчинённых (4 именных + 24 `Тестовый Сотрудник NN`).
- `VacationTeamCalendar--fit-screen`: при ≥20 людях уплотняет строки, чтобы команда помещалась в один экран.
- Проверка: войти как `kostya@vbi.local` → `/vacations` → «всего 29».

### Профиль: рамки ачивок/активности как у команды

- Убраны жирные ITMO-рамки у «Ачивки» и «Недавняя активность» (тонкая как у «Твоя команда»).
- Поле активности фиксировано под **6.5** строк; список сверху.

### Профиль: активность сверху панели

- «Недавняя активность»: список прижат к заголовку (`align-content: start`), а не по центру высокой карточки.

### Банк идей: очередь на сервере

- Идеи и голоса в `server/data/ideas.json` через `ideasStore` / `mutateIdeas` (как отпуска).
- API: `GET/POST /api/ideas`, `POST /api/ideas/:id/vote`, `PATCH /api/ideas/:id/status`, `DELETE /api/ideas/:id`.
- `useIdeasBank` больше не пишет в localStorage; деплой не затирает `ideas.json`, если файл уже на сервере.
- Проверка: два пользователя — идея одного видна другому после обновления.

### Банк идей: на бое без демо-сида

- (устарело для хранения) Ранее сид чистился в localStorage; теперь общий серверный банк без демо.

### Production: открыт банк идей

- Whitelist `/ideas` и `/admin/ideas` в пилоте отпусков — клики с профиля/уведомлений больше не уводят на календарь.

### Production: «Банк идей» в sidebar всем

- В пилоте «только отпуска» (production) пункт «Банк идей» в левом меню доступен всем пользователям и ведёт в `/ideas`.
- Админ остаётся со своей ссылкой на `/admin/ideas`.
- Проверка: войти как сотрудник → в sidebar есть «Банк идей» и открывается `/ideas`; войти как админ → пункт ведёт в `/admin/ideas`.

### Банк идей: на production скрываем тестовые записи

- Если в `server/data/ideas.json` содержатся идеи с “тест/qa/demo” в названии/авторе, на `appEnv=production` они не возвращаются из `GET /api/ideas`.

### Профиль: ачивки на бое с замком

- На production блок «Ачивки» закрыт: нельзя открыть каталог; подпись «Скоро откроются» + замок.
- Бейджи под ФИО тоже скрыты, пока не откроем по команде.

### Production: открыт раздел «Профиль»

- В пилоте `vacations` на бое добавлен whitelist `/profile` (остальное с замком).
- Правило: не снимать все замки без явной команды (`.cursor/rules/production-nav-locks.mdc`).

### Production: снова пилот «только отпуска»

- На бое `LAUNCH_SCOPE=vacations` + hard-lock в `useLaunchScope` (остальное с замком).
- Полная платформа — на staging `:8080`. Код профиля/ачивок/идей уже в репо, откроем позже.

### Production: открыта полная платформа

- Откат: см. запись выше — на бое снова пилот отпусков.

### Ачивки: выдача из данных и ручной ленты

- **Авто:** стаж 1 год (`hired_at`); 5/10/15 после claim юбилея; 28 дней отпуска за год (approved billable); идеи `done`; покупки магазина (`vbi-store-purchases-v1` + юбилейные заказы + kind `store`).
- **Вручную** (`/admin/activity`): выступления, курсы, повышения, наставник, практика — новые типы `promotion` / `mentor` / `practice`.
- Покупка в `/store` списывает валюту и учитывается в ачивках `store-*`.
- Файлы: `useAchievements.ts`, `useProfileActivity.ts`, `profileActivityStore.ts`, `store.vue`, `useWallet.ts`.

### Ачивки: каталог-основа и лента активности

- **Лента активности** — новые события сверху (`occurred_at` desc); авто-события больше не подставляют `now()` (даты из факта: юбилей, завершение курса, идея).
- **Ачивки** — расширенный каталог в `achievementsCatalog.ts` (стаж, отпуск 28 дней, идеи, выступления, обучение, повышения, магазин, журнал, наставничество, практики).
- «Календарь отпусков» — только в полном каталоге, не в превью профиля.
- Файлы: `achievementsCatalog.ts`, `useAchievements.ts`, `useProfileActivity.ts`, `useVacationTraining.ts`.

### Профиль: раскладка команды / активности по размеру команды

- Если в блоке команды **≤5 коллег** (без себя): слева ачивки + команда, справа активность.
- Если **≥6**: как раньше — слева ачивки + активность, справа команда.
- Проверка: отдел на 3–4 человека vs большой отдел на `/profile`.

### Профиль: чужие профили временно скрыты

- Из команды нельзя перейти на чужой `/profile?user=…`; прямой URL сбрасывается на свой.
- Проверка: клик по коллеге в блоке команды — без перехода.

### Профиль: календарик дней отпуска

- Плитка отпуска в герое — 3D desk-calendar (кольца, корпус, лаймовый лист).
- Hover: заворачивается **нижний левый** уголок листа (не весь блок).
- Проверка: `/profile` → навести на «дней отпуска».

### Профиль: 8 иконок типов активности

- Типы: магазин, выступление, обучение, идея, достижение, признание, велком, другое.
- PNG в `public/activity/icons/` (и `docs/design-refs/activity-icons/`); в ленте вместо квадратиков.
- Отпуск из ленты убран; повышение/юбилей → «Достижение».
- Проверка: `jubilee@vbi.local` → `/profile` — иконки у каждой строки активности.

### Профиль: ITMO-стиль блоков ачивок и активности

- Панели на `#eeeee8`, чёрная рамка 2px + offset-shadow, квадратики у краёв.
- «Открыть» — brutal-кнопка (фиолет + лайм-тень); ачивки earned/locked без «мыла».
- Активность: без вложенной карточки; лайм/фиолет bullet, бейдж типа, тонкие разделители.
- Проверка: `/profile` — два блока слева в одном визуальном языке с героем.

### Профиль: ачивки в 2 ряда + недавняя активность

- Блок ачивок выше: **2 полосы** иконок без подписей (сколько влезает по ширине).
- Вместо «Сейчас» — **«Недавняя активность»**: авто (юбилей, обучение, магазин/купон, идеи, согласованный отпуск) + ручные записи HR.
- Тестовые события для Юбилеева Теста (`jubilee@vbi.local`) в `profile-activity.json`.
- Админ `/admin/activity`: добавить/удалить событие.
- API: `GET/POST /api/profile-activity`, `DELETE /api/profile-activity/:id`.
- Проверка: войти как `jubilee@vbi.local` → `/profile` — лента с конференцией/мерчем/юбилеем; admin → добавить запись другому сотруднику.

### Профиль: ачивки сверху слева + оверлей

- Левая колонка `/profile`: компактный блок «Ачивки» над «Сейчас»; сколько иконок влезает в ряд — по ширине.
- «Все / Открыть» → полноэкранный каталог (полученные и ещё впереди).
- Убраны заглушка «Все достижения — скоро» и дубль «Ачивки» в «Сейчас».
- Проверка: свой профиль → ряд ачивок; клик «Все» → оверлей; Esc закрывает.

### Адаптация: создание и редактирование сценариев

- `/admin/adaptation`: «Новый сценарий», «Изменить», «Удалить» — название, аудитория, доп. шаги по фазам.
- Хранение: `server/data/adaptation-scenarios.json` (сид из 4 шаблонов).
- API: `POST /api/adaptation/scenarios`, `PUT/DELETE /api/adaptation/scenarios/:id`.
- Проверка: admin → новый трек с шагом на «Неделя 1» → назначить сотруднику → у него на `/adaptation` появляется шаг.

## 2026-07-27

### Магазин: фильтр по стоимости + сценарии адаптации

- `/store`: фильтр «Все / до 500 / 500–800 / от 800».
- Админ `/admin/adaptation`: каталог сценариев (общий, контекст, таргет, продажи) → назначить сотруднику.
- Назначенный сценарий дополняет базовый 90-дневный трек ролевыми шагами; сотрудник видит его на `/adaptation`.
- Карта идей из K-Team HRM: `docs/K-TEAM-MAP.md`.
- API: `GET /api/adaptation/scenarios`, `POST /api/adaptation/assign`.

### Профиль: ссылка в Bitrix на чужом профиле

- Рядом с ФИО — квадратная кнопка со стрелкой ↗ → профиль в Bitrix (`/company/personal/user/{id}/`).
- Видна **только на чужом** профиле (`/profile?user=…`); на своём скрыта.
- Из блока команды можно открыть коллегу (если есть `platform_user_id` / `bitrix_user_id`).
- Env: `NUXT_PUBLIC_BITRIX_PORTAL_URL` / `BITRIX_PORTAL_URL` (по умолчанию `https://crm.vbi.ru`).

### Профиль: свои идеи + блок «Сейчас» вместо матрицы

- Плитка идей: число **моих** идей, подпись «мои идеи».
- Убрана неготовая «Матрица компетенций»; слева — компактная сводка «Сейчас» (руководитель, ближайший отпуск, ачивки числом, адаптация при необходимости) рядом с командой.
- Проверка: `/profile` — счётчик идей = ваши заявки; матрицы нет.

### Банк идей: плашки = фильтр по статусу

- Клик по цветной сводке («Всего идей», «На рассмотрении», …) меняет фильтр статуса в тулбаре (без подсветки самой плашки).
- Страницы: `/ideas`, `/admin/ideas`.

### Уведомления: колокольчик без «Отпуска», крестик, лимит 100

- Убран заголовок «Отпуска» в выпадающем списке.
- Крестик в колокольчике скрывает уведомление только из дропдауна (`hidden_from_bell`); на `/notifications` оно остаётся.
- Хранение: до **100** уведомлений на пользователя; при 101-м удаляется самое старое.
- Исправлен DELETE: был неверный путь `/api/notifications/:id/delete`.

### Банк идей: уведомление автору при смене этапа

- При смене статуса идеи автор получает уведомление в платформе (`idea_status_changed`) и в Bitrix (колокольчик `im.notify.system.add`).
- API: `POST /api/ideas/status-notify` (admin/HR); клиент — `useIdeasBank.setIdeaStatus`.
- Проверка: админ меняет этап на `/admin/ideas` → у автора колокольчик Vibe и Bitrix со ссылкой на `/ideas`.

### Документация: продуктовые правила (`docs/PRODUCT.md`)

- Отдельный файл: что умеет модуль, **как считаются дни отпуска**, что входит в остаток, этапы согласования и банка идей.
- Ссылки из `README.md` и `ARCHITECTURE.md`. При смене бизнес-логики обновлять `PRODUCT.md` вместе с кодом.

### Банк идей — полный цикл и админ-этапы

- Сотрудник: `/ideas` — создание идеи (файл, drag-and-drop), голосование, фильтры, сортировка (новые/старые/популярные/непопулярные), удаление своей заявки.
- Профиль: плитка «банк идей» → `/ideas`; spotlight отпуска ≤14 дней.
- Поток этапов: отправка → **На рассмотрении** (+ уведомление admin/HR `idea_submitted`) → **Реализация** / **Отклонено** / **Реализовано**.
- Админ `/admin/ideas`: смена этапа через окно подтверждения; комментарий необязателен, при **отклонении — обязателен**; удаление любой идеи.
- Топ-авторы считаются по **реализованным** идеям (`status: done`).
- Ключи: `localStorage` `vbi-ideas-bank-v2`, `vbi-ideas-votes-v1-{userId}`; API `POST /api/ideas/notify`.
- Проверка: предложить идею → колокольчик админа → сменить этап (отклонение с причиной / реализовано) → топ-авторов обновляется.

### Профиль: банк идей и spotlight отпуска

- Плитка Vibe заменена на счётчик → `/ideas`; подпись «банк идей».
- Малая плитка: отпуск ≤14 дней — дата + «отпуск начнётся»; иначе динамический fallback.

## 2026-07-26

### Магазин: юбилейный купон в сетке каталога

- Купон — первая карточка `grid-three` (как промо-слот на витрине): тот же ритм, что у товаров.
- Выделение в стиле платформы: рамка 2px, тень lime `4px 4px 0 #ddf365`, бейдж «Награда» — без копирования Яндекс.Маркета.
- Эталонный арт в карточке, «Использовать» кликабельна; Day Off уступает слот при активном купоне.
- Проверка: Юбилеев → Магазин → первая карточка-купон рядом с Merch / Learning.

## 2026-07-24

### Юбилеи в компании — старт (тест)

- Модель порогов 1 / 5 / 10 / 15 лет и юбилейных наборов 5 / 10 / 15: `tenureAnniversary.ts`.
- В профиле показывается дата приёма и стаж (`/profile`).
- Демо-вход юбиляра: `jubilee@vbi.local` / `jubilee123` (QA + credentials).
- Локально: сотрудник **Юбилеев Тест** в `employees.json` (`hired_at: 2021-07-24` = 5 лет на 24.07.2026), руководитель Цхай Виталий.
- Дальше: публичные профили, D−5/день уведомления, оверлей, ачивка, купон, магазин, HR.

### Юбилей — оверлей поздравления (локальный тест)

- После входа юбиляра: письмо → ачивка → коробка → купон (`TenureCelebrationOverlay`, `useTenureCelebration`).
- Тест: `jubilee@vbi.local` / `jubilee123` — принудительно 5 лет, пока не забран claim в `localStorage` (`vbi-tenure-celebration-v1`).
- Проверка: войти → поверх экрана поздравление → «Горжусь быть частью команды».

### Юбилейные наборы в магазине

- В магазине показывается только актуальный набор с активным купоном у пользователя (не все 5/10/15 всем).
- «Использовать купон» → `POST /api/tenure/gift-orders` → уведомление admin/HR в колокольчике («Собрать юбилейный набор»).
- Плашка «заявка отправлена» привязана к `userId` и сбрасывается при logout / смене пользователя (не протекает на Стаса).
- Баннер-купон 5 лет в `/store`: `TenureGiftBanner` + `/store/tenure-gift-banner-5y.png`, кликабельное «Использовать» с анимацией нажатия.
- Проверка: Юбилеев → магазин → купон в первой карточке каталога.

## 2026-07-22

### Отпуска: год папки = год даты начала

- При создании заявки сервер отклоняет расхождение `body.year` и года `start` (иначе отпуск «висит» в одном годе, а даты — в другом и в календаре не виден).
- При правке дат заявка переносится в папку года даты начала.
- `vacationRequestMutations.ts`.

### Сотрудник: переключатель года + архив 2025

- У сотрудника справа над календарём — `vac-year-chip` как у руководителя.
- Годы раньше `primaryYear` — только просмотр (без формы заявки, выбора дат и броней).
- Баланс и таблица «Отгулял / план» в aside всегда по текущему учётном году.
- Импорт листа 2025 в `vacations.json` без смены `primaryYear` / employees: `scripts/import-vacation-year-from-xlsx.py`.
- **Прод (2026-07-22):** UI выкатан на `vbi-hr`; в `vacations.json` добавлено **95** заявок за 2025 (бэкап `vacations.json.bak-20260722-144452`). `primaryYear` = 2026, заявки 2026 не трогали.
- Проверка: `/vacations` → переключить на 2025 → календарь с отпусками, цифры справа как за 2026.

### Bitrix-мост: realtime Pull + PUSH_MESSAGE

- Симптом: уведомление в ленте только после F5, без всплышки и живого счётчика — мост делал `exit` до epilog, очередь Push&Pull не сбрасывалась.
- После `CIMNotify::Add` вызываем `\Bitrix\Pull\Event::send()`; также `PUSH_MESSAGE` / `NOTIFY_TITLE`.
- Файлы: `scripts/bitrix/vbi-hr/module/vbihr/tools/vacation-notify.php` (и копия `vacation-notify.php`).
- На портале заменить `/local/vbi-hr/vacation-notify.php`, ответ должен содержать `"pullFlushed":true`, затем тест без обновления страницы.

## 2026-07-20

### Кошелёк: юбилеи стажа 5 / 10 / 15 / 20 лет

- При входе начисляется внутренняя валюта за достигнутые юбилеи (один раз на каждый порог).
- Суммы пока не заданы (`null` в `TENURE_MILESTONE_AMOUNTS`) — как утвердите баланс, проставьте числа.
- Пути: `tenureMilestones.ts`, `useTenureMilestones.ts`, `useWallet.creditUserOnce`, вызов из `bootstrapAppData`.
- Проверка: задать сумму за 5 лет → сотрудник с `hired_at` ≥ 5 лет → вход → транзакция «Юбилей стажа: 5 лет»; повторный вход без дубля.

### Отпуска: сброс жёлтого диапазона кликом по пустому полю

- Клик по пустой ячейке календаря или вне дат сбрасывает выбор (как на ноуте): и незавершённый pick, и зафиксированный период в форме.
- `useVacationRangePick.ts`, `EmployeeVacationPanel.vue`.

### Bitrix-модуль vbihr: безопасная установка без init.php

- Починены риски выкладки: `notify-schema.php` больше не ломает сайт при случайном `require`; обработчик схемы в `try/catch`.
- Чеклист FTP + установка модуля: `scripts/bitrix/vbi-hr/README.md`.

## 2026-07-17

### Bitrix: тип уведомления «VBI HR → Заявки на отпуск»

- Локальный модуль `vbihr` (`OnGetNotifySchema`) + PHP-мост `CIMNotify` — **без правки `init.php`**. Каталог: `scripts/bitrix/vbi-hr/`.
- HR: при `BITRIX_VACATION_NOTIFY_BRIDGE_URL` + `SECRET` шлёт в мост вместо «неопознанного» `im.notify.system.add`.
- Зачем: одна галка в настройках, без шума от «Неопознанные» (кейс Ревзиной).
- Проверка: установить модуль на `crm.vbi.ru` по README → curl теста → заявка → колокольчик при выключенных «Неопознанных».

## 2026-07-15

### Отпуска: расчёт к дате только на будущее

- В «Рассчитать доступные дни к дате» нельзя выбрать сегодня и прошлые даты (`min` = завтра).
- `EmployeeVacationAside.vue`. Раньше на прошлую дату баланс мог быть выше текущего: в проекции вычитаются только отпуска до выбранной даты, а в текущем балансе — все pending/approved.

### Bitrix: причина 11 FAIL по колокольчику

- У части сотрудников в настройках уведомлений Битрикса — **расширенный режим без галки «Неопознанные уведомления»** → `im.notify.system.add` от VBI HR не показывается.
- Исправление: у сотрудника на `crm.vbi.ru` включить эту галку (или простой режим). Документация: `docs/BITRIX.md`.

## 2026-07-14

### Bitrix: диагностика колокольчика по 70 сотрудникам

- Probe: 59 OK / 11 FAIL (timestamp вместо ID). Список — в `docs/BITRIX.md`, скрипт `scripts/bitrix/diagnose-notify-chats.php`.
- Итог (см. 2026-07-15): не NotifyChat, а персональные настройки «Неопознанные уведомления».

### Bitrix: только колокольчик, без чата

- Убран любой fallback в `im.message.add` — по отпускам только `im.notify.system.add` (OAuth).
- У Желялетдиновой (`2579`) Bitrix не создаёт системные уведомления (result = timestamp); у Музыки — ок. Нужна проверка настроек учётки в crm.vbi.ru.

### Bitrix: fallback в чат, если колокольчик не создаётся пользователю

- Причина «только ручной пуш работает»: Nitro держал в памяти старый `access_token` без `im`.
- `forceRefresh` + retry; лог `server/data/bitrix-notify.log`.
- Проверка: создать заявку → у согласующего колокольчик; на сервере строка `OK #…` в логе.

### Bitrix: колокольчик требует scope `im` у OAuth-приложения

- Заявка #1026: токен был, но `im.notify.system.add` → `insufficient_scope` (у токена только `scope: app`).
- В «VBI HR Platform» включить право **Чат и уведомления**, затем повторный вход админа через Битрикс.

### Bitrix OAuth: надёжнее сохранение токена для колокольчика

- `bitrixOAuthServiceToken.ts`: писать в `server/data/` (writable), не только в `/etc/vbi-hr`.
- Токен сохраняется при входе admin/hr через Битрикс; после успеха — `?bitrix_notify=1`.
- Причина тишины #1024: на проде не было файла refresh_token → `im.notify.system.add` пропускался.

### Отпуска: системные уведомления im.notify.system.add

- `bitrixVacationNotify.ts`: колокольчик через [`im.notify.system.add`](https://apidocs.bitrix24.ru/api-reference/chats/notifications/im-notify-system-add.html) (от системы).
- Без `MESSAGE_OUT` (не уходит в SMS/email). Без OAuth — не шлём личный чат.
- Проверка: админ вход через Битрикс → заявка → уведомление в колокольчике у согласующего.

### Отпуска: im.notify.personal.add по документации Bitrix

- `bitrixVacationNotify.ts`: только `im.notify.personal.add` (OAuth), параметры USER_ID/MESSAGE/MESSAGE_OUT/TAG/SUB_TAG по [apidocs](https://apidocs.bitrix24.ru/api-reference/chats/notifications/im-notify-personal-add.html).
- Проверка: админ вход через Битрикс → заявка → колокольчик у согласующего.

### Отпуска: колокольчик Битрикса через OAuth-приложение

- `im.notify.*` только через OAuth refresh_token приложения «VBI HR Platform» (`bitrixOAuthServiceToken.ts`), не через вебхук.
- При входе админа через Битрикс сохраняется `refresh_token` в `server/data/bitrix-oauth-service.json`.
- Авто-чат в личку выключен при рабочем OAuth (`BITRIX_VACATION_NOTIFY_CHAT_FALLBACK` по умолчанию `false`).
- **Без OAuth-токена** — запасной `im.message.add`, иначе согласующий ничего не получит.
- Токен: `/etc/vbi-hr/bitrix-oauth-service.json` или `server/data/bitrix-oauth-service.json`.
- Проверка: админ входит через Битрикс → тестовая заявка → колокольчик у согласующего.

### Отпуска: колокольчик Битрикса + запасной чат

- Сначала `im.notify.*` (колокольчик), при ложном `result` — `im.message.add` в личный чат.
- Проверка `result`: ID < 1e9 (иначе на коробке приходит timestamp и доставки нет).
- `CLIENT_ID` OAuth-приложения в query REST-вызова для TAG/SUB_TAG.
- Пути: `bitrixVacationNotify.ts`.

### Отпуска: доставка в Битрикс через im.message.add

- На коробке `crm.vbi.ru` `im.notify.*` через входящий вебхук возвращает HTTP 200, но уведомление не появляется у получателя; основной канал — `im.message.add` в личный чат согласующему.
- `bitrixVacationNotify.ts`: проверка, что `result` — ID сущности (< 1e9), а не timestamp.
- Проверка: заявка на отпуск → личное сообщение в мессенджере Битрикса у согласующего.

### Отпуска: надёжнее im.notify в Битрикс

- `bitrixVacationNotify.ts`: прямой fetch без `createError`, fallback `im.notify` → `im.notify.system.add`, уникальный `TAG`, ссылка с `?tab=approval`, логи в stderr.
- Исправлен путь `DELETE /api/notifications/:id` (`[id]/delete.delete.ts`) — сборка localhost.

### Уведомления по отпускам: закрытие и рабочие ссылки

- Серый крестик справа сверху у каждого уведомления (колокольчик и `/notifications`) — `DELETE /api/notifications/:id`.
- Кнопки «Согласование» / «Мои отпуска» ведут через `navigateTo`; у руководителя — `/vacations?tab=approval`.
- Пути: `VacationNotificationsBell.vue`, `notifications.vue`, `useUserNotifications.ts`, `vacations.vue`.

### Отпуска: исправлены параметры im.notify в Битрикс

- `bitrixVacationNotify.ts`: `im.notify.system.add` с `USER_ID` и `MESSAGE` (раньше `to`/`message` — уведомления уходили владельцу вебхука, не согласующему).
- Проверка: заявка на отпуск → пуш в колокольчик Битрикса у руководителя/директора.

### Отпуска: у руководителей убрано редактирование лимита броней

- Блок «Лимит броней на месяц» удалён из `ManagerVacationAside.vue`; лимиты фиксированы (5 на отдел, 1 в подгруппе).
- Проверка: войти директором/тимлидом → боковая панель без поля лимита; `+бронь` у сотрудников по-прежнему блокируется при исчерпании.

### Отпуска: уведомления согласующим в Битрикс (im.notify)

- При создании заявки — `im.notify` прямому руководителю (или директору, если одноэтапное согласование).
- Digital / QA: после согласования тимлидом — уведомление директору отдела.
- Входящий вебхук `BITRIX_WEBHOOK_URL` с правом **im**; ссылка на `/vacations` из `APP_PUBLIC_URL` или `BITRIX_REDIRECT_URI`.
- Пути: `bitrixVacationNotify.ts`, `vacationNotifications.ts`.
- Проверка: `BITRIX_WEBHOOK_URL` в `frontend/.env` → заявка от демо-сотрудника → пуш в колокольчик Битрикса у согласующего.

### Отпуска: не более одного групхеда в отпуске на период

- В grouped-отделах (Digital) руководители групп (Цхай, Попов, Лунин, Носков) не могут подать заявку на даты, пересекающиеся с отпуском другого групхеда (pending/approved).
- Плашка «Пересечение с отпуском другого групхеда» в форме заявки при выборе дат; сервер отклоняет `POST /api/vacations/requests` с 409.
- Пути: `vacationGroupLeadOverlap.ts`, `vacationRequestMutations.ts`, `EmployeeVacationPanel.vue`.
- Проверка: `node frontend/scripts/test-vacation-group-lead-overlap.mjs`; под Луниным — согласованный отпуск 1–10 авг → под Цхаем те же даты — предупреждение и отказ.

### Отпуска: лимиты броней по отделу и группе (Digital)

- Двухуровневый лимит предварительных броней: **5 на весь отдел** в месяц (по умолчанию, настраивается руководителем) и **1 бронь внутри подгруппы** (фиксировано).
- Группировка отдела как в Excel: `vacationDepartmentGroups.ts` (Digital + демо QA на localhost).
- Директор Digital видит календарь по всем подгруппам; тимлид — только свою; сотрудники Digital — весь отдел в «Общий».
- Строка дневных счётчиков отпускников в детальном календаре — только у директора отдела, по всему отделу.
- Серый `+бронь` и попап при исчерпании лимита; руководитель меняет лимит отдела в `ManagerVacationAside`.
- API: `PATCH /api/vacations/reservation-caps` (`groupId`, `cap`); поле `reservationMonthlyCapsByGroup` в `vacations.json`.
- Пути: `vacationReservationCaps.ts`, `vacationDepartmentGroups.ts`, `vacationReservationCapMutations.ts`, `EmployeeVacationPanel.vue`, `ManagerVacationAside.vue`, `VacationDetailedCalendar.vue`.
- Проверка: сотрудник Digital → месяц с бронью в своей группе → `+бронь` серая; директор → боковая панель «Лимит броней на месяц»; `node frontend/scripts/test-vacation-reservation-caps.mjs`.

## 2026-07-10

### Удалён режим «Отдел Тестировщики» на /vacations

- Убран переключатель наблюдателя отдела; сотрудники (в т.ч. демо QA) видят обычный экран с «Мой календарь / Общий».
- Удалены `vacationDepartmentView.ts`, `useVacationDepartmentView.ts`; упрощён `vacations.vue`.
- Проверка: войти как сотрудник отдела → `/vacations` — нет переключателя «Отдел …», только стандартный UI.

### Обучалка: доработки (production)

- Пропустившие обучение могут пройти его через «?» и получить ачивку.
- На шаге 4 календарь переключается на «Мой календарь», если был «Общий».
- Пути: `useVacationTraining.ts`, `VacationTrainingHelpButton.vue`, `EmployeeVacationPanel.vue`.

### Демо «Тестировщики» — только localhost

- QA-команда (4 сотрудника + руководитель), демо-заявки и брони — при `NODE_ENV=development` или `NUXT_PUBLIC_QA_TEST_DEPARTMENT=1` в `.env`.
- На production/staging не включается.
- Пути: `qaTestDepartment.ts`, `qaTestVacationSeed.ts`, `vacationsStore.ts`.

### Обучалка отпусков: без пропуска, повтор и кнопка «?»

- Убрана кнопка «Пропустить» в квесте и в стартовом приглашении — обучение нужно пройти до конца.
- После первого прохождения в правой панели появляется чёрная кнопка «?» (фиксирована внизу справа, не скроллится).
- Повторный квест без награды: на последнем шаге кнопка «Завершить».
- Тексты шагов и строка прогресса (`квест. Шаг N из 9`), уточнён шаг 4 про учебную бронь.
- Пути: `useVacationTraining.ts`, `VacationTrainingHelpButton.vue`, `VacationTrainingOverlay.vue`, `EmployeeVacationAside.vue`, `vacationTrainingQuest.ts`, `main.css`.
- localStorage: `vbi-vacation-training-v1` (без изменений ключа).
- Проверка: пройти квест → закрыть награду → «?» внизу панели → повтор без ачивки.

### Ребрендинг: VIBE VBI

- Публичное название **VIBE VBI** в сайдбаре, входе, онбординге, title вкладки (`platformBrand.ts`).

### Уведомления: надёжность и контраст

- Загрузка user/admin-уведомлений при старте; fallback `platform_user_id` для адресата.
- Контраст текста в выпадающем списке колокольчика.
- Пути: `useAppBootstrap.ts`, `employeesStore.ts`, `vacationNotifications.ts`, `main.css`.

## 2026-07-09

### Уведомления: пустое состояние с иллюстрацией

- При отсутствии уведомлений вместо белой карточки — прозрачный PNG по центру и подпись «Новых уведомлений нет».
- Пути: `EmptyNotificationsSketch.vue`, `pages/notifications.vue`, `pages/admin/notifications.vue`, `public/images/notifications-empty-dragon.png`.
- Проверка: открыть `/notifications` или `/admin/notifications` без новых уведомлений — дракончик на фоне страницы, без белой плашки.

### Production: меню только по отпускам

- На бое снова все вкладки в меню, но недоступные — с замочком (не кликаются); исправлен сбой, когда на production открывались все разделы.
- `useLaunchScope`: на `appEnv=production` принудительно режим `vacations`, даже если `launchScope` по ошибке `full`.
- Пути: `useLaunchScope.ts`, `usePlatformContext.ts`.

### Отпуска: полировка обучалки и броней

- Квест 4–6: позиция карточки (у декабря / поверх календаря), z-index, автопрокрутка aside к цели.
- Правая панель: блокировка ручной прокрутки на время квеста; подсветка без фиолетовой рамки.
- Учебные заявки сверху в «Мои заявки»; кнопка «Закрыть» награды через 3 с.
- Пути: `VacationTrainingOverlay.vue`, `EmployeeVacationAside.vue`, `vacationTrainingQuest.ts`, `useVacationTraining.ts`.

## 2026-07-08

### Отпуска: срок жизни предварительной брони

- Прошедшие месяцы: нельзя ставить/редактировать бронь; «+бронь» скрыта в последний день месяца.
- В последний день месяца — уведомление сотруднику и руководителю (`vacation_reservation_expiring` / `_manager`); после окончания месяца бронь снимается автоматически при `GET /api/vacations`.
- Кнопка «Уточнить даты» переименована в «Создать заявку»; правки квеста 4–6 и 9 (позиция карточки у декабря / поверх календаря, z-index, прокрутка aside); «Создать заявку» у брони неактивна во время обучения; новые заявки сверху в «Мои заявки».
- Пути: `vacationReservations.ts`, `vacationReservationLifecycle.ts`, `VacationTrainingOverlay.vue`, `EmployeeYearCalendar.vue`.

### Отпуска: предварительная бронь (месяц без точных дат)

- Отдельная сущность `VacationReservation`: месяц + длительность (1–28 дн.), без согласования, баланса и Битрикс.
- API: `POST /api/vacations/reservations`, `PATCH /api/vacations/reservations/:id`, `DELETE /api/vacations/reservations/:id`.
- «Мой календарь»: кнопка «+бронь», клик по плашке — редактирование; квест 4–5 в обучалке (декабрь, «Создать заявку»).
- Пути: `vacationReservations.ts`, `useVacations.ts`, `vacationReservationMutations.ts`, `VacationReservationDialog.vue`, `EmployeeYearCalendar.vue`, `VacationMonthlyCalendar.vue`, `VacationDetailedCalendar.vue`.
- localStorage: `vbi-vacations-state-v6` (миграция с v5).
- Проверка: создать бронь на июль → видна в team-календарях → «Создать заявку» → pending-заявка, бронь исчезла; вторая бронь в тот же месяц — ошибка 409.

### Отпуска: уточнён текст шага 3 квеста редактирования

- В `frontend/app/data/vacationTrainingQuest.ts` уточнён текст шага про редактирование/удаление заявки (добавлено уточнение про «отгуленный отпуск»).

### Обучалка сотрудника: шаг про редактирование заявки

- После «Рассчитать доступные дни к дате» — квест 3 про «⋯» (изменить даты / удалить заявку).
- Пути: `vacationTrainingQuest.ts`, `VacationTrainingOverlay.vue`, `vacationTrainingMarkerAssets.ts`.

### Общий календарь: руководитель отдела в составе команды

- В «Общем» календаре и в режиме руководителя (Детально / По месяцам) отображается руководитель отдела, в т.ч. если он в другом отделе в справочнике (например, Лашин у «Отдел продаж»).
- Руководитель видит себя в своём календаре команды.
- Пути: `vacationTeamScope.ts` (`enrichTeamMembers`), `vacations.vue`, `useVacationDepartmentView.ts`.

### Отпуска: админ добавляет отпуск сотруднику из графика

- Кнопка «+ Добавить отпуск» в тулбаре календаря (слева от года) для роли `admin`.
- Диалог: выбор сотрудника, даты без ограничения «не в прошлом»; отпуск сразу согласуется (`force approve`).
- Пути: `AdminAddVacationDialog.vue`, `VacationTeamCalendar.vue`, `useVacations.ts` (`year` в `addRequest`).

### Отпуска: кегль дат в «Общем» календаре только на desktop

- Исправлено: `0.78rem` в плашках дат применялся на всех экранах и обрезал текст на ноутбуке.
- На ноутбуке снова `0.52rem`; увеличение до `0.78rem` только в `@media (min-width: 1500px) and (min-height: 850px)`.
- Путь: `frontend/app/assets/main.css`.

## 2026-07-07

### Отпуска: увеличен кегль дат в «Общем» календаре на desktop

- В employee-team таблице кегль дат в плашках сделан как у ФИО (0.78rem) для лучшей читаемости на 1600x900+.
- Путь: `frontend/app/assets/main.css`.

### Согласование отпусков: self-approval отключён для руководителей

- Руководитель больше не видит собственную заявку в «Согласовании».
- Для директора Digital/QA собственная заявка уходит на согласование к его руководителю (например, Ревзина Ксения → Юдин Вадим).
- Нормализация старых `pending` заявок: шаг `director` для self-заявки автоматически трактуется как `manager`.
- Пути: `vacationApproval.ts`, `useVacations.ts`, `vacationRequestMutations.ts`.

### Auth: подписанный OAuth state (фикс «Неверный state»)

- `server/utils/oauthState.ts` — state с HMAC; callback проверяет подпись, не только cookie.
- Выход очищает cookie `bitrix-oauth-state*`.
- На :8080 с ключами боя — предупреждение на экране входа (`/api/auth/config` → `oauthMisconfigured`).
- Пути: `bitrix.get.ts`, `bitrix/callback.get.ts`, `session.delete.ts`, `useBitrixAuthConfig.ts`.

### Отпуска: убран отдельный режим «Отдел DEV» для Барановой Юлии

- Удалена из `DEPARTMENT_VACATION_VIEWERS` — общий календарь отдела через вкладку «Общий» (`vacationTeamScope.ts`).
- Демо-наблюдатель «Тестировщики» (`katya@vbi.local`) без изменений.

### Сотрудник: общий календарь отпусков команды

- Переключатель «Мой календарь / Общий» — боковые вкладки справа от рамки (`VacationCalendarScopeToggle.vue`).
- **Общий:** помесячная таблица как у руководителя; область видимости по отделу/группе (`vacationTeamScope.ts`, `useEmployeeVacationTeamView.ts`).
- Digital: сотрудники — своя группа; групхеды — команда; Ревзина К. — весь Digital; остальные отделы — весь отдел.
- localStorage: `vbi-employee-vac-calendar-scope-v1`.
- Скругление правых углов рамки в обоих режимах.
- Проверка: `/vacations` под сотрудником Digital → вкладка «Общий» → таблица по месяцам, ФИО в колонке.

### Обучалка по отпускам на production

- `NUXT_PUBLIC_VACATION_TRAINING_ENABLED` по умолчанию включена (отключение: `=false`).

### Auth: изоляция теста (:8080) и боя (:80)

- Разные cookie сессии: `vbi-session-staging` / `vbi-session`; OAuth state — отдельно по окружению.
- На `:8080` нельзя использовать `CLIENT_ID` боевого приложения Битрикс — нужно третье приложение с callback `:8080` (`/api/auth/config` → `oauthMisconfigured`).
- Проверка: отдельные ключи в `bitrix.env` (тест) и `bitrix-production.env` (бой); вход на `:8080` остаётся на `:8080`.

### Обучалка руководителя: доработки UX

- Промпт обучения над блоком «Заявки» в правой панели; скрывается после прохождения или пропуска.
- Шаг 2: плашка «Следующий этап» только для группхедов Digital (Носков, Цхай, Попов, Лунин).
- Шаг 3: автопереход на вкладку «Календарь»; переключение «Детально / По месяцам» не закрывает квест — только кнопка «Завершить».
- Пути: `ManagerVacationAside.vue`, `ManagerVacationTrainingOverlay.vue`, `vacations.vue`, `vacationTrainingQuest.ts`.

### Календарь «По месяцам»: плашки в границах столбца

- Даты в формате `03.12-10.12`, обычный (не жирный) шрифт, уменьшенный размер — плашка целиком в ячейке месяца.
- Пути: `useVacations.ts` (`formatMonthVacationRange`), `main.css` (`.vac-team-calendar .vac-block`).

## 2025-07-03

### Обучалка для руководителя в отпусках + ачивка за оба квеста

- В `ManagerVacationAside` под блоком «Заявки» добавлен `ManagerVacationTrainingPrompt` (визуально как у сотрудника).
- Новый квест руководителя: согласование заявок, значения плашек-предупреждений, переключение календаря «Детально / По месяцам».
- Добавлены `useManagerVacationTraining.ts` и `ManagerVacationTrainingOverlay.vue`.
- Ачивка «Календарь отпусков» для руководителя показывается только после двух завершённых квестов: сотрудника и руководителя.
- Проверка: зайти руководителем на `/vacations`, пройти оба обучения и получить награду на финальном шаге второго квеста.

### DEV: календарь отпусков отдела для Барановой Юлии (без согласования)

- Наблюдатель отдела: переключатель «Отдел DEV» / «Сотрудник» как у руководителя; календарь и статистика по всему DEV.
- Вкладка «Согласование» скрыта — роль в справочнике остаётся `employee`.
- Конфиг: `utils/vacationDepartmentView.ts` (`DEPARTMENT_VACATION_VIEWERS`); composable `useVacationDepartmentView.ts`.
- Демо: `Даша Тестова` (вход `katya@vbi.local`) — отдел «Тестировщики».
- Режим «Сотрудник» у наблюдателя — тот же полноэкранный календарь, что у обычного сотрудника (не embedded).
- Календарь отдела при малом числе строк не растягивается на весь экран (лишнее белое поле).
- Проверка: войти как Баранова → `/vacations` → режим «Отдел DEV» — весь отдел; «Сотрудник» — свои заявки. Демо: `katya@vbi.local` → «Отдел Тестировщики».

### Уведомления по отпускам (сотрудник и руководитель)

- Отдельно от админских (Bitrix): колокольчик «Отпуска» в режиме сотрудника, `/notifications`.
- Руководителю: новая заявка; изменение дат и удаление — руководитель из справочника **и** директор отдела (при двухэтапном согласовании).
- Сотруднику: согласовано, отклонено, переход на следующий этап согласования.
- Хранение: `user-notifications.json`, API `/api/notifications`; создание в `vacationNotifications.ts`.
- Проверка: заявка от сотрудника → badge у руководителя; согласование → у сотрудника.

### Календарь команды: подсветка строки сотрудника при наведении

- Детальный и помесячный вид: при hover подсвечивается вся строка (ФИО, остаток, отпуска).
- Пути: `main.css`, `VacationMonthlyCalendar.vue`.

### Календарь команды: ровная сетка дней без просветов

- Непрозрачный фон ячеек, вертикальные линии через inset-shadow; выходные — сплошные колонки между строками.
- Окно календаря на `100dvh`, скролл только внутри таблицы.
- Пути: `main.css`, `VacationTeamCalendar.vue`.
- Проверка: `/vacations` → «Детально» — нет зернистых щелей; hover по сотруднику.

### Отпуска: заявки сохраняются по одной, без гонки

- Вместо `PUT /api/vacations` (перезапись всего файла) — `POST /api/vacations/requests`, `PATCH` и `DELETE` по id заявки.
- Сервер читает актуальный `vacations.json`, добавляет/меняет одну строку, выделяет id; параллельные запросы сериализуются (`mutateVacations`).
- Клиент: `useVacations` — после каждой операции подтягивает состояние с сервера; при ошибке создания — сообщение в форме.
- Пути: `server/utils/vacationRequestMutations.ts`, `server/api/vacations/requests.*`, `composables/useVacations.ts`.
- Проверка: два браузера → оба создают заявку → F5 — обе на месте; старый `PUT` отвечает 410.

### Календарь команды: названия отделов закреплены при горизонтальном скролле

- Строка отдела: sticky слева (детальный и помесячный вид).
- Пути: `VacationDetailedCalendar.vue`, `VacationMonthlyCalendar.vue`, `main.css`.

### Календарь команды: шапка закрепляется при вертикальном скролле

- Детальный вид: весь `thead` (Сотрудник, Остаток, месяцы и даты) остаётся на месте при прокрутке вниз.
- Путь: `main.css`.

### Календарь команды: шапка «Сотрудник» / «Остаток»

- Детальный вид: единая ячейка на 3 строки шапки (`rowspan`), закрепление при горизонтальном скролле.
- Путь: `VacationDetailedCalendar.vue`, `main.css`.

### Календарь команды: ширина колонок по сетке дней

- Детальный вид: «Сотрудник» = 8 ячеек дня (176px), «Остаток» = 3 ячейки (66px); ФИО до 2 строк, должность до 2 строк.
- Помесячный вид: узкая колонка «Сотрудник» (~104px), ФИО до 2 строк.
- Пути: `VacationDetailedCalendar.vue`, `VacationMonthlyCalendar.vue`, `main.css`.
- Проверка: `/vacations` и `/admin/vacations` → «Детально» / «По месяцам».

### Квест-обучение: блок «Пройти обучение?» выше легенды до прохождения

- Пока квест не пройден и не пропущен — «Тренировочный полигон» сразу под «Мои заявки», легенда ниже.
- После прохождения промпт скрывается, легенда остаётся под заявками.
- Путь: `EmployeeVacationAside.vue`.

### Квест-обучение: сброс выделения календаря при «Назад» с шага заявки

- С шага 4 (заявка) назад на календарь — даты в форме и подсветка диапазона сбрасываются.
- Путь: `EmployeeVacationPanel.vue`.

### Квест-обучение: кнопки «Назад» и «Продолжить» вместо стрелок

- Навигация по шагам квеста: текстовые кнопки вместо иконок-стрелок (фокус-группа путала стрелку с действием на экране).
- Пути: `VacationTrainingOverlay.vue`, `main.css`.

### Аватары: хранение на сервере, видны в списке сотрудников

- Раньше аватар сохранялся только в `localStorage` браузера сотрудника — админ его не видел.
- API: `GET /api/avatars`, `PUT /api/avatars/me`; данные в `server/data/user-avatars.json`.
- При входе локальный аватар без записи на сервере подгружается автоматически.
- Пути: `useAvatars.ts`, `avatars.client.ts`, `userAvatarsStore.ts`, `admin/employees.vue`.
- Проверка: сотрудник выбирает аватар → админ обновляет «Сотрудники» — та же иконка в первой колонке.

### График отпусков: прошедшие согласованные заявки без правок

- Согласованный отпуск с прошедшими датами нельзя редактировать и удалять — меню ⋯ скрыто.
- Пути: `vacationCalendar.ts` (`isPastApprovedVacationRequest`), `EmployeeVacationAside.vue`, `useVacations.ts`.
- Проверка: заявка «Согласован» с `end` в прошлом — без ⋯; будущие и «На согласовании» — меню есть.

## 2025-07-02

### Ачивка «Календарь отпусков» — экран награды с конфетти

- Иллюстрация ачивки (tier 1/10): `public/achievements/kalendar-otpuskov.png`.
- После «Получить награду» на финальном шаге квеста: конфетти, появление значка по центру, название и подпись снизу; закрытие по тапу или через ~3.6 с.
- Пути: `vacationTrainingQuest.ts`, `VacationTrainingOverlay.vue`, `main.css`.
- Проверка: localhost с `NUXT_PUBLIC_VACATION_TRAINING_ENABLED=true` → отпуска → квест до шага 6 → «Получить награду».

## 2025-06-17

### Квест-обучение: награда = ачивка, без монет

- За завершение обучалки больше не начисляются монеты (`useVacationTraining.ts`).
- Финальный экран квеста обновлён: «Получить ачивку», без текста про `+монеты`.
- Пути: `app/composables/useVacationTraining.ts`, `app/components/VacationTrainingOverlay.vue`, `app/data/vacationTrainingQuest.ts`.
- Проверка: пройти квест до последнего шага и завершить — только ачивка, без изменений валюты.

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

## 2026-08-05

### Отпуска: «Мой календарь» снова показывает сетку

- **Причина:** в `main.css` у `.vac-emp-calendar-pane` стояло `flex: 0 1 auto` / `height: auto` — рамка схлопывалась, сетка 12 месяцев имела высоту 0.
- **Исправление:** для личного вида вернули `flex: 1` и `height: 100%` у `.vac-emp-calendar-main`; режим «Общий» (`--team`) без изменений.
- **Проверка:** `/vacations` → вкладка «Мой календарь» — видна сетка 4×3 месяцев.

### Отпуска: правые углы рамки у вкладок «Мой / Общий»

- Убрана внутренняя двойная рамка/скругление у `.vacation-calendar-wrap` в режиме «Общий».
- Со вкладками: `border-radius` только слева, `border-right: none` — стык с ярлыками без «корявого» угла.
- **«Мой календарь»:** снова все 4 скруглённых угла (правило `--with-tabs` ошибочно обнуляло правые и для личного вида).
- Файлы: `main.css`.
- Проверка: `/vacations` → «Общий» (короткая команда) — один контур рамки, ровный правый край.

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
