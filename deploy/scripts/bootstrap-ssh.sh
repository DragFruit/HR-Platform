#!/usr/bin/env bash
# Создаёт ~/.ssh/vbi_hr_deploy и печатает публичный ключ для GitLab + VPS.
set -euo pipefail

KEY="${HOME}/.ssh/vbi_hr_deploy"

if [[ ! -f "${KEY}" ]]; then
  ssh-keygen -t ed25519 -f "${KEY}" -N "" -C "vbi-hr-deploy"
fi

ssh-keyscan -p 2222 -H ilnizumak.beget.app >> "${HOME}/.ssh/known_hosts" 2>/dev/null || true
ssh-keyscan -H 45.12.74.25 >> "${HOME}/.ssh/known_hosts" 2>/dev/null || true

CONFIG_MARK="# vbi-hr-deploy"
if ! grep -q "${CONFIG_MARK}" "${HOME}/.ssh/config" 2>/dev/null; then
  cat >> "${HOME}/.ssh/config" <<EOF

${CONFIG_MARK}
Host vbi-gitlab
  HostName ilnizumak.beget.app
  Port 2222
  User git
  IdentityFile ${KEY}
  IdentitiesOnly yes

Host vbi-vps
  HostName 45.12.74.25
  User root
  IdentityFile ${KEY}
  IdentitiesOnly yes

Host vbi-vps-deploy
  HostName 45.12.74.25
  User deploy
  IdentityFile ${KEY}
  IdentitiesOnly yes
EOF
  chmod 600 "${HOME}/.ssh/config"
fi

echo ""
echo "=== Публичный ключ (добавьте в GitLab и на VPS) ==="
cat "${KEY}.pub"
echo ""
echo "GitLab: https://ilnizumak.beget.app/-/user_settings/ssh_keys"
echo "Дальше: deploy/SETUP-ILNIZUMAK.md"
