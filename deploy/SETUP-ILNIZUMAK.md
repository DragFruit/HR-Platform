# Первый деплой: GitLab Beget + VPS 45.12.74.25

GitLab: [vbi/hrplatform](https://ilnizumak.beget.app/vbi/hrplatform)  
Сервер: `45.12.74.25`

## Шаг 0. SSH-ключ (уже на вашем Mac)

Скрипт создал пару ключей:

- приватный: `~/.ssh/vbi_hr_deploy` (никому не отправлять, кроме GitLab CI Variables)
- публичный: `~/.ssh/vbi_hr_deploy.pub`

Показать публичный ключ:

```bash
cat ~/.ssh/vbi_hr_deploy.pub
```

Один и тот же **публичный** ключ нужно добавить в **два места** (шаги 1 и 2).

---

## Шаг 1. GitLab — доступ к репозиторию

1. Откройте [GitLab](https://ilnizumak.beget.app/) → войдите.
2. Профиль (аватар) → **Preferences** → **SSH Keys** (или **Настройки → SSH-ключи**).
3. Вставьте содержимое `vbi_hr_deploy.pub` → **Add key**.

Проверка с Mac:

```bash
ssh -i ~/.ssh/vbi_hr_deploy -T git@ilnizumak.beget.app
# ожидается приветствие GitLab, не «Permission denied»
```

---

## Шаг 2. VPS — SSH на сервер

В панели **Beget → VPS** (сервер `45.12.74.25`):

- раздел SSH-ключи / доступ — добавьте тот же `vbi_hr_deploy.pub`;
- или при первом входе по паролю:

```bash
ssh root@45.12.74.25
mkdir -p ~/.ssh && chmod 700 ~/.ssh
nano ~/.ssh/authorized_keys   # вставить строку из vbi_hr_deploy.pub
chmod 600 ~/.ssh/authorized_keys
```

Проверка:

```bash
ssh -i ~/.ssh/vbi_hr_deploy root@45.12.74.25 "uname -a"
```

---

## Шаг 3. Push кода в GitLab

На Mac, из корня проекта:

```bash
bash deploy/scripts/push-gitlab.sh
```

Или вручную:

```bash
cd "/Users/stasamba/Desktop/VBI HR платформа"
git remote add gitlab git@ilnizumak.beget.app:vbi/hrplatform.git 2>/dev/null || true
GIT_SSH_COMMAND='ssh -i ~/.ssh/vbi_hr_deploy -o IdentitiesOnly=yes' git push -u gitlab staging
GIT_SSH_COMMAND='ssh -i ~/.ssh/vbi_hr_deploy -o IdentitiesOnly=yes' git push -u gitlab main
```

---

## Шаг 4. Настройка сервера (один раз)

```bash
ssh -i ~/.ssh/vbi_hr_deploy root@45.12.74.25
apt-get update && apt-get install -y git
git clone git@ilnizumak.beget.app:vbi/hrplatform.git /opt/vbi-hr-src
# если clone по ssh с сервера не работает — клонируйте HTTPS с deploy token
cd /opt/vbi-hr-src
bash deploy/scripts/install-server.sh
```

Nginx — пока по IP (потом замените на домен):

```bash
cp deploy/nginx/vbi-hr-staging.conf.example /etc/nginx/sites-available/vbi-hr-staging.conf
cp deploy/nginx/vbi-hr.conf.example /etc/nginx/sites-available/vbi-hr.conf
# в обоих файлах: server_name 45.12.74.25;
ln -sf /etc/nginx/sites-available/vbi-hr-staging.conf /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/vbi-hr.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

Sudoers для пользователя `deploy` (после install-server.sh):

```bash
echo 'deploy ALL=(ALL) NOPASSWD: /bin/systemctl restart vbi-hr, /bin/systemctl restart vbi-hr-staging, /bin/systemctl is-active vbi-hr, /bin/systemctl is-active vbi-hr-staging' > /etc/sudoers.d/vbi-hr-deploy
chmod 440 /etc/sudoers.d/vbi-hr-deploy
```

Добавьте `vbi_hr_deploy.pub` также пользователю `deploy`:

```bash
mkdir -p /home/deploy/.ssh
cat /root/.ssh/authorized_keys >> /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys
```

---

## Шаг 5. GitLab CI/CD Variables

Проект → **Settings → CI/CD → Variables**:

| Key | Value | Flags |
|-----|-------|-------|
| `SSH_PRIVATE_KEY` | содержимое `~/.ssh/vbi_hr_deploy` (весь файл) | Masked |
| `DEPLOY_HOST` | `45.12.74.25` | — |
| `DEPLOY_USER` | `deploy` | — |

Получить приватный ключ для копирования в Variable (только у себя на Mac):

```bash
cat ~/.ssh/vbi_hr_deploy
```

---

## Шаг 6. Первый деплой

1. Push в `staging` (шаг 3).
2. GitLab → **Build → Pipelines** → дождаться job **build:staging** (зелёный).
3. Нажать **Play** у **deploy:staging** (manual).
4. Открыть в браузере: `http://45.12.74.25` (тест на порту 3301 через nginx staging vhost).

Для боя: merge `staging` → `main` → pipeline → **deploy:production** → порт 3300.

---

## Быстрая выкладка без CI (с Mac)

После шагов 1–4:

```bash
export DEPLOY_HOST=45.12.74.25
export DEPLOY_USER=deploy
bash deploy/scripts/build-and-deploy.sh staging
```

---

## Проблемы

| Симптом | Решение |
|---------|---------|
| `Permission denied (publickey)` на GitLab | Шаг 1 |
| `Permission denied` на VPS | Шаг 2 |
| Pipeline build падает | Лог job; локально `cd frontend && npm ci && npm run build` |
| deploy падает на rsync | `DEPLOY_USER=deploy`, ключ у deploy, sudoers |
| 502 nginx | `systemctl status vbi-hr-staging`, есть ли `/var/www/vbi-hr-staging/.output/server/index.mjs` |
