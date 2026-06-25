#!/usr/bin/env bash
# Первичная настройка VPS (Ubuntu/Debian). Запуск на сервере под root или с sudo.
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Запустите с sudo: sudo bash deploy/scripts/install-server.sh" >&2
  exit 1
fi

NODE_MAJOR="${NODE_MAJOR:-22}"
DEPLOY_USER="${DEPLOY_USER:-deploy}"

echo "→ Node.js ${NODE_MAJOR}.x"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi

echo "→ nginx"
apt-get update
apt-get install -y nginx rsync

echo "→ пользователь ${DEPLOY_USER}"
if ! id "${DEPLOY_USER}" &>/dev/null; then
  useradd -m -s /bin/bash "${DEPLOY_USER}"
fi

for dir in /var/www/vbi-hr /var/www/vbi-hr-staging; do
  mkdir -p "${dir}/.output"
  chown -R "${DEPLOY_USER}:www-data" "${dir}"
  chmod -R g+w "${dir}"
done

echo "→ systemd"
install -m 644 deploy/systemd/vbi-hr.service /etc/systemd/system/vbi-hr.service
install -m 644 deploy/systemd/vbi-hr-staging.service /etc/systemd/system/vbi-hr-staging.service
systemctl daemon-reload
systemctl enable vbi-hr vbi-hr-staging

echo "→ nginx (примеры в sites-available)"
install -m 644 deploy/nginx/vbi-hr.conf.example /etc/nginx/sites-available/vbi-hr.conf.example
install -m 644 deploy/nginx/vbi-hr-staging.conf.example /etc/nginx/sites-available/vbi-hr-staging.conf.example

cat <<'EOF'

Дальше вручную:
1. Отредактируйте server_name в /etc/nginx/sites-available/vbi-hr*.conf.example
2. ln -s .../vbi-hr.conf.example /etc/nginx/sites-enabled/vbi-hr.conf
3. ln -s .../vbi-hr-staging.conf.example /etc/nginx/sites-enabled/vbi-hr-staging.conf
4. nginx -t && systemctl reload nginx
5. Добавьте SSH-ключ пользователя deploy для GitLab CI
6. sudo visudo — разрешите deploy перезапускать сервисы без пароля:
   deploy ALL=(ALL) NOPASSWD: /bin/systemctl restart vbi-hr, /bin/systemctl restart vbi-hr-staging, /bin/systemctl is-active vbi-hr, /bin/systemctl is-active vbi-hr-staging

Подробно: docs/DEPLOYMENT.md
EOF
