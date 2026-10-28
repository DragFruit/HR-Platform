# Деплой: тест и бой

## Ветки Git

| Ветка | Назначение | `NUXT_PUBLIC_APP_ENV` | Порт на сервере |
|-------|------------|------------------------|-----------------|
| `staging` | Тестовый стенд | `staging` | 3301 |
| `main` | Бой (production) | `production` | 3300 |

**Поток:** фича → merge в `staging` → проверка на тесте → merge в `main`.

На тесте в шапке — плашка **«Тестовый стенд»**.

---

## GitLab (рекомендуется)

**Два контура CI/CD** — подробно: [docs/CI-CD.md](CI-CD.md).

| Задача | Кто | Команда |
|--------|-----|---------|
| 1. Mac → Git | разработчик | `bash scripts/push-to-gitlab.sh staging` |
| 2. Git → сервер | GitLab CI | автоматически после push (бой — кнопка deploy) |

Репозиторий: `ssh://git@ilnizumak.beget.app:2222/vbi/hrplatform.git` (SSH **порт 2222**).

На VPS (Ubuntu/Debian), с клонированным репозиторием или скопированной папкой `deploy/`:

```bash
sudo bash deploy/scripts/install-server.sh
```

Дальше:
- отредактировать `server_name` в `/etc/nginx/sites-available/vbi-hr*.conf.example`;
- включить сайты в `sites-enabled`, `nginx -t && sudo systemctl reload nginx`;
- пользователю `deploy` добавить SSH-ключ для GitLab Runner / вашей машины;
- sudoers для перезапуска без пароля (см. вывод `install-server.sh`).

### 3. Переменные GitLab CI/CD

