#!/usr/bin/env node
/**
 * Проставляет employee_id в заявках/бронях vacations.json по ФИО из employees.json.
 * Usage: node scripts/backfill-vacation-employee-ids.mjs [vacations.json] [employees.json]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const vacPath = resolve(process.argv[2] || join(root, 'frontend/server/data/vacations.json'));
const empPath = resolve(process.argv[3] || join(root, 'frontend/server/data/employees.json'));

const norm = (n) =>
  String(n || '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ');
const short = (n) => {
  const parts = String(n || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return parts.length >= 3 ? `${parts[0]} ${parts[1]}` : parts.join(' ');
};

const emps = JSON.parse(readFileSync(empPath, 'utf8'));
const byExact = new Map();
const byShort = new Map();
for (const e of emps) {
  const name = String(e.name || '').trim();
  if (!name || !e.id) continue;
  byExact.set(norm(name), e);
  byShort.set(norm(short(name)), e);
}

const resolveEmp = (name) => {
  const n = String(name || '').trim();
  if (!n) return null;
  return byExact.get(norm(n)) || byShort.get(norm(short(n))) || byShort.get(norm(n)) || null;
};

const vac = JSON.parse(readFileSync(vacPath, 'utf8'));
let reqUpdated = 0;
let resUpdated = 0;
let unresolved = [];

for (const rows of Object.values(vac.requestsByYear || {})) {
  for (const r of rows) {
    const emp = resolveEmp(r.employee);
    if (!emp) {
      unresolved.push(['req', r.id, r.employee]);
      continue;
    }
    const nextId = emp.id;
    const nextName = emp.name.trim();
    if (r.employee_id !== nextId || r.employee !== nextName) {
      r.employee_id = nextId;
      r.employee = nextName;
      reqUpdated += 1;
    }
  }
}

for (const rows of Object.values(vac.reservationsByYear || {})) {
  for (const r of rows) {
    const emp = resolveEmp(r.employee);
    if (!emp) {
      unresolved.push(['res', r.id, r.employee]);
      continue;
    }
    const nextId = emp.id;
    const nextName = emp.name.trim();
    if (r.employee_id !== nextId || r.employee !== nextName) {
      r.employee_id = nextId;
      r.employee = nextName;
      resUpdated += 1;
    }
  }
}

writeFileSync(vacPath, `${JSON.stringify(vac, null, 2)}\n`);
console.log({ vacPath, empPath, reqUpdated, resUpdated, unresolved });
