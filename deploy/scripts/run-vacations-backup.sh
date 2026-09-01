#!/usr/bin/env bash
# Еженедельный снапшот vacations.json (заявки, брони, лимиты, статусы).
# Не ходит в HTTP: работает даже если Nitro лежит.
set -euo pipefail

SRC="${VACATIONS_BACKUP_SRC:-/var/www/vbi-hr/server/data/vacations.json}"
DEST_DIR="${VACATIONS_BACKUP_DIR:-/var/www/vbi-hr/server/data/backups/vacations}"
KEEP="${VACATIONS_BACKUP_KEEP:-12}"
DATE_UTC="$(date -u +%Y-%m-%d)"

if [[ ! -f "$SRC" ]]; then
  echo "нет файла отпусков: ${SRC}" >&2
  exit 1
fi

mkdir -p "$DEST_DIR"

tmp="$(mktemp "${DEST_DIR}/.vacations-XXXXXX")"
trap 'rm -f "$tmp"' EXIT
cp -a "$SRC" "$tmp"

python3 - "$tmp" <<'PY'
import json, sys
path = sys.argv[1]
with open(path, encoding="utf-8") as f:
    data = json.load(f)
if not isinstance(data, dict):
    raise SystemExit("vacations.json: ожидался объект")
reqs = data.get("requestsByYear") or {}
res = data.get("reservationsByYear") or {}
req_n = sum(len(v) for v in reqs.values() if isinstance(v, list))
res_n = sum(len(v) for v in res.values() if isinstance(v, list))
years = sorted({*reqs, *res})
print(f"ok requests={req_n} reservations={res_n} years={','.join(years) or '—'}")
PY

out="${DEST_DIR}/vacations-${DATE_UTC}.json"
mv -f "$tmp" "$out"
trap - EXIT
chmod 640 "$out" 2>/dev/null || true

# Оставляем KEEP самых новых снапшотов
keep_n="$KEEP"
n=0
while IFS= read -r f; do
  n=$((n + 1))
  if [ "$n" -gt "$keep_n" ]; then
    rm -f "$f"
  fi
done <<EOF
$(ls -1t "${DEST_DIR}"/vacations-*.json 2>/dev/null)
EOF

echo "saved ${out} (keep ${KEEP})"
ls -1t "${DEST_DIR}"/vacations-*.json | head -n "$KEEP"
