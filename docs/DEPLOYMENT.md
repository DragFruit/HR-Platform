# Деплой: тест и бой

## Ветки Git

| Ветка | Назначение | `NUXT_PUBLIC_APP_ENV` |
|-------|------------|------------------------|
| `staging` | Тестовый стенд | `staging` |
| `main` | Бой (production) | `production` |

**Поток работы:** фича → PR в `staging` → проверка на тесте → PR `staging` → `main`.

Локальная разработка — ветка от `staging`, без обязательного env (по умолчанию `development`).

## Первое подключение GitHub

1. Создайте пустой репозиторий на GitHub (без README, если проект уже есть локально).

2. Закоммитьте текущие изменения и запушьте:

```bash
cd "/Users/stasamba/Desktop/VBI HR платформа"
git add -A
git commit -m "Подготовка платформы: UI, модули, CI и окружения."
git branch -M main
git remote add origin git@github.com:ВАШ_ОРГ/vbi-hr.git
git push -u origin main
```

3. Создайте ветку теста и запушьте:

```bash
git checkout -b staging
git push -u origin staging
```

Или одной командой: `./scripts/setup-git-branches.sh`

4. В GitHub → **Settings → Branches**:
   - защитите `main`: требовать PR, без прямого push (по желанию);
   - default branch для разработки можно оставить `main` или переключить на `staging`.

5. В GitHub → **Settings → Environments** создайте:
   - `staging` — тестовый стенд;
   - `production` — бой (можно включить required reviewers).

Workflow `release-artifact.yml` привязывает сборку к этим environment при push в соответствующую ветку.

## Переменные окружения

Скопируйте `frontend/.env.example` → `frontend/.env` локально.

| Переменная | Тест (`staging`) | Бой (`main`) | Локально |
|------------|------------------|--------------|----------|
| `NUXT_PUBLIC_APP_ENV` | `staging` | `production` | `development` |
| `NUXT_PUBLIC_LAUNCH_SCOPE` | `full` или `vacations` | `full` | `full` |

На тесте в шапке появляется оранжевая плашка **«Тестовый стенд»**.

## CI

- **CI** (`.github/workflows/ci.yml`) — `npm ci` + `npm run build` на PR и push в `main` / `staging`.
- **Build artifact** (`.github/workflows/release-artifact.yml`) — артефакт `frontend/.output/` для выкладки на сервер (14 дней хранения).

## Запуск собранного приложения (VPS / свой сервер)

```bash
cd frontend
npm ci
npm run build
# env задаётся при сборке (NUXT_PUBLIC_*) или в systemd Environment=
NITRO_PORT=3300 NITRO_HOST=0.0.0.0 node .output/server/index.mjs
```

Скачать артефакт из Actions → распаковать `.output` в `frontend/.output` на сервере → запустить `node .output/server/index.mjs`.

### Пример: два инстанса на одном сервере

| Стенд | Ветка | Порт | Домен (пример) |
|-------|-------|------|----------------|
| Тест | `staging` | 3301 | `hr-test.vbi.local` |
| Бой | `main` | 3300 | `hr.vbi.local` |

Сборка с нужным env:

```bash
NUXT_PUBLIC_APP_ENV=staging npm run build   # тест
NUXT_PUBLIC_APP_ENV=production npm run build # бой
```

## Что не коммитить

- `frontend/.env` — только `.env.example` в репозитории.
- `node_modules/`, `.output/`, `.nuxt/` — в `.gitignore`.
