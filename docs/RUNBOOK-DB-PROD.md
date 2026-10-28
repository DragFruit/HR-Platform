# Рунбук: перевод боя на PostgreSQL

Статус на 2026-10-28: **не выполнен**. Код всех этапов в `main` с 19.10, стейдж живёт на Postgres,
бой (`45.12.74.25:80`, `/var/www/vbi-hr`, сервис `vbi-hr`) работает на JSON-файлах.

Переключение — операция на сервере: кода писать не надо, пересобирать нечего.
Исключение — пункт 1 (опросы), там нужна правка whitelist.

**Выполнять только по явному «ок» заказчика и в нерабочее время** (см. «Окно простоя»).

---

## Что переключаем

Код умеет оба хранилища. Домен уходит в Postgres, когда одновременно заданы `DATABASE_URL`
и флаг домена. На бою `DATABASE_URL` (база `vbi_prod`) **уже есть**; флагов нет — отсюда JSON.

| Флаг | Домен | Файлы, с которых уходим |
|---|---|---|
| `DB_NOTIFICATIONS` | уведомления сотрудников | `user-notifications.json` |
| `DB_CORE` | сотрудники, руководители, оргструктура, стоп-лист | `employees.json`, `employee-managers.json`, `org-structure.json`, `employee-access-denylist.json` |
| `DB_VACATIONS` | заявки, брони, счётчики id, журналы напоминаний | `vacations.json`, `vacation-pre-reminders.json`, `vacation-manager-month-reminders.json` |
| `DB_ADMIN_NOTIFICATIONS` | уведомления админки | `admin-notifications.json` |
| `DB_PROFILE` | аватары, лента, награды продаж, пароли Vibe, вишлисты | `user-avatars.json`, `wishlists.json` и др. |
| `DB_IDEAS` | банк идей | `ideas.json` |
| `DB_KNOWLEDGE` | статьи базы знаний | `knowledge-articles.json` |
| `DB_ENGAGEMENT` | пит-стоп и гонка | `pit-stop-14.json`, `pit-stop-race.json` |
| `DB_SURVEYS` | опросы, ответы, счётчики | `surveys.json`, `survey-responses.json`, `survey-starts.json`, `survey-visits.json` |
| `DB_ADAPTATION` | адаптация | `adaptation-state.json` |
| `DB_VPN` | учёт VPN-ключей | `vpn-keys.json` |

Решение от 19.10: **флаги ставятся все сразу**, не по одному.

Аудит (`audit`) на бою уже пишется в базу — он включается от одного `DATABASE_URL`, без флага.

---

## 1. До окна: опросы в меню (правка кода)

Решение заказчика от 19.10: на бою опросы доступны **только в админке**. Сотрудник не должен
видеть раздел в меню даже с замком. Публичные ссылки `/s/<slug>` обязаны работать.

Сейчас на бою `LAUNCH_SCOPE=vacations`, и `isPathAllowed` (`frontend/app/composables/useLaunchScope.ts`)
пропускает только whitelist. В нём **нет** ни `/admin/surveys`, ни `/s`. Значит:

- добавить `/admin/surveys` — админка опросов открывается;
- добавить `/s` — публичная ссылка на опрос работает;
- раздел для сотрудника не добавлять — он останется скрытым сам собой.

Правка точечная, по правилу `production-nav-locks.mdc`: трогаем только `isPathAllowed`,
hard-lock и host-gate не снимаем, `LAUNCH_SCOPE=full` не ставим.

Выкатывается обычным путём: `staging` → проверка на `:8080` → merge в `main` → CI → Play.

---

## 2. Окно простоя

Между бэкапом и рестартом есть щель: запись, сделанная в это время, уйдёт в JSON и в базу не доедет
(импорт одноразовый, по маркеру). Поэтому — вечер или выходной, когда в отпусках и идеях никто не пишет.
Заявку на отпуск, поданную в этот момент, после переключения придётся завести руками.

Предупредить HR, что платформа на 5–10 минут станет недоступна.

---

## 3. Бэкап (обязательно)

```bash
ssh root@45.12.74.25 "bash /var/www/vbi-hr/deploy-scripts/run-data-backup.sh /var/www/vbi-hr"
```

Кладёт в `/var/www/vbi-hr/server/data/backups/full/`: `tar.gz` всего `server/data` и `pg_dump -Fc`
базы `vbi_prod`. Убедиться, что оба файла с сегодняшней датой на месте и не нулевого размера.

