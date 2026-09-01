#!/usr/bin/env python3
"""Hotfix production auth hang: absolute handoff URLs to :80."""
from pathlib import Path
import re

ORIGIN = "http://45.12.74.25"
ROOT = Path("/var/www/vbi-hr/.output/server")

cb = ROOT / "chunks/routes/api/auth/bitrix/callback.get.mjs"
tp = ROOT / "chunks/routes/api/auth/bitrix-ticket.post.mjs"
tg = ROOT / "chunks/routes/api/auth/bitrix-ticket.get.mjs"
bc = ROOT / "chunks/_/bitrixConfig.mjs"

for p in (cb, tp, tg, bc):
    bak = Path(str(p) + ".bak-hangfix")
    if not bak.exists():
        bak.write_bytes(p.read_bytes())

text = cb.read_text()
old = 'action="/api/auth/bitrix-ticket"'
new = f'action="{ORIGIN}/api/auth/bitrix-ticket"'
if old not in text:
    raise SystemExit("callback action not found")
cb.write_text(text.replace(old, new, 1))
print("callback: form action -> absolute :80")

for path in (tp, tg):
    t = path.read_text()
    t2 = t.replace('"/?auth=bitrix"', f'"{ORIGIN}/?auth=bitrix"')
    t2 = t2.replace('"/?auth_error="', f'"{ORIGIN}/?auth_error="')
    if t2 == t:
        raise SystemExit(f"no redirects patched in {path}")
    path.write_text(t2)
    print(f"patched redirects: {path.name}")

bt = bc.read_text()
if "APP_PUBLIC_URL" in bt and "getOAuthReturnOrigin" in bt:
    print("bitrixConfig: already has APP_PUBLIC_URL ref")
else:
    m = re.search(
        r"function (\w+)\(event\) \{\s*return getRequestPublicOrigin\(event\);\s*\}",
        bt,
    )
    if not m:
        print("WARN: could not patch bitrixConfig getOAuthReturnOrigin")
    else:
        name = m.group(1)
        oldf = m.group(0)
        newf = (
            f"function {name}(event) {{ "
            'const u=String(process.env.APP_PUBLIC_URL||"").trim().replace(/\\/+$/,""); '
            "if(u){try{return new URL(u).origin;}catch{}} "
            "return getRequestPublicOrigin(event); }"
        )
        bc.write_text(bt.replace(oldf, newf, 1))
        print("bitrixConfig: patched", name)

print("ok")
