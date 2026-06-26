#!/usr/bin/env bash
# Задача 1: с компьютера → GitLab (только push, без деплоя на сервер).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KEY="${HOME}/.ssh/vbi_hr_deploy"
GITLAB_REMOTE="gitlab"
GITLAB_URL="ssh://git@ilnizumak.beget.app:2222/vbi/hrplatform.git"
BRANCH="${1:-$(git -C "${ROOT}" branch --show-current)}"

if [[ ! -f "${KEY}" ]]; then
  echo "Нет SSH-ключа. Запустите: bash deploy/scripts/bootstrap-ssh.sh" >&2
  exit 1
fi

ssh-keyscan -p 2222 -H ilnizumak.beget.app >> "${HOME}/.ssh/known_hosts" 2>/dev/null || true

cd "${ROOT}"
if ! git remote get-url "${GITLAB_REMOTE}" &>/dev/null; then
  git remote add "${GITLAB_REMOTE}" "${GITLAB_URL}"
fi

export GIT_SSH_COMMAND="ssh -i ${KEY} -o IdentitiesOnly=yes -p 2222"

echo "→ GitLab: push ветки «${BRANCH}»"
git push -u "${GITLAB_REMOTE}" "${BRANCH}"

echo ""
echo "✓ Код в GitLab. Дальше сработает CI (сборка → деплой)."
echo "  Pipeline: https://ilnizumak.beget.app/vbi/hrplatform/-/pipelines"
