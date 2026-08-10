#!/usr/bin/env python3
"""Hotfix: CSP form-action 'self' blocked cross-port POST. Relative form + absolute redirects."""
from pathlib import Path
import re

ORIGIN = "http://45.12.74.25"
ROOT = Path("/var/www/vbi-hr/.output/server")
cb = ROOT / "chunks/routes/api/auth/bitrix/callback.get.mjs"
tp = ROOT / "chunks/routes/api/auth/bitrix-ticket.post.mjs"
tg = ROOT / "chunks/routes/api/auth/bitrix-ticket.get.mjs"

for p in (cb, tp, tg):
    bak = Path(str(p) + ".bak-cspfix")
    if not bak.exists():
        bak.write_bytes(p.read_bytes())

text = cb.read_text()
# Relative form action — same origin on :8080, CSP allows
if f'action="{ORIGIN}/api/auth/bitrix-ticket"' in text:
    text = text.replace(
        f'action="{ORIGIN}/api/auth/bitrix-ticket"',
        'action="/api/auth/bitrix-ticket"',
    )
    print("callback: form action -> relative")
elif 'action="/api/auth/bitrix-ticket"' in text:
    print("callback: form action already relative")
else:
    raise SystemExit("form action not found")

# Absolute auth_error redirects from callback
patched_err = False
for old, new in [
    (
        'return sendRedirect(event, "/?" + url.searchParams.toString());',
        f'return sendRedirect(event, "{ORIGIN}/?" + url.searchParams.toString());',
    ),
    (
        'return sendRedirect(event, "/?" + url.searchParams.toString())',
        f'return sendRedirect(event, "{ORIGIN}/?" + url.searchParams.toString())',
    ),
]:
    if old in text:
        text = text.replace(old, new)
        patched_err = True
        print("callback: absolute auth_error redirect")
        break
if not patched_err:
    if f'sendRedirect(event, "{ORIGIN}/?"' in text or f"sendRedirect(event, `{ORIGIN}/?" in text:
        print("callback: auth_error already absolute-ish")
    elif 'sendRedirect(event, "/?" +' in text:
        text = text.replace(
            'sendRedirect(event, "/?" +',
            f'sendRedirect(event, "{ORIGIN}/?" +',
            1,
        )
        print("callback: absolute auth_error redirect (loose)")
    else:
        # Try compiled pattern with template-ish concat from earlier patch of getOAuthReturnOrigin
        m = re.search(r'sendRedirect\(event,\s*"/\?([^"]*)"', text)
        if m and "auth_error" in text[max(0, m.start() - 200) : m.end() + 200]:
            print("WARN: check auth_error redirect manually")
        else:
            print("WARN: auth_error redirect pattern not found")

cb.write_text(text)

for path in (tp, tg):
    t = path.read_text()
    if f'"{ORIGIN}/?auth=bitrix"' in t:
        print(f"{path.name}: absolute auth=bitrix OK")
        continue
    t2 = t.replace('"/?auth=bitrix"', f'"{ORIGIN}/?auth=bitrix"')
    t2 = t2.replace('"/?auth_error="', f'"{ORIGIN}/?auth_error="')
    if t2 == t:
        raise SystemExit(f"ticket redirect not absolute in {path}")
    path.write_text(t2)
    print(f"{path.name}: patched absolute redirects")

print("ok")
