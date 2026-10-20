# Pit Stop 14 — ивент закрыт (2026-10-20)

Корпоративный квест + гонка (28.09–10.10.2026). Интерфейс удалён: страницы `/event/pit-stop/**`
(редирект на `/` в `nuxt.config.ts` → `routeRules`), `/admin/quest-dashboard`, API `/api/event/pit-stop/*`,
cron `pit-stop-finalize`, ассеты `public/events/pit-stop-14/`.

## Что осталось и зачем

- `types.ts`, `copy.ts`, `timeline.ts`, `trackDrive.ts` — типы/константы, на которые опираются
  хранилища `server/utils/pitStopStore.ts` и `pitStopRaceStore.ts` (данные, миграция в БД `engagement`,
  `db-migrate`, `db-health`, тесты этапа 8).
- `rewards.ts` — id ачивки `pit-stop-14` «Легенда трека — 14». Ачивка у победителей остаётся:
  `usePitStopWinners` → `GET /api/achievements/pit-stop-14-winners` (топ-3 из `pit-stop-race.json` / `engagement`).
- Данные (`server/data/pit-stop-14.json`, `pit-stop-race.json`, фото кофе) и таблицы `engagement.*` не трогаем.