См. [CI-CD.md](CI-CD.md#задача-2-из-git--сервер). Кратко:

| Переменная | Пример | Назначение |
|------------|--------|------------|
| `SSH_PRIVATE_KEY` | `-----BEGIN OPENSSH...` | Ключ для `deploy@сервер` |
| `DEPLOY_HOST` | `vibe.vbi.ru` или IP | Хост VPS |
| `DEPLOY_USER` | `deploy` | SSH-пользователь |
| `DEPLOY_PATH_STAGING` | `/var/www/vbi-hr-staging` | Каталог теста (опционально) |
| `DEPLOY_PATH_PRODUCTION` | `/var/www/vbi-hr` | Каталог боя (опционально) |

### 4. Пайплайн

См. [CI-CD.md](CI-CD.md). Кратко: push → **build** (авто) → **deploy** (staging авто, main вручную).

### 5. Ручная выкладка (только отладка)

```bash
export DEPLOY_HOST=your.server
export DEPLOY_USER=deploy
# SSH-ключ уже в ssh-agent

bash deploy/scripts/build-and-deploy.sh staging    # тест
bash deploy/scripts/build-and-deploy.sh production # бой
```

---

## Переменные окружения приложения

`frontend/.env.example` → `frontend/.env` локально.

| Переменная | Тест | Бой | Локально |
|------------|------|-----|----------|
| `NUXT_PUBLIC_APP_ENV` | `staging` | `production` | `development` |
| `NUXT_PUBLIC_LAUNCH_SCOPE` | `full` | `vacations` | `full` |
| `DATABASE_URL` (runtime) | `…/vbi_staging` | `…/vbi_prod` | `…/vbi_dev` или пусто |

`NUXT_PUBLIC_*` задаются **при сборке** (`npm run build`), не в runtime на сервере.

---

## Запуск на сервере

```bash
# после выкладки .output
NITRO_HOST=127.0.0.1 NITRO_PORT=3300 node /var/www/vbi-hr/.output/server/index.mjs
```

Управляется через **systemd**: `vbi-hr` (бой), `vbi-hr-staging` (тест). Nginx проксирует 80/443 → 3300/3301.

### Бэкап отпусков

Еженедельный снапшот боя: `vbi-hr-vacations-backup.timer` (вс 00:00 UTC = 03:00 МСК).

```bash
sudo cp deploy/systemd/vbi-hr-vacations-backup.* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now vbi-hr-vacations-backup.timer
sudo systemctl start vbi-hr-vacations-backup.service   # первый снимок сразу
ls /var/www/vbi-hr/server/data/backups/vacations/
```

Восстановить: `cp …/vacations-YYYY-MM-DD.json /var/www/vbi-hr/server/data/vacations.json && sudo systemctl restart vbi-hr`.


### PostgreSQL на сервере (фаза 1 миграции с JSON)

Один кластер Postgres на VPS, две базы: `vbi_prod` (бой) и `vbi_staging` (стейдж), у каждой своя роль, слушает только `localhost`. Пока **никакие данные в базе не живут** — приложение работает на JSON; база нужна, чтобы проверить фундамент (миграции, health, бэкап). Без `DATABASE_URL` всё DB-шное выключено.

Ставит владелец продукта по SSH (sudo-пользователь), из checkout репозитория на сервере или скопировав скрипт:

```bash
sudo bash deploy/scripts/install-postgres.sh
```

Скрипт идемпотентный: ставит `postgresql` из пакетов Ubuntu, `conf.d/vbi-hr.conf` → `listen_addresses = 'localhost'`, создаёт роли/базы `vbi_prod` / `vbi_staging` (случайные пароли, `CONNECT` к чужой базе закрыт) и дописывает `DATABASE_URL=postgres://…@127.0.0.1:5432/<база>` в `/etc/vbi-hr/bitrix-production.env` и `/etc/vbi-hr/bitrix.env` **только если строки ещё нет**. Пароли на экран не выводятся.

Дальше:

```bash
sudo systemctl restart vbi-hr-staging
sudo journalctl -u vbi-hr-staging -n 50 | grep '\[db\]'   # ожидаем: [db] migrations ok applied=1
# под админом в браузере: http://45.12.74.25:8080/api/admin/db-health → {"enabled":true,"ok":true,"migrations":1}
```

Бой (`sudo systemctl restart vbi-hr`) — когда решите; код с DB-плагином попадёт на бой только с релизом `staging → main`. До этого рестарт ничего не меняет.

- Миграции применяются **при старте** сервиса (`server/plugins/db-migrate.ts`, под `pg_advisory_lock`). SQL лежит в артефакте: `.output/server/db/migrations` (копирует хук `nitro:init → compiled` в `frontend/nuxt.config.ts`, rsync деплоя переносит вместе с `.output`).
- Если миграция упала — в журнале `[db] миграции упали — DB выключена до рестарта, JSON работает`; сайт продолжает работать на JSON.
- Страховка стендов: `DATABASE_URL` берётся из окружения процесса при старте (до плагина `load-bitrix-env`), плюс staging-сборка отказывается работать с базой `vbi_prod`, а production — с `vbi_staging`.
- Env-файлы по стендам (`server/utils/standEnvFiles.ts`): плагин `load-bitrix-env` грузит **только файл своего стенда** — staging `/etc/vbi-hr/bitrix.env`, production `/etc/vbi-hr/bitrix-production.env` (плюс `.env`/`bitrix.env` из каталога приложения). Стенд — из запечённого `NUXT_PUBLIC_APP_ENV`; не определён → ничего не грузится. В логе старта: `[env] stand=… loaded: …` (только пути и число ключей). Ключ, нужный стейджу, кладите в `bitrix.env` — из боевого файла он больше не подтянется.

### Ежедневный бэкап данных и базы

`deploy/scripts/run-data-backup.sh <путь стенда>` — `tar.gz` всего `server/data/` (без `backups/`) + `pg_dump -Fc`, если в `<стенд>/.env` есть `DATABASE_URL`. Хранит последние `BACKUP_KEEP` (14) копий каждого вида в `<стенд>/server/data/backups/full/`. Опционально копия вне сервера: `BACKUP_REMOTE=user@host:/path/` (+ `BACKUP_SSH_KEY`) в `/etc/vbi-hr/backup.env`; не задан — шаг пропускается. Скрипт кладёт на сервер обычный деплой (`deploy-remote.sh` → `<стенд>/deploy-scripts/`); `.env` стенда получает `DATABASE_URL` при следующем деплое (копия `/etc/vbi-hr/*.env`).

Установка таймеров (один раз, из checkout репозитория на сервере):

```bash
sudo install -m 644 deploy/systemd/vbi-hr-data-backup.service deploy/systemd/vbi-hr-data-backup.timer \
  deploy/systemd/vbi-hr-staging-data-backup.service deploy/systemd/vbi-hr-staging-data-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now vbi-hr-data-backup.timer vbi-hr-staging-data-backup.timer   # 03:30 / 03:45 МСК
sudo systemctl start vbi-hr-staging-data-backup.service vbi-hr-data-backup.service      # первый снимок сразу
ls -l /var/www/vbi-hr/server/data/backups/full/ /var/www/vbi-hr-staging/server/data/backups/full/
```

Восстановление: JSON — `tar -xzf …-data-<дата>.tar.gz -C <стенд>/server/data` + рестарт сервиса; база — `pg_restore --clean --if-exists -d "$DATABASE_URL" …-db-<база>-<дата>.dump`. Недельный `vbi-hr-vacations-backup` остаётся как есть.


### Два стенда на одном VPS

| Стенд | Ветка | Каталог | Порт | Домен (пример) |
|-------|-------|---------|------|----------------|
| Тест | `staging` | `/var/www/vbi-hr-staging` | 3301 | `hr-test.vbi.agency` |
| Бой | `main` | `/var/www/vbi-hr` | 3300 | `vibe.vbi.ru` |

---

## Перевод боя на PostgreSQL

Бой пока на JSON: `DATABASE_URL` есть, флаги `DB_*` стоят только в staging-env. Порядок переключения,
бэкап, проверка и откат — отдельный документ: [RUNBOOK-DB-PROD.md](RUNBOOK-DB-PROD.md).

## Локальная база (PostgreSQL на Mac)

Docker не нужен — Homebrew:

```bash
brew install postgresql@17
brew services start postgresql@17
/opt/homebrew/opt/postgresql@17/bin/createdb vbi_dev
```

В `frontend/.env` (в gitignore): `DATABASE_URL=postgres://<ваш логин macOS>@localhost:5432/vbi_dev`. Без этой строки приложение работает на JSON как раньше, `GET /api/admin/db-health` → `enabled:false`.

- Миграции применяются сами при `npm run dev` / старте `.output` — в логе `[db] migrations ok applied=N`.
- Новая таблица: схема в `frontend/server/db/schema/*.ts` → `npm run db:generate -- --name <имя>` → SQL в `frontend/server/db/migrations/` коммитим вместе с кодом.
- `psql vbi_dev` (из `/opt/homebrew/opt/postgresql@17/bin`) — посмотреть таблицы.
- На сервере Ubuntu ставит свою мажорную версию (24.04 → 16); миграции простые SQL, совместимы.

---

## GitHub (опционально)

Если используете GitHub параллельно:
- **CI** — `.github/workflows/ci.yml`
- **Артефакт** — `release-artifact.yml`

Выкладка на VPS через GitLab удобнее (SSH deploy в одном месте).

### Первое подключение GitHub

```bash
git remote add origin git@github.com:ВАШ_ОРГ/vbi-hr.git
git push -u origin main
./scripts/setup-git-branches.sh
git push -u origin staging
```


---

## Что не коммитить

- `frontend/.env` — только `.env.example`
- `node_modules/`, `.output/`, `.nuxt/`

---

## Чеклист первого боя

- [ ] Репозиторий в GitLab, ветки `staging` и `main` запушены
- [ ] `install-server.sh` на VPS, nginx + systemd
- [ ] DNS на домен(ы), при необходимости certbot / SSL
- [ ] CI variables: `SSH_PRIVATE_KEY`, `DEPLOY_HOST`, `DEPLOY_USER`
- [ ] Push `staging` → pipeline build OK → manual deploy → открыть тестовый URL
- [ ] Проверка входа, отпуска, админки
- [ ] Merge в `main` → deploy production
