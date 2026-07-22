#!/usr/bin/env python3
"""Импорт заявок одного года из Excel в vacations.json (merge, без правок employees).

Пример:
  python3 scripts/import-vacation-year-from-xlsx.py \\
    --year 2025 \\
    --xlsx "$HOME/Downloads/График отпусков (HR)  (2).xlsx"
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

try:
    import openpyxl
except ImportError:
    print("Установите openpyxl: pip install openpyxl", file=sys.stderr)
    sys.exit(1)

ROOT = SCRIPT_DIR.parent
EMPLOYEES_FILE = ROOT / "frontend/server/data/employees.json"
VACATIONS_FILE = ROOT / "frontend/server/data/vacations.json"

APPROVED_RGB = {"FF00FF00"}
PENDING_RGB = {"FFFFFF00"}
COL_NAME = 2
COL_HIRE = 4

# Старые ФИО в Excel → актуальные в employees.json
NAME_ALIASES: dict[str, str] = {
    "зайцева алина": "Новосельцева Алина",
    "малкова наталья": "Малкова Наталия",
}


def norm_name(value: str) -> str:
    s = str(value or "").strip().lower().replace("ё", "е")
    return " ".join(s.split())


def name_keys(value: str) -> set[str]:
    parts = norm_name(value).split()
    keys: set[str] = set()
    if len(parts) >= 2:
        keys.add(f"{parts[0]} {parts[1]}")
        keys.add(f"{parts[1]} {parts[0]}")
    return keys


def cell_date(value) -> date | None:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return None


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
    alias = NAME_ALIASES.get(norm_name(xlsx_name))
    lookup_name = alias or xlsx_name

    by_full = {norm_name(emp.get("name", "")): emp for emp in employees}
    if alias and norm_name(alias) in by_full:
        return by_full[norm_name(alias)]

    index: dict[str, dict] = {}
    for emp in employees:
        for key in name_keys(emp.get("name", "")):
            index[key] = emp
    for key in name_keys(lookup_name):
        if key in index:
            return index[key]
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description="Merge vacation requests for one year from Excel")
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--xlsx", type=Path, required=True)
    parser.add_argument(
        "--sheet",
        type=str,
        default=None,
        help="Имя листа (по умолчанию = год)",
    )
    parser.add_argument(
        "--employees",
        type=Path,
        default=EMPLOYEES_FILE,
        help="Путь к employees.json (по умолчанию локальный seed)",
    )
    parser.add_argument(
        "--vacations",
        type=Path,
        default=VACATIONS_FILE,
        help="Путь к vacations.json (по умолчанию локальный seed)",
    )
    args = parser.parse_args()

    year = args.year
    sheet_name = args.sheet or str(year)
    xlsx_path = args.xlsx.expanduser()
    employees_file = args.employees.expanduser()
    vacations_file = args.vacations.expanduser()
    if not xlsx_path.is_file():
        print(f"Файл не найден: {xlsx_path}", file=sys.stderr)
        return 1
    if not employees_file.is_file():
        print(f"employees не найден: {employees_file}", file=sys.stderr)
        return 1
    if not vacations_file.is_file():
        print(f"vacations не найден: {vacations_file}", file=sys.stderr)
        return 1

    employees = json.loads(employees_file.read_text(encoding="utf-8"))
    vacations = json.loads(vacations_file.read_text(encoding="utf-8"))

    wb_colors = openpyxl.load_workbook(xlsx_path, data_only=False)
    wb_data = openpyxl.load_workbook(xlsx_path, data_only=True)
    if sheet_name not in wb_colors.sheetnames:
        print(f"Лист {sheet_name!r} не найден. Есть: {wb_colors.sheetnames}", file=sys.stderr)
        return 1

    ws_colors = wb_colors[sheet_name]
    ws_data = wb_data[sheet_name]

    requests: list[dict] = []
    unmatched: list[str] = []
    skipped_before_hire: list[tuple[str, str, str, str]] = []
    matched = 0

    for row in range(5, ws_data.max_row + 1):
        xlsx_name = ws_data.cell(row, COL_NAME).value
        if not xlsx_name:
            continue
        emp = match_employee(str(xlsx_name), employees)
        if not emp:
            unmatched.append(str(xlsx_name))
            continue
        matched += 1

        hire = cell_date(ws_data.cell(row, COL_HIRE).value)
        hire_iso = hire.isoformat() if hire else str(emp.get("hired_at") or "").strip()

        for start, end, status in parse_ranges(ws_colors, row):
            # Только дни выбранного года (на случай кривых дат в листе)
            if not start.startswith(f"{year}-"):
                continue
            if hire_iso and start < hire_iso:
                skipped_before_hire.append((emp["name"], hire_iso, start, end))
                continue
            requests.append(
                {
                    "employee": emp["name"],
                    "start": start,
                    "end": end,
                    "status": status,
                }
            )

    next_id = int(vacations.get("nextRequestId") or 1000)
    created_at = datetime.now().strftime("%d.%m.%Y")
    year_key = str(year)
    imported = []
    for item in requests:
        imported.append(
            {
                "id": next_id,
                "employee": item["employee"],
                "start": item["start"],
                "end": item["end"],
                "status": item["status"],
                "comment": f"Импорт из Excel ({year})",
                "createdAt": created_at,
            }
        )
        next_id += 1

    vacations.setdefault("requestsByYear", {})
    vacations["requestsByYear"][year_key] = imported
    vacations["nextRequestId"] = next_id
    # primaryYear / employees / opening balances не трогаем

    vacations_file.write_text(
        json.dumps(vacations, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"Лист: {sheet_name}")
    print(f"Сотрудников сопоставлено: {matched}")
    print(
        f"Заявок {year}: {len(imported)} "
        f"(approved: {sum(1 for r in imported if r['status'] == 'approved')}, "
        f"pending: {sum(1 for r in imported if r['status'] == 'pending')})"
    )
    print(f"primaryYear без изменений: {vacations.get('primaryYear')}")
    if unmatched:
        print(f"Не найдены ({len(unmatched)}): {', '.join(unmatched[:15])}"
              + ("…" if len(unmatched) > 15 else ""))
    if skipped_before_hire:
        print(f"Пропущены раньше hire ({len(skipped_before_hire)}):")
        for employee, hire_iso, start, end in skipped_before_hire[:10]:
            print(f"  {employee}: {start} — {end} (hired_at {hire_iso})")
    print(f"Записано: {vacations_file}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
