#!/usr/bin/env node
/**
 * Слияние employees.json при деплое на production/staging.
 * Production — рабочее пространство: данные с сервера сохраняются.
 *
 * - Сотрудник только на сервере (добавлен в админке) → остаётся
 * - Сотрудник только в репозитории (новый из импорта) → добавляется
 * - Есть и там и там → поля с сервера, руководитель из overlay
 *
 * Usage: node merge-employees-seed.mjs <target.json> <incoming.json> <managers.json>
 */
import { readFile, writeFile } from 'node:fs/promises';

const [targetPath, incomingPath, managersPath] = process.argv.slice(2);
if (!targetPath || !incomingPath || !managersPath) {
  console.error('Usage: merge-employees-seed.mjs <target> <incoming> <managers>');
  process.exit(1);
}

function normalizeName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ');
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

const target = await readJson(targetPath, []);
const incoming = await readJson(incomingPath, []);
const overlay = await readJson(managersPath, emptyAssignments());
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

const merged = allIds.map((id) => {
  const serverEmp = serverById.get(id);
  const incomingEmp = incomingById.get(id);

  if (serverEmp && incomingEmp) {
    mergedBoth += 1;
  } else if (serverEmp) {
    keptFromServerOnly += 1;
  } else {
    addedFromRepoOnly += 1;
  }

  const base = serverEmp ?? incomingEmp;
  const record =
    serverEmp && incomingEmp ? { ...incomingEmp, ...serverEmp } : { ...base };

  return {
    ...record,
    manager: resolveManager(record)
  };
});

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
    `both ${mergedBoth}, +${keptFromServerOnly} server-only, +${addedFromRepoOnly} repo-only); ` +
    `managers preserved: ${Object.keys(nextOverlay.byId).length}`
);
