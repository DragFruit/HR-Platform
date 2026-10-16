#!/usr/bin/env bash
# Фаза 1 миграции JSON → PostgreSQL: установка Postgres на VPS и базы для стендов.
# Запускает ВЛАДЕЛЕЦ ПРОДУКТА по SSH под sudo-пользователем (CI и агенты это не запускают):
#
#   sudo bash deploy/scripts/install-postgres.sh
#
# Идемпотентно: повторный запуск ничего не ломает и пароли не меняет.
# Что делает:
#   1. apt: postgresql (+ клиент pg_dump для бэкапов);
#   2. слушать только localhost;
#   3. роли vbi_prod / vbi_staging со случайными паролями, базы vbi_prod / vbi_staging (владельцы — эти роли),
#      CONNECT к чужой базе закрыт;
#   4. дописывает DATABASE_URL в /etc/vbi-hr/bitrix-production.env и /etc/vbi-hr/bitrix.env, ТОЛЬКО если строки ещё нет.
# Пароли на экран не выводятся — они только в env-файлах (chmod сохраняется).
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Запустите с sudo: sudo bash deploy/scripts/install-postgres.sh" >&2
  exit 1
fi

PROD_ENV_FILE="${PROD_ENV_FILE:-/etc/vbi-hr/bitrix-production.env}"
STAGING_ENV_FILE="${STAGING_ENV_FILE:-/etc/vbi-hr/bitrix.env}"
PG_PORT="${PG_PORT:-5432}"

echo "→ PostgreSQL (пакеты Ubuntu)"
if ! command -v psql >/dev/null 2>&1 || ! ls /etc/postgresql/*/main/postgresql.conf >/dev/null 2>&1; then
  apt-get update
  apt-get install -y postgresql postgresql-contrib
else
  echo "  уже установлен: $(psql --version)"
fi

PG_CONF="$(ls -1d /etc/postgresql/*/main | sort -V | tail -n1)"
PG_VER="$(basename "$(dirname "${PG_CONF}")")"
echo "  кластер ${PG_VER}/main (${PG_CONF})"

echo "→ listen_addresses = localhost"
mkdir -p "${PG_CONF}/conf.d"
CONF_SNIPPET="${PG_CONF}/conf.d/vbi-hr.conf"
DESIRED_CONF="$(printf "# VBI HR: только локальные подключения (install-postgres.sh)\nlisten_addresses = 'localhost'\nport = %s\n" "${PG_PORT}")"
NEED_RESTART=0
if [[ ! -f "${CONF_SNIPPET}" ]] || [[ "$(cat "${CONF_SNIPPET}")" != "${DESIRED_CONF}" ]]; then
  printf '%s\n' "${DESIRED_CONF}" > "${CONF_SNIPPET}"
  chmod 644 "${CONF_SNIPPET}"
  NEED_RESTART=1
fi
if ! grep -Eq "^[[:space:]]*include_dir[[:space:]]*=[[:space:]]*'conf\.d'" "${PG_CONF}/postgresql.conf"; then
  echo "include_dir = 'conf.d'" >> "${PG_CONF}/postgresql.conf"
  NEED_RESTART=1
fi

systemctl enable postgresql >/dev/null
if [[ "${NEED_RESTART}" == "1" ]]; then
  systemctl restart postgresql
else
  systemctl start postgresql
fi

for i in $(seq 1 20); do
  if sudo -u postgres psql -qAtc 'select 1' >/dev/null 2>&1; then break; fi
  sleep 1
done

psql_admin() { sudo -u postgres psql -v ON_ERROR_STOP=1 -qAt "$@"; }

has_database_url() {
  local file="$1"
  [[ -f "${file}" ]] && grep -Eq '^[[:space:]]*DATABASE_URL=' "${file}"
}

