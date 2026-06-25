#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
KEY="${HOME}/.ssh/vbi_hr_deploy"
GITLAB_URL="git@ilnizumak.beget.app:vbi/hrplatform.git"

if [[ ! -f "${KEY}" ]]; then
  echo "Нет ключа ${KEY}. Сначала: bash deploy/scripts/bootstrap-ssh.sh" >&2
  exit 1
fi

cd "${ROOT}"
git remote remove gitlab 2>/dev/null || true
git remote add gitlab "${GITLAB_URL}"

export GIT_SSH_COMMAND="ssh -i ${KEY} -o IdentitiesOnly=yes"

echo "→ проверка GitLab SSH"
ssh -i "${KEY}" -o IdentitiesOnly=yes -T git@ilnizumak.beget.app 2>&1 | head -3 || true

echo "→ push staging"
git push -u gitlab staging

echo "→ push main"
git push -u gitlab main

echo "✓ Код в GitLab. Дальше: deploy/SETUP-ILNIZUMAK.md шаги 4–6"
