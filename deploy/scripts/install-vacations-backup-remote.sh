#!/usr/bin/env bash
# Поставить weekly snapshot vacations.json на бой и сразу снять первый снимок.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
: "${DEPLOY_HOST:?}"
: "${DEPLOY_USER:?}"

SSH_CMD=(ssh)
SCP_CMD=(scp -o IdentitiesOnly=yes)
if [[ -n "${DEPLOY_SSH_KEY:-}" && -f "${DEPLOY_SSH_KEY}" ]]; then
  SSH_CMD+=( -i "${DEPLOY_SSH_KEY}" -o IdentitiesOnly=yes )
  SCP_CMD=(scp -i "${DEPLOY_SSH_KEY}" -o IdentitiesOnly=yes)
fi

REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"
INSTALL_REMOTE="root@${DEPLOY_HOST}"

"${SCP_CMD[@]}" \
  "${ROOT}/deploy/scripts/run-vacations-backup.sh" \
  "${ROOT}/deploy/systemd/vbi-hr-vacations-backup.service" \
  "${ROOT}/deploy/systemd/vbi-hr-vacations-backup.timer" \
  "${REMOTE}:/home/${DEPLOY_USER}/"

"${SSH_CMD[@]}" "${INSTALL_REMOTE}" "set -euo pipefail
mkdir -p /var/www/vbi-hr/deploy-scripts /var/www/vbi-hr/server/data/backups/vacations
install -m 755 /home/${DEPLOY_USER}/run-vacations-backup.sh /var/www/vbi-hr/deploy-scripts/run-vacations-backup.sh
install -m 644 /home/${DEPLOY_USER}/vbi-hr-vacations-backup.service /etc/systemd/system/vbi-hr-vacations-backup.service
install -m 644 /home/${DEPLOY_USER}/vbi-hr-vacations-backup.timer /etc/systemd/system/vbi-hr-vacations-backup.timer
chown -R deploy:deploy /var/www/vbi-hr/server/data/backups /var/www/vbi-hr/deploy-scripts/run-vacations-backup.sh
systemctl daemon-reload
systemctl enable --now vbi-hr-vacations-backup.timer
systemctl start vbi-hr-vacations-backup.service
systemctl is-enabled vbi-hr-vacations-backup.timer
systemctl list-timers vbi-hr-vacations-backup.timer --no-pager
echo '--- snapshots ---'
ls -l /var/www/vbi-hr/server/data/backups/vacations/
"
