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

bash "${ROOT}/deploy/scripts/deploy-remote.sh" "${ENV}"
