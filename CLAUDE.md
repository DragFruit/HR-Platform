# VBI HR платформа

Источник правды — `.cursor/rules/*.mdc` (общие с Cursor; править там, не здесь). Ниже — сжатое ядро. **Если ядро и файл правила расходятся — прав файл правила.** Перед работой в области из таблицы ниже — прочитать указанный файл целиком.

## Ядро (всегда)

**Стенды (слова заказчика):** «тест» = `localhost:3000` (`npm run dev` в `frontend/`, без деплоя); «стейдж» = `http://45.12.74.25:8080/`; «прод»/«бой» = `http://45.12.74.25/` (порт 80). Не называть `:8080`/`staging` «тестом».

**Выкладка — только Git → GitLab CI** (`git-only-deploy.mdc`, новее `commit-staging.mdc` и главнее по пути доставки):
- После готовой обновы, без отдельной просьбы: коммит на `staging` (документация — в том же коммите) → `bash scripts/push-to-gitlab.sh staging` → деплой на `:8080` делает CI (`deploy:staging`).
- `deploy-remote.sh` / rsync / scp — **не** основной путь; только если заказчик сам явно попросил hotfix/аварию.
- Прод — **только после явного «ок на прод»/«выкатывай на прод»**: merge `staging` → `main`, `bash scripts/push-to-gitlab.sh main`, дождаться зелёного `build:production`, `deploy:production` — manual Play. Без согласия не запускать prod-job, не рестартовать `vbi-hr`, не копировать в `/var/www/vbi-hr/`.
- Просто «выкатить»/«деплой» — уточнить: прод или стейдж. Без просьбы о проде — в конце написать, что на стейдже, а для прода нужно «ок».
- Не коммитить секреты (`.env`, ключи Bitrix, пароли VPN), пустые коммиты, посторонний WIP и мусор.

**Замки меню на бою (CRITICAL, `production-nav-locks.mdc`):** бой = `LAUNCH_SCOPE=vacations`, открыто только whitelist в `useLaunchScope.ts`. Без явной фразы заказчика не ставить `NUXT_PUBLIC_LAUNCH_SCOPE=full`, не снимать hard-lock/host-gate (`useLaunchScope`/`useAppEnv`/`productionHost.ts`), не выкладывать на `:80` локальный билд, не обходить `verify-production-build.sh`. Открывать раздел — точечно в `isPathAllowed` и только по просьбе.

**Без демо/QA-сида на проде** (`no-demo-seed-on-production.mdc`): демо только на localhost/`:8080`; гейтить по `appEnv`/QA-флагу, а не фильтром по словам «тест/demo».

**Честность** (`honesty-admit-fix.mdc`): не врать и не перекладывать вину. Ошибся — прямо признай («я сам проставил X без проверки»), сразу исправь, скажи, что проверить. Не выдавать догадку про ID/секреты/статусы за факт.

**Документация** (`docs-maintenance.mdc`): изменение поведения → в том же коммите `docs/CHANGELOG.md` (запись с датой сверху: фича, пути, новые ключи localStorage/env, как проверить); бизнес-правила → `docs/PRODUCT.md`; архитектура/маршруты/composables → `docs/ARCHITECTURE.md`. На русском.

**Рациональный объём** (`rational-scope.mdc`): масштаб решения = масштаб запроса; мелочь правь точечно, на localhost проверяй через HMR, без `npm ci`/полного билда «на всякий случай»; сначала самый короткий путь.

**Автоматизация, не ручные правки** (`automate-not-handfix.mdc`): регулярные процессы (даты, выдачи, напоминания) — в коде + cron/API, не «поправим JSON руками» и не «напомнит агент».

**UI** — сырые экраны полировать сразу (`ui-polish-proactive.mdc`); масштаб платформы 90% не снимать (`platform-scale-90.mdc`).

**Креативные картинки** (мерч, этикетки, упаковка, арт, мокапы) — только через AI-генерацию; код лишь для bleed/die-line/ресайза/векторного текста по просьбе (`creative-images-via-ai.mdc`).

**Роли** (`team-dispatch.mdc`): заказчик называет специалиста — работай только в этой роли (+ её файл `team-role-*.mdc`). Роль не названа — **спроси**, кому задача. Сдача — контролёру, если в задаче есть QA-цикл.

## Читать перед работой с …

| Область (триггеры) | Файл(ы) в `.cursor/rules/` |
|---|---|
| Деплой, CI, ветки, прод/стейдж, push | `git-only-deploy.mdc`, `deploy-production.mdc`, `commit-staging.mdc`, `test-means-localhost.mdc` |
| Замки меню, whitelist, LAUNCH_SCOPE, бой | `production-nav-locks.mdc` |
| Демо/seed, QA-отдел, банк идей на проде | `no-demo-seed-on-production.mdc` |
| Ачивки: каталог, выдача, новый id, категория/публичность | `achievements-backlog.mdc`, `achievements-add-checklist.mdc` |
| Отпуска: уведомления Bitrix, колокольчик, чат-бот, `im.notify` | `bitrix-vacation-notify-no-chat.mdc` |
| Отпуска: «Скачать заявление», ТД/СЗ, approved | `vacation-application-download.mdc` |
| Отпуска: лимиты брони, Цхай, `digital-tskhai`, 1/5 человек | `vacation-tskhai-no-reservation-caps.mdc` |
| Отпуска: правое меню руководителя, aside, геометрия | `manager-aside-locked.mdc` |
| Кот оценки страниц, правый нижний угол, `useBottomRightSlot`, памятка | `bottom-right-slot.mdc`, `kb-rating-cat-edge.mdc` |
| База знаний `/knowledge`, карточки KB | `knowledge-base-design.mdc`, `kb-rating-cat-edge.mdc` |
| Магазин: юбилейный купон, tenure banner | `tenure-banner-size.mdc`, `tenure-banner-1309x180.mdc` |
| ITMO-рамка, квадратики, телеграм-слайды/карусель | `itmo-carousel-frame.mdc` |
| VPN-ключи, WireGuard/AmneziaWG, wg-easy, лимиты | `vpn-key-limits.mdc` |
| Масштаб 90%, `--platform-zoom`, aside уезжает | `platform-scale-90.mdc` |
| Cron, автовыдача, «поправить руками» | `automate-not-handfix.mdc` |
| Полировка экранов, герой, дубли заголовков | `ui-polish-proactive.mdc` |
| Креатив, этикетки, мерч-арт | `creative-images-via-ai.mdc` |
| Роль фуллстак (код, API, Bitrix) | `team-role-fullstack.mdc` |
| Роль UI/UX (экраны, макет) | `team-role-ui-ux.mdc` |
| Роль дизайн продукта (мерч, коробки, наклейки) | `team-role-product-design.mdc` |
| Роль копирайтер (тексты, уведомления) | `team-role-copywriter.mdc` |
| Роль контролёр / QA / «проверь» | `team-role-controller.mdc` |
| Роль моушен (анимация, лоадер) | `team-role-motion.mdc` |
| Роль 3D (Blender, рендер) | `team-role-3d.mdc` |

## Скиллы и документация

- Скиллы, на которые ссылаются правила (`vbi-image`, `vbi-copy`, `team-controller-qa`, `vbi-image-to-video`, `vbi-packaging-design`, `vbi-product-packaging-design`): читать `.cursor/skills/<имя>/SKILL.md`, когда правило говорит «skill X».
- `docs/`: `ARCHITECTURE.md`, `PRODUCT.md`, `DEPLOYMENT.md`, `CI-CD.md`, `BITRIX.md`, `CHANGELOG.md` (новые записи сверху).
