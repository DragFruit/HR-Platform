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

### 1. Репозиторий

```bash
cd "/Users/stasamba/Desktop/VBI HR платформа"
git remote add gitlab git@gitlab.com:ВАШ_ГРУППА/vbi-hr.git   # если ещё нет
git push -u gitlab staging
git push -u gitlab main
```

Можно оставить GitHub как зеркало; CI для выкладки — **`.gitlab-ci.yml`**.

### 2. Сервер (один раз)

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

**Settings → CI/CD → Variables** (masked / protected по необходимости):

| Переменная | Пример | Назначение |
|------------|--------|------------|
| `SSH_PRIVATE_KEY` | `-----BEGIN OPENSSH...` | Ключ для `deploy@сервер` |
| `DEPLOY_HOST` | `hr.vbi.agency` или IP | Хост VPS |
| `DEPLOY_USER` | `deploy` | SSH-пользователь |
| `DEPLOY_PATH_STAGING` | `/var/www/vbi-hr-staging` | Каталог теста (опционально) |
| `DEPLOY_PATH_PRODUCTION` | `/var/www/vbi-hr` | Каталог боя (опционально) |

### 4. Пайплайн

При push в `staging` или `main`:
1. **build** — `npm ci` + `nuxt build`, артефакт `frontend/.output/` (14 дней).
2. **deploy** — **вручную** (кнопка Play в GitLab): rsync на сервер + `systemctl restart`.

Так можно сначала проверить сборку, потом выкладывать.

### 5. Ручная выкладка с машины

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
| `NUXT_PUBLIC_LAUNCH_SCOPE` | `full` | `full` | `full` |

`NUXT_PUBLIC_*` задаются **при сборке** (`npm run build`), не в runtime на сервере.

---

## Запуск на сервере

```bash
# после выкладки .output
NITRO_HOST=127.0.0.1 NITRO_PORT=3300 node /var/www/vbi-hr/.output/server/index.mjs
```

Управляется через **systemd**: `vbi-hr` (бой), `vbi-hr-staging` (тест). Nginx проксирует 80/443 → 3300/3301.

### Два стенда на одном VPS

| Стенд | Ветка | Каталог | Порт | Домен (пример) |
|-------|-------|---------|------|----------------|
| Тест | `staging` | `/var/www/vbi-hr-staging` | 3301 | `hr-test.vbi.agency` |
| Бой | `main` | `/var/www/vbi-hr` | 3300 | `hr.vbi.agency` |

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
