#!/usr/bin/env bash
# Задача 2 (из GitLab CI): выкладка артефакта build на VPS.
set -euo pipefail

export DEPLOY_SSH_KEY="${DEPLOY_SSH_KEY:-${HOME}/.ssh/id_rsa}"

if [[ ! -f "${DEPLOY_SSH_KEY}" ]]; then
  echo "CI: не найден SSH-ключ ${DEPLOY_SSH_KEY}. Задайте переменную SSH_PRIVATE_KEY в GitLab." >&2
  exit 1
fi

: "${DEPLOY_HOST:?Задайте DEPLOY_HOST в CI/CD Variables}"
: "${DEPLOY_USER:?Задайте DEPLOY_USER в CI/CD Variables}"

ENV="${1:?staging или production}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUTPUT_PUBLIC="${ROOT}/frontend/.output/public"
REPO_KNOWLEDGE="${ROOT}/frontend/public/knowledge"

# Артефакт CI без public/knowledge (лимит GitLab → 413). Вернём из checkout перед rsync,
# иначе --delete на сервере снесёт картинки статей.
if [[ -d "${REPO_KNOWLEDGE}" ]]; then
  echo "→ CI: подмешиваем frontend/public/knowledge → .output/public/knowledge"
  mkdir -p "${OUTPUT_PUBLIC}"
  rm -rf "${OUTPUT_PUBLIC}/knowledge"
  cp -a "${REPO_KNOWLEDGE}" "${OUTPUT_PUBLIC}/knowledge"
else
  echo "⚠ CI: нет ${REPO_KNOWLEDGE} — картинки БЗ на сервере могут устареть/пропасть при rsync --delete" >&2
fi

bash "${ROOT}/deploy/scripts/deploy-remote.sh" "${ENV}"
