#!/usr/bin/env python3
"""One-off: удалить calendar.event у владельца вебхука и пересинковать через lists.element.add."""
from __future__ import annotations

import json
import re
import urllib.error
import urllib.request
from pathlib import Path

ENV_CANDIDATES = [
    Path("/var/www/vbi-hr/.env"),
    Path("/etc/vbi-hr/bitrix-production.env"),
]
OAUTH_FILE = Path("/var/www/vbi-hr/server/data/bitrix-oauth-service.json")
VACATIONS_FILE = Path("/var/www/vbi-hr/server/data/vacations.json")


def load_env() -> dict[str, str]:
    env: dict[str, str] = {}
    for path in ENV_CANDIDATES:
        if not path.exists():
            continue
        for line in path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def http_json(url: str, payload: dict) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        try:
            return json.loads(body)
        except Exception:
            return {"error": f"HTTP {e.code}", "error_description": body[:300]}


def main() -> int:
    env = load_env()
    portal = env.get("BITRIX_PORTAL_URL", "https://crm.vbi.ru").rstrip("/")
    client_id = env.get("BITRIX_CLIENT_ID", "")
    client_secret = env.get("BITRIX_CLIENT_SECRET", "")
    webhook = env.get("BITRIX_WEBHOOK_URL", "").rstrip("/")
    owner_match = re.search(r"/rest/(\d+)/", webhook)
    owner_id = int(owner_match.group(1)) if owner_match else 2684

    oauth = json.loads(OAUTH_FILE.read_text())
    refresh = str(oauth.get("refresh_token") or "").strip()
    if not refresh or not client_id or not client_secret:
        print("FAIL: no oauth refresh / client credentials")
        return 1

    token_resp = http_json(
        f"{portal}/oauth/token/",
        {
            "grant_type": "refresh_token",
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh,
        },
    )
    # Bitrix oauth/token expects form-urlencoded; retry if needed
    if token_resp.get("error") or not token_resp.get("access_token"):
        import urllib.parse

        data = urllib.parse.urlencode(
            {
                "grant_type": "refresh_token",
                "client_id": client_id,
                "client_secret": client_secret,
                "refresh_token": refresh,
            }
        ).encode()
        req = urllib.request.Request(
            f"{portal}/oauth/token/",
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=45) as resp:
            token_resp = json.loads(resp.read().decode())

    access = token_resp.get("access_token")
    if not access:
        print("FAIL: cannot refresh access_token:", token_resp.get("error"), token_resp.get("error_description"))
        return 1

    if token_resp.get("refresh_token"):
        oauth["refresh_token"] = token_resp["refresh_token"]
        oauth["access_token"] = access
        OAUTH_FILE.write_text(json.dumps(oauth, ensure_ascii=False, indent=2) + "\n")

    def rest(method: str, params: dict | None = None) -> dict:
        payload = dict(params or {})
        payload["auth"] = access
        return http_json(f"{portal}/rest/{method}.json", payload)

    vacations = json.loads(VACATIONS_FILE.read_text())
    employees = json.loads(Path("/var/www/vbi-hr/server/data/employees.json").read_text())
    by_name = {str(e.get("name")): e for e in employees}

    deleted = []
    for year, rows in (vacations.get("requestsByYear") or {}).items():
        for row in rows:
            if row.get("bitrix_sync_method") != "calendar.event.add" or not row.get("bitrix_absence_id"):
                continue
            event_id = int(row["bitrix_absence_id"])
            r = rest(
                "calendar.event.delete",
                {"type": "user", "ownerId": owner_id, "id": event_id},
            )
            ok = "result" in r and not r.get("error")
            deleted.append({"id": row.get("id"), "event": event_id, "ok": ok, "error": r.get("error") or r.get("error_description")})
            if not ok:
                continue
            row.pop("bitrix_absence_id", None)
            row.pop("bitrix_sync_status", None)
            row.pop("bitrix_sync_method", None)
            row.pop("bitrix_synced_at", None)
            row.pop("bitrix_sync_error", None)

    print("deleted_calendar:", json.dumps(deleted, ensure_ascii=False))

    iblock_type = env.get("BITRIX_ABSENCE_IBLOCK_TYPE_ID", "structure")
    iblock_id = env.get("BITRIX_ABSENCE_IBLOCK_ID")
    if not iblock_id:
        lists = rest("lists.get", {"IBLOCK_TYPE_ID": iblock_type})
        rows = lists.get("result") or []
        hit = next((x for x in rows if re.search(r"график.*отсутств", str(x.get("NAME") or ""), re.I)), None)
        iblock_id = hit.get("ID") if hit else None
        print("lists.get count:", len(rows), "absence_iblock:", iblock_id)
        if lists.get("error"):
            print("lists.get error:", lists.get("error"), lists.get("error_description"))

    if not iblock_id:
        print("FAIL: no absence iblock — add lists scope to OAuth app or set BITRIX_ABSENCE_IBLOCK_ID")
        VACATIONS_FILE.write_text(json.dumps(vacations, ensure_ascii=False, indent=2) + "\n")
        return 2

    user_prop = env.get("BITRIX_ABSENCE_PROPERTY_USER") or "PROPERTY_USER"
    type_prop = env.get("BITRIX_ABSENCE_PROPERTY_TYPE") or "PROPERTY_ABSENCE_TYPE"
    type_enum = env.get("BITRIX_ABSENCE_TYPE_ENUM") or "1"

    fields_resp = rest("lists.field.get", {"IBLOCK_TYPE_ID": iblock_type, "IBLOCK_ID": iblock_id})
    for code, meta in (fields_resp.get("result") or {}).items():
        name = str((meta or {}).get("NAME") or "").lower()
        if re.search(r"сотрудник|пользователь|user", name) and code.startswith("PROPERTY_"):
            user_prop = code
        if re.search(r"тип.*отсутств|absence", name):
            type_prop = code
    print("properties:", user_prop, type_prop)

    def to_bitrix_dt(iso: str, end: bool = False) -> str:
        y, m, d = iso.split("-")
        return f"{d}.{m}.{y} {'23:59:59' if end else '00:00:00'}"

    resynced = []
    for year, rows in (vacations.get("requestsByYear") or {}).items():
        for row in rows:
            if row.get("status") != "approved":
                continue
            # only those we just cleared from calendar, or previously failed sync
            if row.get("bitrix_sync_status") == "synced" and row.get("bitrix_absence_id"):
                continue
            # resync only former calendar ones: no sync fields left and id in deleted list
            if not any(d["id"] == row.get("id") for d in deleted):
                continue
            emp = by_name.get(str(row.get("employee")))
            bitrix_uid = (emp or {}).get("bitrix_user_id") or (emp or {}).get("platform_user_id") or (emp or {}).get("id")
            if not bitrix_uid:
                resynced.append({"id": row.get("id"), "ok": False, "error": "no bitrix_user_id"})
                continue
            add = rest(
                "lists.element.add",
                {
                    "IBLOCK_TYPE_ID": iblock_type,
                    "IBLOCK_ID": iblock_id,
                    "ELEMENT_CODE": f"vbi-hr-vac-{row.get('id')}",
                    "FIELDS": {
                        "NAME": "Отпуск ежегодный (VBI HR)",
                        "ACTIVE_FROM": to_bitrix_dt(row["start"], False),
                        "ACTIVE_TO": to_bitrix_dt(row["end"], True),
                        user_prop: bitrix_uid,
                        type_prop: type_enum,
                    },
                },
            )
            if add.get("error"):
                row["bitrix_sync_status"] = "failed"
                row["bitrix_sync_error"] = f"{add.get('error')}: {add.get('error_description')}"
                resynced.append({"id": row.get("id"), "employee": row.get("employee"), "ok": False, "error": row["bitrix_sync_error"]})
            else:
                row["bitrix_absence_id"] = add.get("result")
                row["bitrix_sync_status"] = "synced"
                row["bitrix_sync_method"] = "lists.element.add"
                row["bitrix_synced_at"] = __import__("datetime").datetime.utcnow().isoformat() + "Z"
                row.pop("bitrix_sync_error", None)
                resynced.append({"id": row.get("id"), "employee": row.get("employee"), "ok": True, "absenceId": add.get("result"), "bitrix_user_id": bitrix_uid})

    VACATIONS_FILE.write_text(json.dumps(vacations, ensure_ascii=False, indent=2) + "\n")
    print("resynced:", json.dumps(resynced, ensure_ascii=False))
    print("DONE")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
