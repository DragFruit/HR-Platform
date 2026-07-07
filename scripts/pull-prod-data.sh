#!/usr/bin/env bash
# Скачать актуальные данные с production в репозиторий.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA="${ROOT}/frontend/server/data"
KEY="${DEPLOY_SSH_KEY:-${HOME}/.ssh/vbi_hr_deploy}"
REMOTE="${DEPLOY_USER:-deploy}@${DEPLOY_HOST:-45.12.74.25}"
REMOTE_DATA="/var/www/vbi-hr/server/data"

SCP=(scp -o IdentitiesOnly=yes)
if [[ -f "${KEY}" ]]; then
  SCP+=( -i "${KEY}" )
fi

for file in employees.json vacations.json; do
  echo "→ ${file}"
  "${SCP[@]}" "${REMOTE}:${REMOTE_DATA}/${file}" "${DATA}/${file}"
done

echo "✓ employees: $(python3 -c "import json; print(len(json.load(open('${DATA}/employees.json'))))")"
echo "  vacations primaryYear: $(python3 -c "import json; print(json.load(open('${DATA}/vacations.json')).get('primaryYear'))")"
