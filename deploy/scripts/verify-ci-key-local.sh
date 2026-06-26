#!/usr/bin/env bash
# Проверка deploy-ключа на Mac и инструкции для GitLab CI/CD Variables.
set -euo pipefail

KEY="${HOME}/.ssh/vbi_hr_deploy"
PUB="${KEY}.pub"
GITLAB_VARS_URL="https://ilnizumak.beget.app/vbi/hrplatform/-/settings/ci_cd"

echo "=== Проверка deploy-ключа ==="
echo ""

if [[ ! -f "$KEY" ]]; then
  echo "✗ Нет $KEY" >&2
  echo "  Создайте: bash deploy/scripts/bootstrap-ssh.sh" >&2
  exit 1
fi

BYTES="$(wc -c < "$KEY" | tr -d ' ')"
FIRST_LINE="$(head -1 "$KEY")"
B64_LEN="$(base64 < "$KEY" | tr -d '\n' | wc -c | tr -d ' ')"

echo "Файл:     $KEY"
echo "Размер:   ${BYTES} байт"
echo "Заголовок: $FIRST_LINE"
echo "Base64:   ${B64_LEN} символов (одна строка для B64-переменной)"
echo ""

case "$FIRST_LINE" in
  *"BEGIN OPENSSH PRIVATE KEY"*) ;;
  *"BEGIN RSA PRIVATE KEY"*) ;;
  *"BEGIN EC PRIVATE KEY"*) ;;
  *"BEGIN PRIVATE KEY"*) ;;
  *)
    echo "✗ Это не приватный ключ OpenSSH/PEM." >&2
    exit 1
    ;;
esac

if ! ssh-keygen -y -f "$KEY" >/dev/null 2>&1; then
  echo "✗ ssh-keygen не может прочитать ключ." >&2
  exit 1
fi

echo "✓ Ключ валиден (ssh-keygen -y OK)"
echo ""

if [[ -f "$PUB" ]]; then
  echo "Публичный ключ (должен быть в authorized_keys на сервере):"
  cat "$PUB"
  echo ""
fi

echo "=== GitLab CI/CD Variables ==="
echo "Откройте: $GITLAB_VARS_URL"
echo ""
echo "Удалите старые переменные SSH_PRIVATE_KEY_B64 и SSH_PRIVATE_KEY, если они битые."
echo ""
echo "─── СПОСОБ 1 (РЕКОМЕНДУЕТСЯ): SSH_PRIVATE_KEY Type File ───"
echo ""
echo "1. Add variable"
echo "2. Key:           SSH_PRIVATE_KEY"
echo "3. Type:          File  (не Variable!)"
echo "4. Value:         вставьте ВЕСЬ вывод команды ниже (с BEGIN/END, все строки):"
echo ""
echo "   cat ~/.ssh/vbi_hr_deploy"
echo ""
echo "   Скопируйте так:"
printf '   '; sed -n '1p' "$KEY"
echo "   ... (все строки до END) ..."
printf '   '; tail -1 "$KEY"
echo ""
echo "5. ✓ Protect variable"
echo "6. Visibility:    Visible  (Masked недоступен для многострочных ключей — это нормально)"
echo "7. ✗ Expand variable reference — СНИМИТЕ галочку, если есть"
echo "8. НЕ вставляйте .pub — только приватный ключ!"
echo ""
echo "─── СПОСОБ 2 (запасной): SSH_PRIVATE_KEY_B64 ───"
echo ""
echo "1. На Mac: bash deploy/scripts/print-ci-key-b64.sh"
echo "2. Скопируйте ОДНУ строку целиком (${B64_LEN} символов, без переносов внутри)"
echo "3. Key: SSH_PRIVATE_KEY_B64, Type: Variable"
echo "4. ✓ Protect variable, Visibility: Visible (не Masked)"
echo ""
echo "Ожидаемая длина B64 для ed25519: ~532–668 символов. Сейчас: ${B64_LEN}."
echo ""
echo "Также нужны (если ещё нет):"
echo "  DEPLOY_HOST = 45.12.74.25  (Protected)"
echo "  DEPLOY_USER = deploy       (Protected)"
echo ""
echo "После сохранения — перезапустите упавший pipeline (Retry)."
