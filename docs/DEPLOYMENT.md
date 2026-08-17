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


### Два стенда на одном VPS

| Стенд | Ветка | Каталог | Порт | Домен (пример) |
|-------|-------|---------|------|----------------|
| Тест | `staging` | `/var/www/vbi-hr-staging` | 3301 | `hr-test.vbi.agency` |
| Бой | `main` | `/var/www/vbi-hr` | 3300 | `vibe.vbi.ru` |

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
