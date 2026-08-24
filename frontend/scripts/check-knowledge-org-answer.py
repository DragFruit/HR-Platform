#!/usr/bin/env python3
"""Smoke: кто руководит отделом — из org-structure.json (без Nuxt/~)."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]  # frontend/
ORG = json.loads((ROOT / "server/data/org-structure.json").read_text(encoding="utf-8"))

DEPT = [
    (["отдел разработки", "разработки", "разработкой", "разработке", "dev", "development"], ["Отдел разработки"]),
    (["digital", "диджитал"], ["Digital отдел"]),
    (["orm", "serm"], ["ORM отдел", "SEO&SERM"]),
    (["seo", "сео"], ["SEO отдел", "SEO&SERM"]),
]

ORG_INTENT = re.compile(
    r"(?:кто|как\s+зовут).{0,60}(?:руковод|начальн|глав|лид|директор|возглавл)|"
    r"(?:руковод|начальн|лид|директор).{0,40}(?:отдел|дирекци|digital|dev|seo|orm)|"
    r"(?:генеральн\w*\s+директор|гендир|финансовый\s+директор|коммерческий\s+директор)",
    re.I,
)


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.lower().replace("ё", "е")).strip()


def head_for(q: str) -> str | None:
    qn = norm(q)
    if not ORG_INTENT.search(qn):
        return None
    if re.search(r"гендир|генеральн\w*\s+директор", qn):
        exe = next((e for e in ORG["executives"] if re.search(r"генеральн", e.get("title") or "", re.I)), None)
        return (exe or {}).get("person")
    ranked = sorted(DEPT, key=lambda row: -max(len(a) for a in row[0]))
    for aliases, names in ranked:
        if any(a in qn for a in aliases):
            for name in names:
                u = next((x for x in ORG["units"] if x.get("name") == name and str(x.get("head") or "").strip()), None)
                if u:
                    return u["head"]
            for name in names:
                u = next((x for x in ORG["units"] if x.get("name") == name), None)
                if u:
                    return u.get("head") or ""
    return None


cases = [
    ("кто руководит отделом разработки", "Музыка Сергей", ["Новоторцева"]),
    ("кто руководитель Digital", "Ревзина", []),
    ("кто генеральный директор", "Вадим", []),
    ("кто руководит ORM", "Новоторцева", []),
]

failed = 0
for q, expect, reject in cases:
    head = head_for(q)
    text = head or ""
    ok = expect in text and not any(r in text for r in reject)
    if not ok:
        failed += 1
        print("FAIL", q, "→", repr(text))
    else:
        print("OK", q, "→", text)

if failed:
    print(f"failed {failed}/{len(cases)}", file=sys.stderr)
    sys.exit(1)
print(f"ok {len(cases)}/{len(cases)}")
