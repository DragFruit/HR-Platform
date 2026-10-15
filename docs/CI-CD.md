# CI/CD: две задачи

Два независимых контура. **С компьютера на сервер напрямую не деплоим** — только через GitLab.

```
[Mac] ──push──► [GitLab] ──CI/CD──► [VPS 45.12.74.25]
         задача 1          задача 2
```

Подробности сервера: [DEPLOYMENT.md](DEPLOYMENT.md), Beget: [../deploy/SETUP-ILNIZUMAK.md](../deploy/SETUP-ILNIZUMAK.md).

---

## Задача 1. С компьютера → Git

**Кто:** разработчик на Mac.  
**Что:** коммит + push в GitLab.  
**Чего нет:** сборки на сервере, rsync, перезапуска nginx.

### Один раз

```bash
bash deploy/scripts/bootstrap-ssh.sh   # ключ ~/.ssh/vbi_hr_deploy
```

Публичный ключ добавить в GitLab → **Preferences → SSH Keys**  
([ilnizumak.beget.app](https://ilnizumak.beget.app), SSH **порт 2222**).

### Каждый раз после изменений

```bash
cd "/Users/stasamba/Desktop/VBI HR платформа"
git add …
git commit -m "…"
bash scripts/push-to-gitlab.sh          # текущая ветка
# или явно:
bash scripts/push-to-gitlab.sh staging
bash scripts/push-to-gitlab.sh main
```

| Ветка | Куда попадает код | Что запустит CI |
|-------|-------------------|-----------------|
| `staging` | тестовый контур | build → deploy на :8080 |
| `main` | бой | build → deploy (ручная кнопка) |

Проверка push:

```bash
ssh -i ~/.ssh/vbi_hr_deploy -p 2222 -T git@ilnizumak.beget.app
```

---

## Задача 2. Из Git → сервер

**Кто:** GitLab CI (`.gitlab-ci.yml`).  
**Что:** `npm ci` → `nuxt build` → rsync `.output` → `systemctl restart`.  
**Когда:** после push в задаче 1.

### Один раз: переменные CI/CD

Проект → [Settings → CI/CD → Variables](https://ilnizumak.beget.app/vbi/hrplatform/-/settings/ci_cd):

| Variable | Value | Protected | Masked |
|----------|-------|-----------|--------|
| `SSH_PRIVATE_KEY` | файл ключа (см. ниже) | ✓ | **не Masked** — только File или Protected |
| `DEPLOY_HOST` | `45.12.74.25` | ✓ | — |
| `DEPLOY_USER` | `deploy` | ✓ | — |

**Проверка ключа на Mac перед настройкой GitLab:**

```bash
bash deploy/scripts/verify-ci-key-local.sh
```

Скрипт проверит `~/.ssh/vbi_hr_deploy` и выведет точные шаги для GitLab.

**SSH-ключ в GitLab нельзя Masked** — в ключе есть переносы строк. Два рабочих варианта (CI предпочитает File):

#### Вариант A (рекомендуется): `SSH_PRIVATE_KEY` Type **File**

1. Удалите старые `SSH_PRIVATE_KEY` и `SSH_PRIVATE_KEY_B64`, если они были вставлены с ошибкой.
2. На Mac выведите **полный** приватный ключ (не `.pub`):

   ```bash
   cat ~/.ssh/vbi_hr_deploy
   ```

   Первая строка: `-----BEGIN OPENSSH PRIVATE KEY-----`  
   Последняя: `-----END OPENSSH PRIVATE KEY-----`

3. GitLab → **Add variable**:
   - **Key:** `SSH_PRIVATE_KEY`
   - **Type:** **File** (не Variable!)
   - **Value:** вставить весь вывод `cat` — все строки с BEGIN/END, с переносами
   - ✓ **Protect variable**
   - **Visibility:** Visible (Masked для многострочного ключа недоступен — это нормально)
   - ✗ **Expand variable reference** — снять галочку, если отображается
4. **Не** вставляйте `vbi_hr_deploy.pub` — только приватный файл.

#### Вариант B (запасной): `SSH_PRIVATE_KEY_B64` Type Variable

Если File не подходит:

1. На Mac: `bash deploy/scripts/print-ci-key-b64.sh`
2. Скопировать **одну** строку целиком (~532–668 символов для ed25519; без переносов внутри, без лишнего Enter в конце)
3. Key: `SSH_PRIVATE_KEY_B64`, Type: **Variable**
4. ✓ **Protect variable**, Visibility: **Visible** — **не Masked**

Ошибка `base64: truncated input` в CI обычно значит обрезанную B64-строку — пересоздайте переменную или перейдите на File (вариант A).

### Каждый push

1. Откройте [Pipelines](https://ilnizumak.beget.app/vbi/hrplatform/-/pipelines).
2. **build** — автоматически (зелёный).
3. **deploy**:
   - `staging` — **автоматически** после успешной сборки;
   - `main` — **вручную** (кнопка ▶ у job `deploy:production`).

### Результат на сервере

| Стенд | URL | systemd |
|-------|-----|---------|
| Тест | http://45.12.74.25:8080 | `vbi-hr-staging` |
| Бой | http://45.12.74.25 | `vbi-hr` |

### Стадии pipeline

```yaml
stages:
  - build    # npm ci + nuxt build → артефакт frontend/.output/
  - deploy   # rsync + systemctl restart (только из CI, не с Mac)
```

Файлы: `.gitlab-ci.yml`, `deploy/scripts/setup-ci-ssh-key.sh`, `deploy/scripts/deploy-from-ci.sh`, `deploy/scripts/deploy-remote.sh`.

---

## Схема по веткам

```mermaid
flowchart LR
  subgraph task1 [Задача 1 — Mac]
    Dev[Разработчик]
    GitLab[(GitLab)]
    Dev -->|push-to-gitlab.sh| GitLab
  end

  subgraph task2 [Задача 2 — CI]
    Build[build job]
    Deploy[deploy job]
    VPS[VPS]
    GitLab --> Build --> Deploy --> VPS
  end
```

---

## Запуск deploy:production через API

Job `deploy:production` на ветке `main` **manual** — его можно нажать в UI или запустить скриптом (агент/разработчик), если есть Personal Access Token с scope **api**.

### Токен

1. GitLab → [Personal access tokens](https://ilnizumak.beget.app/-/user_settings/personal_access_tokens): scope **api**, срок по политике команды.
2. Локально (не коммитить): `frontend/.env` → `GITLAB_TOKEN=glpat-…`  
   или разово: `export GITLAB_TOKEN=glpat-…`

Пример в репозитории: `frontend/.env.example` (закомментировано).

### Скрипт

```bash
cd "/Users/stasamba/Desktop/VBI HR платформа"
bash scripts/gitlab-play-deploy-production.sh
```

Скрипт:

- берёт `GITLAB_TOKEN` из окружения или `frontend/.env` (значение в stdout не выводит);
- находит **последний** pipeline ref `main` и job `deploy:production` в статусе `manual` / `created`;
- вызывает `POST /projects/vbi%2Fhrplatform/jobs/:id/play`;
- опрашивает job до `success` / `failed` и печатает URL job.

Переменные (опционально): `GITLAB_DEPLOY_REF` (по умолчанию `main`), `GITLAB_DEPLOY_POLL_SEC`, `GITLAB_DEPLOY_POLL_MAX`.

Без токена — exit `1` и подсказка, куда добавить `GITLAB_TOKEN`.

**Важно:** это запуск **деплоя на бой** (`45.12.74.25`, порт 80). Перед play убедитесь, что в pipeline успешен `build:production` и изменения действительно должны идти на production (см. правила deploy-production в репозитории).

---

## Если CI упал

| Job | Частая причина |
|-----|----------------|
| build | ошибка в коде / `npm ci` — смотреть лог job |
| build | `413 Request Entity Too Large` / `FATAL: too large` при Uploading artifacts — архив `.output` больше лимита GitLab. В CI `public/knowledge` **исключён** из artifacts и подмешивается в `deploy-from-ci.sh` из checkout; не убирать этот exclude без поднятия `max_artifacts_size` на GitLab |
| build | `Killed` (без текста ошибки, exit code 1) на шаге «Building Nitro...» **после** уже успешных `Client built`/`Server built` — OOM-kill раннера (SIGKILL) на финальной бандлинг/минификации сервера. Чем больше кода (новые страницы/API), тем ближе к потолку памяти shared-раннера. Фикс (13.10.2026): в `.gitlab-ci.yml` у job `.build` задан `NODE_OPTIONS: "--max-old-space-size=2048"` — V8 чаще собирает мусор вместо попытки выделить больше, чем есть у раннера. **Рецидив (15.10.2026):** после крупной фичи «Опросы» и ряда других коммитов упало снова с тем же симптомом на том же шаге — кодовая база выросла, 2048 МБ стало мало. Поднято до `--max-old-space-size=3072` (умеренный шаг, не с запасом «на все случаи»). Проверено: `nitro.minify: false` в `frontend/nuxt.config.ts` уже стоит (ничего резать на сервер-бандле дальше не нужно); `frontend/package.json` не менялся между фиксами — новых тяжёлых зависимостей нет, рост исключительно в коде приложения. Sourcemaps (ещё одна типичная причина OOM на Nitro) отключены (`sourcemap: false` → `{server:false, client:false}`, плюс `vite.build.sourcemap: false`) — `find .output -name '*.map' -delete` в скрипте — просто страховка, а не признак того, что карты генерируются. Если упадёт снова — поднимать число далее (напр. 3584/4096) или выяснять реальный лимит памяти раннера |
| deploy | rsync `Permission denied` на `.output` | файлы от root после ручного деплоя — `chown` в `deploy-remote.sh`; sudoers: `deploy/sudoers/vbi-hr-deploy` |
| deploy | пустые `DEPLOY_HOST` / `DEPLOY_USER` | переменные Protected, а ветка не protected — значения заданы в `.gitlab-ci.yml` |
| deploy | нет/битый `SSH_PRIVATE_KEY` или `SSH_PRIVATE_KEY_B64` (`truncated input`), нет ключа у `deploy@сервер` |

Для deploy: `bash deploy/scripts/verify-ci-key-local.sh` → исправить Variables → Retry pipeline.

Ручная проверка деплоя (экстренно, не основной поток):

```bash
export DEPLOY_HOST=45.12.74.25 DEPLOY_USER=deploy
bash deploy/scripts/build-and-deploy.sh staging
```

Это обход CI — для отладки, не для ежедневной работы.
