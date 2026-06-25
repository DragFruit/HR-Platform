#!/usr/bin/env bash
# Одна строка base64 для GitLab Variable SSH_PRIVATE_KEY_B64 (Masked).
set -euo pipefail

KEY="${HOME}/.ssh/vbi_hr_deploy"

if [[ ! -f "$KEY" ]]; then
  echo "Нет $KEY — сначала: bash deploy/scripts/bootstrap-ssh.sh" >&2
  exit 1
fi

echo "Скопируйте ОДНУ строку ниже (без переносов внутри) в GitLab → CI/CD Variables:"
echo "  Key: SSH_PRIVATE_KEY_B64"
echo "  Type: Variable"
echo "  Protect variable: ✓"
echo "  Visibility: Visible  (НЕ Masked — GitLab не маскирует base64)"
echo ""
printf '%s' "$(base64 < "$KEY" | tr -d '\n')"
echo ""
echo ""
echo "Старую SSH_PRIVATE_KEY (File) можно удалить."