---

## 4. Флаги

Прописать в `/etc/vbi-hr/bitrix-production.env`:

```
DB_NOTIFICATIONS=1
DB_CORE=1
DB_VACATIONS=1
DB_ADMIN_NOTIFICATIONS=1
DB_PROFILE=1
DB_IDEAS=1
DB_KNOWLEDGE=1
DB_ENGAGEMENT=1
DB_SURVEYS=1
DB_ADAPTATION=1
DB_VPN=1
```

**Важно:** процесс читает не этот файл, а `/var/www/vbi-hr/.env` — его копию, которую деплой делает
каждый раз (`deploy-remote.sh`, «копирование … → .env»). Поэтому после правки `/etc/...` нужно
либо скопировать файл руками, либо прогнать деплой. Руками:

```bash
ssh root@45.12.74.25 "cp /etc/vbi-hr/bitrix-production.env /var/www/vbi-hr/.env \
  && chown deploy:deploy /var/www/vbi-hr/.env && chmod 600 /var/www/vbi-hr/.env"
```

Если этого не сделать, рестарт ничего не изменит и всё останется на JSON — тихо, без ошибки.

---

## 5. Рестарт

```bash
ssh root@45.12.74.25 "systemctl restart vbi-hr && systemctl is-active vbi-hr"
```

При старте плагин `frontend/server/plugins/db-migrate.ts` прогоняет миграции и делает **разовый**
импорт каждого JSON в свою схему, помечая его маркером в `*.json_imports`. Повторные рестарты
импорт не дублируют.

Устройство на случай сбоя заложено в код:

- миграции упали → база выключается целиком, всё продолжает работать на JSON, процесс не падает;
- импорт одного домена упал → на файлах остаётся **только он**, остальные уже в базе;
- production-сборка откажется работать с базой `vbi_staging` (и staging с `vbi_prod`).

---

## 6. Проверка

```bash
ssh root@45.12.74.25 "journalctl -u vbi-hr -n 120 --no-pager | grep -iE 'migrat|import|postgres|db'"
```

Затем под админом открыть `GET /api/admin/db-health` — он отдаёт `{enabled, ok, latencyMs, migrations, domains}`,
где по каждому домену написано `postgres` или `json`. **Все перечисленные в таблице должны быть `postgres`.**
Если домен остался `json` — смотреть лог импорта именно по нему.

Живьём на `http://45.12.74.25/`:

- отпуска: календарь, «Мои заявки», подать заявку и удалить её;
- профиль: аватар, вишлист;
- база знаний: статья открывается, поиск и чат-бот отвечают;
- идеи: список и добавление;
- уведомления: колокольчик не пустой;
- админка: сотрудники, оргструктура, уведомления.

---

## 7. Откат

Снять флаги из `/var/www/vbi-hr/.env` (и `/etc/vbi-hr/bitrix-production.env`) и рестартовать сервис.
JSON-файлы при переезде не удаляются — вернётся состояние **на момент импорта**, всё, что записали
после переключения, останется только в базе и в интерфейс не попадёт.

Поэтому откат имеет смысл в первые минуты. Дальше — только восстановление из бэкапа:

```bash
pg_restore --clean --if-exists -d "$DATABASE_URL" …-db-vbi_prod-<дата>.dump
```

---

## 8. После переключения

- JSON-файлы боя становятся устаревшим снимком. Не править их руками: записи никуда не попадут.
- Еженедельный `vbi-hr-vacations-backup` (вс 03:00 МСК) снимает **файл**, то есть после переезда
  бэкапит снимок. Настоящий бэкап боя — ежедневный `vbi-hr-data-backup` с `pg_dump`.
- `scripts/rollover-vacation-year.mjs` при `DATABASE_URL` + `DB_VACATIONS=1` отказывается работать —
  это задумано, годовой перенос делает сервер.
- `scripts/audit-vacations-block.mjs`, `scripts/import-vacation*.py`, `backfill-vacation-employee-ids.mjs`
  работают с файлом, то есть после переезда видят только бэкап.
- Статьи базы знаний: сид из git сливается в базу при старте раз на версию сида
  (`server/knowledge/seedSync.ts`), удалённая админом сид-статья на рестарте не воскресает.
