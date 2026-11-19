#!/usr/bin/env node
/**
 * Read-only отчёт: заявки pending/approved, у которых начало или конец приходится на праздник РФ
 * (по производственному календарю платформы). Такие края в отпуск не входят: новые заявки
 * сервер обрезает сам, заявление для старых тоже формируется обрезанным. Данные НЕ меняет.
 *
 * Праздники берутся из frontend/app/utils/vacationCalendar.ts (RU_PROD_CAL_OFF_BY_YEAR),
 * чтобы список был один и тот же, что для подсчёта дней.
 *
 * Usage:
 *   node scripts/report-vacation-holiday-edges.mjs [vacations.json] [--json]
 * По умолчанию читает frontend/server/data/vacations.json.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const asJson = args.includes('--json');
const fileArg = args.find((a) => !a.startsWith('--'));
const vacPath = resolve(fileArg || join(root, 'frontend/server/data/vacations.json'));
const calendarPath = join(root, 'frontend/app/utils/vacationCalendar.ts');

const loadHolidays = () => {
  const src = readFileSync(calendarPath, 'utf8');
  const m = src.match(/RU_PROD_CAL_OFF_BY_YEAR[^=]*=\s*\{([\s\S]*?)\n\};/);
  if (!m) throw new Error(`Не нашёл RU_PROD_CAL_OFF_BY_YEAR в ${calendarPath}`);
  return new Set(m[1].match(/\d{4}-\d{2}-\d{2}/g) || []);
};

const holidays = loadHolidays();
const isHoliday = (iso) => holidays.has(String(iso || '').slice(0, 10));

const shift = (iso, delta) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
};

/** Та же логика, что trimVacationHolidayEdges в vacationCalendar.ts. */
const trim = (start, end) => {
  let s = start;
  while (s <= end && isHoliday(s)) s = shift(s, 1);
  if (s > end) return null;
  let e = end;
  while (e > s && isHoliday(e)) e = shift(e, -1);
  return { start: s, end: e };
};

const vac = JSON.parse(readFileSync(vacPath, 'utf8'));
const rows = [];
for (const list of Object.values(vac.requestsByYear || {})) {
  for (const r of list || []) {
    if (r.status !== 'pending' && r.status !== 'approved') continue;
    if (!r.start || !r.end) continue;
    if (!isHoliday(r.start) && !isHoliday(r.end)) continue;
    const t = trim(r.start, r.end);
    rows.push({
      id: r.id,
      employee: r.employee,
      status: r.status,
      start: r.start,
      end: r.end,
      suggested_start: t?.start ?? null,
      suggested_end: t?.end ?? null,
      only_holidays: !t,
      bitrix_absence_id: r.bitrix_absence_id ?? null
    });
  }
}
rows.sort((a, b) => a.start.localeCompare(b.start) || a.id - b.id);

if (asJson) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  console.log(`Файл: ${vacPath}`);
  console.log(`Праздников в календаре: ${holidays.size}`);
  console.log(`Заявок pending/approved с праздником на краю: ${rows.length}`);
  for (const r of rows) {
    const fix = r.only_holidays
      ? 'все дни праздники'
      : `→ ${r.suggested_start}…${r.suggested_end}`;
    const bx = r.bitrix_absence_id ? ` bitrix#${r.bitrix_absence_id}` : '';
    console.log(`#${r.id} ${r.status} ${r.employee}: ${r.start}…${r.end} ${fix}${bx}`);
  }
}
