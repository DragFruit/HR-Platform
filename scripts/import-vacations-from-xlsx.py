#!/usr/bin/env python3
"""Импорт остатков и заявок на отпуск из Excel «График отпусков (HR)» (лист 2026)."""

from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

try:
    import openpyxl
except ImportError:
    print("Установите openpyxl: pip install openpyxl", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
EMPLOYEES_FILE = ROOT / "frontend/server/data/employees.json"
VACATIONS_FILE = ROOT / "frontend/server/data/vacations.json"
DEFAULT_XLSX = Path.home() / "Downloads/График отпусков (HR)  (1).xlsx"

APPROVED_RGB = {"FF00FF00"}
PENDING_RGB = {"FFFFFF00"}
YEAR = 2026


def norm_name(value: str) -> str:
    return " ".join(str(value or "").strip().lower().split())


def name_keys(value: str) -> set[str]:
    parts = norm_name(value).split()
    keys: set[str] = set()
    if len(parts) >= 2:
        keys.add(f"{parts[0]} {parts[1]}")
        keys.add(f"{parts[1]} {parts[0]}")
    return keys


def parse_ranges(ws, row: int) -> list[tuple[str, str, str]]:
    ranges: list[tuple[str, str, str]] = []
    start: datetime | None = None
    end: datetime | None = None
    status: str | None = None

    for col in range(8, ws.max_column + 1):
        cell = ws.cell(row, col)
        rgb = cell.fill.fgColor.rgb if cell.fill and cell.fill.fgColor else None
        if rgb in APPROVED_RGB:
            st = "approved"
        elif rgb in PENDING_RGB:
            st = "pending"
        else:
            continue

        day = ws.cell(3, col).value
        if not isinstance(day, datetime):
            continue

        if start is None:
            start = day
            end = day
            status = st
        elif st == status and (day - end).days == 1:
            end = day
        else:
            ranges.append((start.date().isoformat(), end.date().isoformat(), status))
            start = day
            end = day
            status = st

    if start is not None and end is not None and status is not None:
        ranges.append((start.date().isoformat(), end.date().isoformat(), status))
    return ranges


def match_employee(xlsx_name: str, employees: list[dict]) -> dict | None:
    index: dict[str, dict] = {}
    for emp in employees:
        for key in name_keys(emp.get("name", "")):
            index.setdefault(key, emp)
    for key in name_keys(xlsx_name):
        if key in index:
            return index[key]
    return None


def main() -> int:
    xlsx_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_XLSX
    if not xlsx_path.exists():
        print(f"Файл не найден: {xlsx_path}", file=sys.stderr)
        return 1

    employees = json.loads(EMPLOYEES_FILE.read_text(encoding="utf-8"))
    wb = openpyxl.load_workbook(xlsx_path, data_only=False)
    if "2026" not in wb.sheetnames:
        print("Лист 2026 не найден", file=sys.stderr)
        return 1
    ws = wb["2026"]

    requests: list[dict] = []
    openings: dict[str, float] = {}
    unmatched: list[str] = []
    matched = 0

    for row in range(5, ws.max_row + 1):
        xlsx_name = ws.cell(row, 2).value
        if not xlsx_name:
            continue
        emp = match_employee(str(xlsx_name), employees)
        if not emp:
            unmatched.append(str(xlsx_name))
            continue
        matched += 1

        balance = ws.cell(row, 5).value
        if isinstance(balance, (int, float)):
            openings[emp["name"]] = round(float(balance), 1)
            emp["vacation_opening_balance"] = round(float(balance), 1)

        for start, end, status in parse_ranges(ws, row):
            requests.append(
                {
                    "employee": emp["name"],
                    "start": start,
                    "end": end,
                    "status": status,
                }
            )

    vacation_state = {
        "primaryYear": YEAR,
        "nextRequestId": max(1000, len(requests) + 1),
        "requestsByYear": {
            str(YEAR): [
                {
                    "id": idx + 1,
                    "employee": item["employee"],
                    "start": item["start"],
                    "end": item["end"],
                    "status": item["status"],
                    "comment": "Импорт из Excel",
                    "createdAt": datetime.now().strftime("%d.%m.%Y"),
                }
                for idx, item in enumerate(requests)
            ]
        },
    }

    EMPLOYEES_FILE.write_text(json.dumps(employees, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    VACATIONS_FILE.write_text(json.dumps(vacation_state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"Сотрудников сопоставлено: {matched}")
    print(f"Остатков на 01.01.{YEAR}: {len(openings)}")
    print(f"Заявок: {len(requests)} (approved: {sum(1 for r in requests if r['status']=='approved')}, pending: {sum(1 for r in requests if r['status']=='pending')})")
    if unmatched:
        print(f"Не найдены в справочнике ({len(unmatched)}): {', '.join(unmatched[:10])}")
    print(f"Записано: {VACATIONS_FILE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
