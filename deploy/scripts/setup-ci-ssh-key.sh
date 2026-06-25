#!/bin/sh
# Подготовка SSH-ключа в GitLab CI.
# SSH_PRIVATE_KEY (File) или SSH_PRIVATE_KEY_B64 (Variable, masked).
set -eu

mkdir -p ~/.ssh
KEY_FILE="${HOME}/.ssh/id_ci_deploy"

if [ -n "${SSH_PRIVATE_KEY_B64:-}" ]; then
  printf '%s' "$SSH_PRIVATE_KEY_B64" | tr -d '\r\n ' | base64 -d > "$KEY_FILE"
elif [ -n "${SSH_PRIVATE_KEY:-}" ] && [ -f "$SSH_PRIVATE_KEY" ]; then
  cp "$SSH_PRIVATE_KEY" "$KEY_FILE"
elif [ -n "${SSH_PRIVATE_KEY:-}" ]; then
  printf '%s\n' "$SSH_PRIVATE_KEY" | tr -d '\r' > "$KEY_FILE"
else
  echo "Ошибка: нет SSH_PRIVATE_KEY (File) или SSH_PRIVATE_KEY_B64." >&2
  exit 1
fi

chmod 600 "$KEY_FILE"

FIRST_LINE="$(head -1 "$KEY_FILE" || true)"
BYTES="$(wc -c < "$KEY_FILE" | tr -d ' ')"

echo "SSH key file: ${BYTES} bytes, header: ${FIRST_LINE}"

case "$FIRST_LINE" in
  *"BEGIN OPENSSH PRIVATE KEY"*) ;;
  *"BEGIN RSA PRIVATE KEY"*) ;;
  *"BEGIN EC PRIVATE KEY"*) ;;
  *"BEGIN PRIVATE KEY"*) ;;
  *)
    echo "Ошибка: это не приватный ключ." >&2
    echo "  В GitLab Variable вставьте вывод: cat ~/.ssh/vbi_hr_deploy" >&2
    echo "  Не .pub! Строка должна начинаться с -----BEGIN OPENSSH PRIVATE KEY-----" >&2
    echo "  Или используйте SSH_PRIVATE_KEY_B64: bash deploy/scripts/print-ci-key-b64.sh" >&2
    exit 1
    ;;
esac

if ! ssh-keygen -y -f "$KEY_FILE" >/dev/null 2>&1; then
  echo "Ошибка: ключ не читается OpenSSH (битая вставка или обрезан файл)." >&2
  exit 1
fi

export DEPLOY_SSH_KEY="$KEY_FILE"
echo "✓ SSH-ключ для deploy готов"