# $1 = роль/база, $2 = env-файл стенда
provision() {
  local name="$1" env_file="$2" role_exists db_exists password=""

  echo "→ ${name}"
  role_exists="$(psql_admin -c "select 1 from pg_roles where rolname = '${name}'")"

  if has_database_url "${env_file}"; then
    echo "  DATABASE_URL уже есть в ${env_file} — пароль не трогаю"
    if [[ "${role_exists}" != "1" ]]; then
      echo "  ⚠ роли ${name} нет, а DATABASE_URL в ${env_file} есть — проверьте вручную (скрипт ничего не менял)" >&2
      return 0
    fi
  else
    password="$(openssl rand -hex 24)"
    if [[ "${role_exists}" == "1" ]]; then
      # Роль есть, а URL в env потерян — выдаём новый пароль и записываем его.
      psql_admin -c "alter role ${name} with login password '${password}'"
      echo "  роль ${name} уже была — задан новый пароль (URL в env отсутствовал)"
    else
      psql_admin -c "create role ${name} with login password '${password}'"
      echo "  создана роль ${name}"
    fi
  fi

  db_exists="$(psql_admin -c "select 1 from pg_database where datname = '${name}'")"
  if [[ "${db_exists}" != "1" ]]; then
    sudo -u postgres createdb -O "${name}" -E UTF8 -T template0 "${name}"
    echo "  создана база ${name} (owner ${name})"
  else
    echo "  база ${name} уже есть"
  fi
  psql_admin -c "revoke connect on database ${name} from public"
  psql_admin -c "grant connect on database ${name} to ${name}"

  if [[ -n "${password}" ]]; then
    mkdir -p "$(dirname "${env_file}")"
    touch "${env_file}"
    # Перевод строки, если файл не заканчивается на \n
    if [[ -s "${env_file}" && "$(tail -c1 "${env_file}")" != "" ]]; then echo >> "${env_file}"; fi
    {
      echo "# PostgreSQL (install-postgres.sh, $(date -u +%Y-%m-%d))"
      echo "DATABASE_URL=postgres://${name}:${password}@127.0.0.1:${PG_PORT}/${name}"
    } >> "${env_file}"
    echo "  DATABASE_URL дописан в ${env_file} (пароль только там)"
  fi
}

provision vbi_prod "${PROD_ENV_FILE}"
provision vbi_staging "${STAGING_ENV_FILE}"

echo "→ проверка подключения под ролями стендов"
for pair in "vbi_prod:${PROD_ENV_FILE}" "vbi_staging:${STAGING_ENV_FILE}"; do
  name="${pair%%:*}"
  file="${pair#*:}"
  url="$(grep -E '^[[:space:]]*DATABASE_URL=' "${file}" | tail -n1 | sed -E 's/^[[:space:]]*DATABASE_URL=//; s/^["'"'"']//; s/["'"'"']$//')"
  if PGCONNECT_TIMEOUT=5 psql "${url}" -qAtc 'select current_user, current_database()' >/dev/null 2>&1; then
    echo "  ok ${name}"
  else
    echo "  ⚠ ${name}: не удалось подключиться по DATABASE_URL из ${file}" >&2
  fi
done

cat <<EOF

Готово. PostgreSQL ${PG_VER}, только localhost:${PG_PORT}. Базы: vbi_prod, vbi_staging.
DATABASE_URL — в ${PROD_ENV_FILE} и ${STAGING_ENV_FILE} (на экран не выводится).

Дальше:
  1. Стейдж:  sudo systemctl restart vbi-hr-staging
     Проверка: в журнале «[db] migrations ok» —  sudo journalctl -u vbi-hr-staging -n 50 | grep '\[db\]'
     и под админом: http://45.12.74.25:8080/api/admin/db-health → {"enabled":true,"ok":true,...}
  2. Бой — только когда решите: sudo systemctl restart vbi-hr
     (создаст пустые служебные таблицы в vbi_prod; поведение платформы не меняется)
  3. Бэкапы — см. docs/DEPLOYMENT.md «Ежедневный бэкап данных и базы».
EOF
