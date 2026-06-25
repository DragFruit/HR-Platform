#!/bin/sh
# Подготовка ~/.ssh/id_rsa в GitLab CI из Variables.
# Варианты: SSH_PRIVATE_KEY (File или Variable) или SSH_PRIVATE_KEY_B64 (masked).
set -eu

mkdir -p ~/.ssh

if [ -n "${SSH_PRIVATE_KEY_B64:-}" ]; then
  printf '%s' "$SSH_PRIVATE_KEY_B64" | tr -d '\r\n ' | base64 -d > ~/.ssh/id_rsa
elif [ -f "${SSH_PRIVATE_KEY:-}" ]; then
  cp "$SSH_PRIVATE_KEY" ~/.ssh/id_rsa
elif [ -n "${SSH_PRIVATE_KEY:-}" ]; then
  printf '%s\n' "$SSH_PRIVATE_KEY" | tr -d '\r' > ~/.ssh/id_rsa
else
  echo "Ошибка: задайте SSH_PRIVATE_KEY (тип File) или SSH_PRIVATE_KEY_B64 в CI/CD Variables" >&2
  exit 1
fi

chmod 600 ~/.ssh/id_rsa
