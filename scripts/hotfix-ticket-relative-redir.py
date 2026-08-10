#!/usr/bin/env python3
"""Prod hotfix: relative Location after bitrix-ticket (CSP-safe on same host)."""
from pathlib import Path

DIR = Path("/var/www/vbi-hr/.output/server/chunks/routes/api/auth")
REPLACEMENTS = [
    ("`${returnOrigin}/?auth=bitrix`", "`/?auth=bitrix`"),
    ("`${returnOrigin}/?auth_error=` + encodeURIComponent(", "`/?auth_error=` + encodeURIComponent("),
    ('"${returnOrigin}/?auth=bitrix"', '"/?auth=bitrix"'),
    ("http://45.12.74.25/?auth=bitrix", "/?auth=bitrix"),
    ("http://45.12.74.25/?auth_error=", "/?auth_error="),
]

for name in ("bitrix-ticket.post.mjs", "bitrix-ticket.get.mjs"):
    p = DIR / name
    t = p.read_text()
    bak = Path(str(p) + ".bak-relative-redir")
    if not bak.exists():
        bak.write_text(t)
    t2 = t
    for old, new in REPLACEMENTS:
        t2 = t2.replace(old, new)
    if t2 == t:
        hits = [ln.strip() for ln in t.splitlines() if "auth=bitrix" in ln or "auth_error" in ln]
        print(name, "no change;", hits[:6])
    else:
        p.write_text(t2)
        print(name, "patched to relative redirects")
print("ok")
