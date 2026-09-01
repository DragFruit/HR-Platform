#!/usr/bin/env node
/**
 * Слияние employees.json при деплое на production/staging.
 * Production — рабочее пространство: данные с сервера сохраняются.
 *
 * - Сотрудник только на сервере (добавлен в админке) → остаётся
 * - Сотрудник только в репозитории (новый из импорта) → добавляется,
 *   **если его нет в employee-access-denylist** (удалённые не воскресают)
 * - Есть и там и там → поля с сервера, руководитель из overlay
 *
 * Usage: node merge-employees-seed.mjs <target.json> <incoming.json> <managers.json> [denylist.json]
 */
import { readFile, writeFile } from 'node:fs/promises';

const [targetPath, incomingPath, managersPath, denylistPath] = process.argv.slice(2);
if (!targetPath || !incomingPath || !managersPath) {
  console.error(
    'Usage: merge-employees-seed.mjs <target> <incoming> <managers> [denylist]'
  );
  process.exit(1);
}

function normalizeName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ');
}

function normEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

function emptyAssignments() {
  return { byId: {}, byName: {} };
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return fallback;
  }
}

function isDenied(emp, entries) {
  if (!entries.length) return false;
  const bitrixId = Number(emp.bitrix_user_id ?? emp.platform_user_id ?? 0);
  const email = normEmail(emp.email);
  const nameKey = normalizeName(emp.name);
  return entries.some((row) => {
    if (emp.id && Number(row.employee_id) === Number(emp.id)) return true;
    if (bitrixId > 0 && Number(row.bitrix_user_id) === bitrixId) return true;
    if (bitrixId > 0 && Number(row.platform_user_id) === bitrixId) return true;
    if (email && normEmail(row.email) === email) return true;
    if (nameKey && normalizeName(row.name) === nameKey) return true;
    return false;
  });
}

const target = await readJson(targetPath, []);
const incoming = await readJson(incomingPath, []);
const overlay = await readJson(managersPath, emptyAssignments());
const denylistRaw = denylistPath ? await readJson(denylistPath, { entries: [] }) : { entries: [] };
const denylist = Array.isArray(denylistRaw?.entries) ? denylistRaw.entries : [];

const byId = overlay.byId && typeof overlay.byId === 'object' ? overlay.byId : {};
const byName = overlay.byName && typeof overlay.byName === 'object' ? overlay.byName : {};

const serverList = Array.isArray(target) ? target : [];
const incomingList = Array.isArray(incoming) ? incoming : [];

const serverById = new Map(serverList.map((emp) => [Number(emp.id), emp]));
const incomingById = new Map(incomingList.map((emp) => [Number(emp.id), emp]));

const remoteManagers = new Map(
  serverList.map((emp) => [Number(emp.id), String(emp.manager || '').trim()])
);

function resolveManager(emp) {
  const id = String(emp.id);
  const nameKey = normalizeName(emp.name);
  if (byId[id]?.trim()) return byId[id].trim();
  if (byName[nameKey]?.trim()) return byName[nameKey].trim();
  const remote = remoteManagers.get(Number(emp.id));
  if (remote) return remote;
  return String(emp.manager || '').trim();
}

const allIds = [...new Set([...serverById.keys(), ...incomingById.keys()])].sort((a, b) => a - b);

let keptFromServerOnly = 0;
let addedFromRepoOnly = 0;
let mergedBoth = 0;
let skippedDenied = 0;

const merged = [];
for (const id of allIds) {
  const serverEmp = serverById.get(id);
  const incomingEmp = incomingById.get(id);
  const candidate = serverEmp && incomingEmp
    ? { ...incomingEmp, ...serverEmp }
    : { ...(serverEmp ?? incomingEmp) };

  if (isDenied(candidate, denylist)) {
    skippedDenied += 1;
    continue;
  }

  if (serverEmp && incomingEmp) {
    mergedBoth += 1;
  } else if (serverEmp) {
    keptFromServerOnly += 1;
  } else {
    addedFromRepoOnly += 1;
  }

  merged.push({
    ...candidate,
    manager: resolveManager(candidate)
  });
}

const nextOverlay = emptyAssignments();
for (const emp of merged) {
  const manager = String(emp.manager || '').trim();
  if (!manager) continue;
  nextOverlay.byId[String(emp.id)] = manager;
  const nameKey = normalizeName(emp.name);
  if (nameKey) nextOverlay.byName[nameKey] = manager;
}

await writeFile(targetPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
await writeFile(managersPath, `${JSON.stringify(nextOverlay, null, 2)}\n`, 'utf8');

console.log(
  `merged ${merged.length} employees (server ${serverList.length}, repo ${incomingList.length}; ` +
    `both ${mergedBoth}, +${keptFromServerOnly} server-only, +${addedFromRepoOnly} repo-only` +
    (skippedDenied ? `, skipped denylist ${skippedDenied}` : '') +
    `); managers preserved: ${Object.keys(nextOverlay.byId).length}`
);
