#!/usr/bin/env zsh
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Это не git-репозиторий. Сначала: git init"
  exit 1
fi

CURRENT="$(git branch --show-current)"

if git show-ref --verify --quiet refs/heads/staging; then
  echo "Ветка staging уже есть."
else
  git branch staging
  echo "Создана ветка staging от $(git rev-parse --short HEAD)."
fi

echo ""
echo "Ветки:"
git branch -vv

echo ""
if git remote get-url origin >/dev/null 2>&1; then
  ORIGIN="$(git remote get-url origin)"
  echo "Remote origin: $ORIGIN"
  echo ""
  echo "Запушить ветки:"
  echo "  git push -u origin main"
  echo "  git push -u origin staging"
else
  echo "Remote origin не настроен. Пример:"
  echo "  git remote add origin git@github.com:ORG/vbi-hr.git"
  echo "  git push -u origin main"
  echo "  git push -u origin staging"
fi

echo ""
echo "Документация: docs/DEPLOYMENT.md"

if [ "$CURRENT" != "$(git branch --show-current)" ]; then
  git checkout "$CURRENT"
fi
