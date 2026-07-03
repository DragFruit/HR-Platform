#!/usr/bin/env python3
"""Импорт дат трудоустройства, остатков и заявок из Excel «График отпусков (HR)» (лист 2026)."""

from __future__ import annotations

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

from vacation_balance_py import calc_remain

ROOT = SCRIPT_DIR.parent
EMPLOYEES_FILE = ROOT / "frontend/server/data/employees.json"
MANAGERS_FILE = ROOT / "frontend/server/data/employee-managers.json"
VACATIONS_FILE = ROOT / "frontend/server/data/vacations.json"
DEFAULT_XLSX = Path.home() / "Downloads/График отпусков (HR)  (1).xlsx"

APPROVED_RGB = {"FF00FF00"}
PENDING_RGB = {"FFFFFF00"}
YEAR = 2026
COL_DEPT = 1
COL_NAME = 2
COL_TITLE = 3
COL_HIRE = 4
COL_OPENING = 5
COL_AVAILABLE = 6
TOLERANCE = 0.15


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
    index: dict[str, dict] = {}
    for emp in employees:
        for key in name_keys(emp.get("name", "")):
            index.setdefault(key, emp)
    for key in name_keys(xlsx_name):
        if key in index:
            return index[key]
    return None


def load_manager_overrides() -> tuple[dict[str, str], dict[str, str]]:
    if not MANAGERS_FILE.exists():
        return {}, {}
    try:
        payload = json.loads(MANAGERS_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}, {}
    by_id = payload.get("byId") if isinstance(payload.get("byId"), dict) else {}
    by_name = payload.get("byName") if isinstance(payload.get("byName"), dict) else {}
    return by_id, by_name


def snapshot_managers(employees: list[dict]) -> dict[int, str]:
    return {int(emp["id"]): str(emp.get("manager", "")).strip() for emp in employees if "id" in emp}


def restore_managers(
    employees: list[dict],
    snapshot: dict[int, str],
    by_id: dict[str, str],
    by_name: dict[str, str],
) -> None:
    for emp in employees:
        emp_id = int(emp["id"])
        manager = ""
        if str(emp_id) in by_id and str(by_id[str(emp_id)]).strip():
            manager = str(by_id[str(emp_id)]).strip()
        else:
            name_key = norm_name(str(emp.get("name", "")))
            if name_key in by_name and str(by_name[name_key]).strip():
                manager = str(by_name[name_key]).strip()
            elif emp_id in snapshot:
                manager = snapshot[emp_id]
        emp["manager"] = manager


def main() -> int:
    xlsx_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_XLSX
    if not xlsx_path.exists():
        print(f"Файл не найден: {xlsx_path}", file=sys.stderr)
        return 1

    employees = json.loads(EMPLOYEES_FILE.read_text(encoding="utf-8"))
    manager_snapshot = snapshot_managers(employees)
    manager_by_id, manager_by_name = load_manager_overrides()
    wb_data = openpyxl.load_workbook(xlsx_path, data_only=True)
    wb_colors = openpyxl.load_workbook(xlsx_path, data_only=False)
    if "2026" not in wb_data.sheetnames:
        print("Лист 2026 не найден", file=sys.stderr)
        return 1
    ws = wb_data["2026"]
    ws_colors = wb_colors["2026"]

    as_of = cell_date(ws.cell(1, 1).value) or date.today()

    requests: list[dict] = []
    openings: dict[str, float] = {}
    hires_updated = 0
    unmatched: list[str] = []
    matched = 0

    for row in range(5, ws.max_row + 1):
        xlsx_name = ws.cell(row, COL_NAME).value
        if not xlsx_name:
            continue
        emp = match_employee(str(xlsx_name), employees)
        if not emp:
            unmatched.append(str(xlsx_name))
            continue
        matched += 1

        hire = cell_date(ws.cell(row, COL_HIRE).value)
        if hire:
            emp["hired_at"] = hire.isoformat()
            hires_updated += 1

        title = ws.cell(row, COL_TITLE).value
        if title:
            emp["title"] = str(title).strip()

        dept = ws.cell(row, COL_DEPT).value
        if dept:
            emp["department"] = str(dept).strip()

        balance = ws.cell(row, COL_OPENING).value
        if isinstance(balance, (int, float)):
            opening = round(float(balance), 2)
            openings[emp["name"]] = opening
            emp["vacation_opening_balance"] = opening

        emp.pop("vacation_consumed_adjustment", None)

        for start, end, status in parse_ranges(ws_colors, row):
            requests.append(
                {
                    "employee": emp["name"],
                    "start": start,
                    "end": end,
                    "status": status,
                }
            )

    restore_managers(employees, manager_snapshot, manager_by_id, manager_by_name)

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

    EMPLOYEES_FILE.write_text(
        json.dumps(employees, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    VACATIONS_FILE.write_text(json.dumps(vacation_state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    req_list = vacation_state["requestsByYear"][str(YEAR)]
    balance_diffs: list[tuple[str, float, float, str]] = []
    for row in range(5, ws.max_row + 1):
        xlsx_name = ws.cell(row, COL_NAME).value
        if not xlsx_name:
            continue
        emp = match_employee(str(xlsx_name), employees)
        if not emp:
            continue
        excel_avail = ws.cell(row, COL_AVAILABLE).value
        if not isinstance(excel_avail, (int, float)):
            continue
        hire_iso = emp.get("hired_at")
        if not hire_iso:
            continue
        calc = calc_remain(
            emp["name"],
            hire_iso,
            req_list,
            as_of,
            YEAR,
            emp.get("vacation_opening_balance"),
        )
        excel_v = round(float(excel_avail), 2)
        if abs(calc - excel_v) > TOLERANCE:
            balance_diffs.append((emp["name"], excel_v, calc, hire_iso))

    print(f"Дата сверки (A1): {as_of.isoformat()}")
    print(f"Сотрудников сопоставлено: {matched}")
    print(f"Дат трудоустройства обновлено: {hires_updated}")
    print(f"Остатков на 01.01.{YEAR}: {len(openings)}")
    print(
        f"Заявок: {len(requests)} "
        f"(approved: {sum(1 for r in requests if r['status'] == 'approved')}, "
        f"pending: {sum(1 for r in requests if r['status'] == 'pending')})"
    )
    print(
        f"Отличий от кол. F Excel (>{TOLERANCE}, справочно — в файле другая формула): "
        f"{len(balance_diffs)}"
    )
    for name, excel_v, calc_v, hire in balance_diffs:
        print(f"  {name}: Excel={excel_v} ЗУП={calc_v} hire={hire}")
    if unmatched:
        print(f"Не найдены в справочнике ({len(unmatched)}): {', '.join(unmatched)}")
    print(f"Записано: {EMPLOYEES_FILE}, {VACATIONS_FILE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
