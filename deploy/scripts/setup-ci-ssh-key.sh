#!/bin/sh
# Подготовка SSH-ключа в GitLab CI.
# Приоритет: SSH_PRIVATE_KEY (File) → SSH_PRIVATE_KEY_B64 (Variable).
set -eu

mkdir -p ~/.ssh
KEY_FILE="${HOME}/.ssh/id_ci_deploy"

# ed25519: ~400–500 байт сырого ключа → base64 ~532–668 символов
B64_MIN=400
B64_MAX=900

decode_b64_key() {
  b64_raw="$1"
  b64="$(printf '%s' "$b64_raw" | tr -d ' \t\r\n')"
  b64_len="$(printf '%s' "$b64" | wc -c | tr -d ' ')"

  if [ "$b64_len" -lt "$B64_MIN" ] || [ "$b64_len" -gt "$B64_MAX" ]; then
    echo "Ошибка: SSH_PRIVATE_KEY_B64 — неверная длина ${b64_len} символов (ожидается ~${B64_MIN}–${B64_MAX} для ed25519)." >&2
    echo "  Перегенерируйте на Mac: bash deploy/scripts/print-ci-key-b64.sh" >&2
    echo "  Или используйте SSH_PRIVATE_KEY (Type: File) — рекомендуется." >&2
    return 1
  fi

  pad=$((b64_len % 4))
  if [ "$pad" -ne 0 ]; then
    missing=$((4 - pad))
    case "$missing" in
      1) b64="${b64}=" ;;
      2) b64="${b64}==" ;;
      3) b64="${b64}===" ;;
    esac
  fi

  if command -v openssl >/dev/null 2>&1; then
    if printf '%s' "$b64" | openssl base64 -d -A >"$KEY_FILE" 2>/dev/null; then
      return 0
    fi
  fi

  if printf '%s' "$b64" | base64 -d >"$KEY_FILE" 2>/dev/null; then
    return 0
  fi

  echo "Ошибка: не удалось декодировать SSH_PRIVATE_KEY_B64 (truncated input / битая строка)." >&2
  echo "  Длина после очистки пробелов: ${b64_len} символов." >&2
  echo "  Скопируйте одну строку целиком: bash deploy/scripts/print-ci-key-b64.sh" >&2
  echo "  Лучше: SSH_PRIVATE_KEY Type File — bash deploy/scripts/verify-ci-key-local.sh" >&2
  return 1
}

validate_key_file() {
  if [ ! -s "$KEY_FILE" ]; then
    echo "Ошибка: файл ключа пустой." >&2
    return 1
  fi

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
      echo "  В GitLab вставьте полный вывод: cat ~/.ssh/vbi_hr_deploy" >&2
      echo "  Не .pub! Строка должна начинаться с -----BEGIN OPENSSH PRIVATE KEY-----" >&2
      echo "  Проверка на Mac: bash deploy/scripts/verify-ci-key-local.sh" >&2
      return 1
      ;;
  esac

  if ! ssh-keygen -y -f "$KEY_FILE" >/dev/null 2>&1; then
    echo "Ошибка: ключ не читается OpenSSH (битая вставка или обрезан файл)." >&2
    return 1
  fi

  return 0
}

if [ -n "${SSH_PRIVATE_KEY:-}" ] && [ -f "$SSH_PRIVATE_KEY" ]; then
  cp "$SSH_PRIVATE_KEY" "$KEY_FILE"
  echo "Источник: SSH_PRIVATE_KEY (File)"
elif [ -n "${SSH_PRIVATE_KEY:-}" ]; then
  printf '%s\n' "$SSH_PRIVATE_KEY" | tr -d '\r' >"$KEY_FILE"
  echo "Источник: SSH_PRIVATE_KEY (Variable)"
elif [ -n "${SSH_PRIVATE_KEY_B64:-}" ]; then
  echo "Источник: SSH_PRIVATE_KEY_B64 (Variable)"
  decode_b64_key "$SSH_PRIVATE_KEY_B64"
else
  echo "Ошибка: нет SSH_PRIVATE_KEY (File) или SSH_PRIVATE_KEY_B64." >&2
  echo "  Настройка: bash deploy/scripts/verify-ci-key-local.sh" >&2
  exit 1
fi

chmod 600 "$KEY_FILE"
validate_key_file

export DEPLOY_SSH_KEY="$KEY_FILE"
echo "✓ SSH-ключ для deploy готов"
