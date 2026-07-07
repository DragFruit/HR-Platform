#!/usr/bin/env node
/**
 * Аудит блока «График отпусков»: данные + логические проверки.
 * Пишет NDJSON в .cursor/debug-68c1a3.log
 */
import { readFile, appendFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOG = join(ROOT, '.cursor/debug-68c1a3.log');
const SESSION = '68c1a3';

const log = async (hypothesisId, message, data = {}) => {
  const line = JSON.stringify({
    sessionId: SESSION,
    hypothesisId,
    location: 'scripts/audit-vacations-block.mjs',
    message,
    data,
    timestamp: Date.now(),
    runId: 'audit-static'
  });
  await appendFile(LOG, line + '\n');
};

const RU_HOLIDAYS_2026 = new Set([
  '2026-01-01', '2026-01-02', '2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09',
  '2026-02-21', '2026-02-22', '2026-02-23', '2026-03-07', '2026-03-08', '2026-03-09',
  '2026-05-01', '2026-05-02', '2026-05-03', '2026-05-09', '2026-05-10', '2026-05-11',
  '2026-06-12', '2026-06-13', '2026-06-14', '2026-11-04', '2026-12-31'
]);

const isRuHoliday = (iso) => {
  const y = Number(iso.slice(0, 4));
  if (y !== 2026) return false;
  return RU_HOLIDAYS_2026.has(iso);
};

const employees = JSON.parse(await readFile(join(ROOT, 'frontend/server/data/employees.json'), 'utf8'));
const vacations = JSON.parse(await readFile(join(ROOT, 'frontend/server/data/vacations.json'), 'utf8'));

// Overlay руководителей (на сервере после админки; локально может отсутствовать — в .gitignore)
const overlayPath = join(ROOT, 'frontend/server/data/employee-managers.json');
let overlay = { byId: {}, byName: {} };
try {
  overlay = JSON.parse(await readFile(overlayPath, 'utf8'));
} catch {
  await log('H2', 'no local employee-managers.json — manager audit uses seed only; production may differ', {});
}

const normName = (s) =>
  String(s || '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ');

const effectiveManager = (emp) => {
  const fromId = overlay.byId?.[String(emp.id)];
  if (fromId?.trim()) return fromId.trim();
  const fromName = overlay.byName?.[normName(emp.name)];
  if (fromName?.trim()) return fromName.trim();
  return String(emp.manager || '').trim();
};

const employeesEffective = employees.map((e) => ({ ...e, manager: effectiveManager(e) }));

const empNames = new Set(employeesEffective.map((e) => e.name?.trim()).filter(Boolean));
const empByName = Object.fromEntries(employeesEffective.map((e) => [e.name?.trim(), e]));

// H2: employees without manager (effective, with overlay)
const noManager = employeesEffective.filter((e) => !(e.manager || '').trim());
await log('H2', 'employees without manager (effective)', {
  count: noManager.length,
  names: noManager.map((e) => e.name),
  hasOverlay: Boolean(Object.keys(overlay.byId || {}).length)
});

// Seed-only self-managers (legacy Bitrix — не использовать для выводов о production)
const seedSelfManagers = employees.filter(
  (e) => (e.manager || '').trim() === (e.name || '').trim() && (e.name || '').trim()
);
await log('H2-seed', 'self-manager in seed file only (ignored if overlay set on server)', {
  count: seedSelfManagers.length,
  names: seedSelfManagers.map((e) => e.name)
});

// H5: request year bucket vs start year
const yearMismatches = [];
for (const [yearKey, list] of Object.entries(vacations.requestsByYear || {})) {
  for (const r of list) {
    const sy = (r.start || '').slice(0, 4);
    if (sy && sy !== yearKey) {
      yearMismatches.push({ id: r.id, employee: r.employee, bucket: yearKey, startYear: sy });
    }
    if (!empNames.has((r.employee || '').trim())) {
      await log('H3', 'orphan vacation request', { id: r.id, employee: r.employee, yearKey });
    }
    if (r.start > r.end) {
      await log('H3', 'invalid date range', { id: r.id, employee: r.employee, start: r.start, end: r.end });
    }
  }
}
await log('H5', 'year bucket mismatches', { count: yearMismatches.length, samples: yearMismatches.slice(0, 5) });

// H4: holidays only 2026
const non2026Starts = new Set();
for (const list of Object.values(vacations.requestsByYear || {})) {
  for (const r of list) {
    const y = Number((r.start || '').slice(0, 4));
    if (y && y !== 2026) non2026Starts.add(y);
  }
}
await log('H4', 'vacation years outside holiday calendar', { years: [...non2026Starts] });

// H1: primaryYear consistency
await log('H1', 'vacation state years', {
  primaryYear: vacations.primaryYear,
  viewYears: Object.keys(vacations.requestsByYear || {}),
  note: 'UI uses viewYear for balance.remain but primaryYear for advance assessment'
});

// H2: pending requests with no approver path
const managers = new Set(employees.map((e) => (e.manager || '').trim()).filter(Boolean));
const pendingNoRoute = [];
for (const [yearKey, list] of Object.entries(vacations.requestsByYear || {})) {
  for (const r of list) {
    if (r.status !== 'pending') continue;
    const emp = empByName[r.employee?.trim()];
    if (!emp) continue;
    const mgr = (emp.manager || '').trim();
    if (!mgr) pendingNoRoute.push({ id: r.id, employee: r.employee, yearKey });
    else if (!empNames.has(mgr)) pendingNoRoute.push({ id: r.id, employee: r.employee, badManager: mgr });
  }
}
await log('H2', 'pending requests without manager route', {
  count: pendingNoRoute.length,
  items: pendingNoRoute
});

// H6: manager name exact match for approval (effective)
const managerMismatches = employeesEffective.filter((e) => {
  const m = (e.manager || '').trim();
  return m && !empNames.has(m);
});
await log('H6', 'manager name not in employee roster (effective)', { count: managerMismatches.length });

// Summary counts
const allReqs = Object.values(vacations.requestsByYear || {}).flat();
await log('SUMMARY', 'audit complete', {
  employees: employees.length,
  requests: allReqs.length,
  pending: allReqs.filter((r) => r.status === 'pending').length,
  approved: allReqs.filter((r) => r.status === 'approved').length,
  noManagerEmployees: noManager.length
});

console.log('Audit written to', LOG);
