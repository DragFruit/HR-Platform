#!/usr/bin/env python3
"""Расчёт остатка отпуска (формула ZUP / vacationBalance.ts)."""

from __future__ import annotations

from datetime import date, timedelta

ANNUAL_NORM = 28

RU_HOLIDAYS_2026 = {
    "2026-01-01", "2026-01-02", "2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09",
    "2026-02-21", "2026-02-22", "2026-02-23", "2026-03-07", "2026-03-08", "2026-03-09",
    "2026-05-01", "2026-05-02", "2026-05-03", "2026-05-09", "2026-05-10", "2026-05-11",
    "2026-06-12", "2026-06-13", "2026-06-14", "2026-11-04", "2026-12-31",
}


def is_ru_holiday(iso: str) -> bool:
    y = int(iso[:4])
    if y == 2026:
        return iso in RU_HOLIDAYS_2026
    return False


def to_iso(d: date) -> str:
    return d.isoformat()


def calendar_days_in_month(y: int, m: int) -> int:
    if m == 12:
        nxt = date(y + 1, 1, 1)
    else:
        nxt = date(y, m + 1, 1)
    return (nxt - date(y, m, 1)).days


def zup_half_month_length(dim: int) -> int:
    return (dim + 1) // 2


def zup_classify_first_month(hire: date) -> tuple[bool, int]:
    dim0 = calendar_days_in_month(hire.year, hire.month)
    days_worked_tail = dim0 - hire.day + 1
    half = zup_half_month_length(dim0)
    case17_in31 = hire.day == 17 and dim0 == 31
    scrap_target = 16 if case17_in31 else 15
    return days_worked_tail >= half, scrap_target


def zup_count_accruals_case1(hire: date, as_of: date) -> int:
    hd = hire.day
    y, m = hire.year, hire.month
    count = 0
    while True:
        dim_m = calendar_days_in_month(y, m)
        ref_day = 1 if hd == 1 else min(dim_m, hd - 1)
        half = zup_half_month_length(dim_m)
        acc_day = min(dim_m, ref_day + half)
        acc_date = date(y, m, acc_day)
        if hire <= acc_date <= as_of:
            count += 1
        if y == as_of.year and m == as_of.month:
            break
        m += 1
        if m > 12:
            m = 1
            y += 1
    return count


def zup_count_accruals_case2(hire: date, as_of: date, scrap_target: int) -> int:
    dim0 = calendar_days_in_month(hire.year, hire.month)
    base_scrap = dim0 - hire.day + 1
    acc_day_in_month = scrap_target - base_scrap
    if acc_day_in_month < 1:
        return 0
    y, m = hire.year, hire.month + 1
    if m > 12:
        m = 1
        y += 1
    count = 0
    while True:
        dim_m = calendar_days_in_month(y, m)
        day = min(dim_m, acc_day_in_month)
        acc_date = date(y, m, day)
        if acc_date > as_of:
            break
        count += 1
        m += 1
        if m > 12:
            m = 1
            y += 1
        if count > 2400:
            break
    return count


def zup_count_accrual_events(hire_iso: str, as_of: date) -> int:
    hire = date.fromisoformat(hire_iso)
    if hire > as_of:
        return 0
    case1, scrap_target = zup_classify_first_month(hire)
    return (
        zup_count_accruals_case1(hire, as_of)
        if case1
        else zup_count_accruals_case2(hire, as_of, scrap_target)
    )


def accrued_vacation_zup_from_hire(hire_iso: str, as_of: date) -> float:
    n = zup_count_accrual_events(hire_iso, as_of)
    return int(((n * ANNUAL_NORM) / 12) * 10) / 10


def projected_accrued_vacation_to_date(hire_iso: str, target: date, primary_year: int) -> float:
    hire = date.fromisoformat(hire_iso)
    y_start = date(primary_year, 1, 1)
    if target < hire:
        return 0.0
    if target < y_start:
        return accrued_vacation_zup_from_hire(hire_iso, target)
    acc_y = accrued_vacation_zup_from_hire(hire_iso, y_start)
    acc_t = accrued_vacation_zup_from_hire(hire_iso, target)
    return int((acc_y + (acc_t - acc_y)) * 10) / 10


def entitled_vacation_days(
    hire_iso: str, as_of: date, primary_year: int, opening_balance: float | None
) -> float:
    jan1 = date(primary_year, 1, 1)
    accrued_at_jan1 = projected_accrued_vacation_to_date(hire_iso, jan1, primary_year)
    accrued_now = projected_accrued_vacation_to_date(hire_iso, as_of, primary_year)
    base = opening_balance if opening_balance is not None else accrued_at_jan1
    accrual_since_jan1 = max(0.0, accrued_now - accrued_at_jan1)
    return int((base + accrual_since_jan1) * 10) / 10


def count_booked_days(
    emp_name: str,
    hire_iso: str,
    requests: list[dict],
    statuses: set[str],
) -> int:
    hire = date.fromisoformat(hire_iso)
    n = 0
    for r in requests:
        if r["employee"] != emp_name or r["status"] not in statuses:
            continue
        start = date.fromisoformat(r["start"])
        end = date.fromisoformat(r["end"])
        if start > end:
            continue
        from_day = start if start > hire else hire
        cursor = from_day
        while cursor <= end:
            if not is_ru_holiday(to_iso(cursor)):
                n += 1
            cursor += timedelta(days=1)
    return n


def calc_remain(
    emp_name: str,
    hire_iso: str,
    requests: list[dict],
    as_of: date,
    primary_year: int = 2026,
    opening_balance: float | None = None,
) -> float:
    entitled = entitled_vacation_days(hire_iso, as_of, primary_year, opening_balance)
    taken = count_booked_days(emp_name, hire_iso, requests, {"approved"})
    planned = count_booked_days(emp_name, hire_iso, requests, {"pending"})
    return max(0.0, int((entitled - taken - planned) * 10) / 10)
