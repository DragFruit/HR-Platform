#!/usr/bin/env bash
# Ежедневный бэкап стенда: tar.gz всего server/data (кроме backups/) + pg_dump -Fc, если в .env задан DATABASE_URL.
# Не ходит в HTTP: работает, даже если Nitro лежит.
#
#   bash run-data-backup.sh /var/www/vbi-hr            # бой
#   bash run-data-backup.sh /var/www/vbi-hr-staging    # стейдж
#
# Env (необязательные):
#   BACKUP_DIR       куда класть (по умолчанию <deploy>/server/data/backups/full)
#   BACKUP_KEEP      сколько последних копий хранить (14)
#   BACKUP_ENV_FILE  откуда читать DATABASE_URL (<deploy>/.env)
#   BACKUP_REMOTE    rsync-цель для копии вне сервера, напр. backup@host:/srv/vbi-hr/prod/ (пусто — пропуск)
#   BACKUP_SSH_KEY   ключ для BACKUP_REMOTE
set -euo pipefail

DEPLOY_PATH="${1:?Укажите путь стенда: /var/www/vbi-hr или /var/www/vbi-hr-staging}"
DEPLOY_PATH="${DEPLOY_PATH%/}"
DATA_DIR="${DEPLOY_PATH}/server/data"
BACKUP_DIR="${BACKUP_DIR:-${DATA_DIR}/backups/full}"
KEEP="${BACKUP_KEEP:-14}"
ENV_FILE="${BACKUP_ENV_FILE:-${DEPLOY_PATH}/.env}"
STAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"
NAME="$(basename "${DEPLOY_PATH}")"

if [[ ! -d "${DATA_DIR}" ]]; then
  echo "нет каталога данных: ${DATA_DIR}" >&2
  exit 1
fi

mkdir -p "${BACKUP_DIR}"
umask 027
created=()

# --- 1. JSON-данные ---
data_out="${BACKUP_DIR}/${NAME}-data-${STAMP}.tar.gz"
tmp="${BACKUP_DIR}/.data-${STAMP}.tmp"
trap 'rm -f "${tmp}" "${BACKUP_DIR}/.db-${STAMP}.tmp"' EXIT
tar -czf "${tmp}" -C "${DATA_DIR}" --exclude='./backups' --exclude='./.*.tmp' .
tar -tzf "${tmp}" >/dev/null # проверка, что архив читается
mv -f "${tmp}" "${data_out}"
created+=("${data_out}")
echo "ok data $(du -h "${data_out}" | cut -f1) ${data_out}"

# --- 2. PostgreSQL (только если стенд уже на базе) ---
DATABASE_URL_VALUE=""
if [[ -r "${ENV_FILE}" ]]; then
  DATABASE_URL_VALUE="$(grep -E '^[[:space:]]*DATABASE_URL=' "${ENV_FILE}" | tail -n1 | sed -E 's/^[[:space:]]*DATABASE_URL=//; s/^["'"'"']//; s/["'"'"']$//' || true)"
fi

if [[ -n "${DATABASE_URL_VALUE}" ]]; then
  if ! command -v pg_dump >/dev/null 2>&1; then
    echo "DATABASE_URL задан, но pg_dump не установлен" >&2
    exit 1
  fi
  # Разбираем URL в PG* переменные — пароль не попадает в аргументы процесса (ps).
  eval "$(python3 - "${DATABASE_URL_VALUE}" <<'PY'
import shlex, sys
from urllib.parse import urlparse, unquote
u = urlparse(sys.argv[1])
pairs = {
    "PGHOST": u.hostname or "127.0.0.1",
    "PGPORT": str(u.port or 5432),
    "PGUSER": unquote(u.username or ""),
    "PGPASSWORD": unquote(u.password or ""),
    "PGDATABASE": unquote(u.path.lstrip("/")),
}
for k, v in pairs.items():
    print(f"export {k}={shlex.quote(v)}")
PY
)"
  db_out="${BACKUP_DIR}/${NAME}-db-${PGDATABASE}-${STAMP}.dump"
  db_tmp="${BACKUP_DIR}/.db-${STAMP}.tmp"
  pg_dump -Fc --no-owner -f "${db_tmp}"
  mv -f "${db_tmp}" "${db_out}"
  created+=("${db_out}")
  echo "ok db $(du -h "${db_out}" | cut -f1) ${db_out}"
else
  echo "skip db (DATABASE_URL не задан в ${ENV_FILE})"
fi
trap - EXIT

# --- 3. Ротация: KEEP последних каждого вида ---
prune() {
  local pattern="$1" n=0
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    n=$((n + 1))
    if [[ "$n" -gt "$KEEP" ]]; then rm -f "$f"; fi
  done <<EOF2
$(ls -1t ${pattern} 2>/dev/null)
EOF2
}
prune "${BACKUP_DIR}/${NAME}-data-*.tar.gz"
prune "${BACKUP_DIR}/${NAME}-db-*.dump"

# --- 4. Копия вне сервера (опционально) ---
if [[ -n "${BACKUP_REMOTE:-}" ]]; then
  RSYNC_RSH="ssh -o BatchMode=yes"
  if [[ -n "${BACKUP_SSH_KEY:-}" ]]; then RSYNC_RSH="${RSYNC_RSH} -i ${BACKUP_SSH_KEY} -o IdentitiesOnly=yes"; fi
  RSYNC_RSH="${RSYNC_RSH}" rsync -a "${created[@]}" "${BACKUP_REMOTE}"
  echo "ok remote → ${BACKUP_REMOTE}"
else
  echo "skip remote (BACKUP_REMOTE не задан)"
fi

echo "keep ${KEEP} в ${BACKUP_DIR}"
