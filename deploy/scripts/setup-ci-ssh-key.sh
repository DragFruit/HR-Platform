#!/bin/sh
# Подготовка ~/.ssh/id_rsa в GitLab CI из Variables.
# Варианты: SSH_PRIVATE_KEY (File или Variable) или SSH_PRIVATE_KEY_B64 (masked).
set -eu

mkdir -p ~/.ssh

if [ -n "${SSH_PRIVATE_KEY_B64:-}" ]; then
  printf '%s' "$SSH_PRIVATE_KEY_B64" | tr -d '\r\n ' | base64 -d > ~/.ssh/id_rsa
elif [ -n "${SSH_PRIVATE_KEY:-}" ] && [ -f "$SSH_PRIVATE_KEY" ]; then
  cp "$SSH_PRIVATE_KEY" ~/.ssh/id_rsa
elif [ -n "${SSH_PRIVATE_KEY:-}" ]; then
  printf '%s\n' "$SSH_PRIVATE_KEY" | tr -d '\r' > ~/.ssh/id_rsa
else
  echo "Ошибка: нет SSH_PRIVATE_KEY / SSH_PRIVATE_KEY_B64." >&2
  echo "  • Тип File + Protect → ветка staging должна быть в Protected branches." >&2
  echo "  • Или снимите Protect с переменной." >&2
  exit 1
fi

chmod 600 ~/.ssh/id_rsa

if ! ssh-keygen -y -f ~/.ssh/id_rsa >/dev/null 2>&1; then
  echo "Ошибка: SSH-ключ в CI не читается (битый File или Protected без protected branch)." >&2
  exit 1
fi

echo "✓ SSH-ключ для deploy подготовлен"
