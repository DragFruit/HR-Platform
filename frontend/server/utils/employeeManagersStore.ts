import { readFile, mkdir } from 'node:fs/promises';
import { writeJsonAtomic } from './atomicJson';
import { dirname, join } from 'node:path';
import type { ServerEmployee } from './employeesStore';
import { ensureEmployeeManagerIds } from '../../app/utils/employeeManagerRef';

export type ManagerAssignments = {
  byId: Record<string, string>;
  byName: Record<string, string>;
};

const MANAGERS_FILE = join(process.cwd(), 'server/data/employee-managers.json');

const emptyAssignments = (): ManagerAssignments => ({ byId: {}, byName: {} });

export function normalizeManagerNameKey(name: string): string {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ');
}

async function ensureManagersFile() {
  await mkdir(dirname(MANAGERS_FILE), { recursive: true });
  try {
    await readFile(MANAGERS_FILE, 'utf8');
  } catch {
    await writeJsonAtomic(MANAGERS_FILE, emptyAssignments());
  }
}

export async function readManagerAssignments(): Promise<ManagerAssignments> {
  await ensureManagersFile();
  try {
    const raw = await readFile(MANAGERS_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<ManagerAssignments>;
    return {
      byId: parsed.byId && typeof parsed.byId === 'object' ? parsed.byId : {},
      byName: parsed.byName && typeof parsed.byName === 'object' ? parsed.byName : {}
    };
  } catch {
    return emptyAssignments();
  }
}

export async function writeManagerAssignments(assignments: ManagerAssignments): Promise<void> {
  await ensureManagersFile();
  const normalized: ManagerAssignments = { byId: {}, byName: {} };
  for (const [id, manager] of Object.entries(assignments.byId)) {
    const value = String(manager || '').trim();
    if (value) normalized.byId[id] = value;
  }
  for (const [name, manager] of Object.entries(assignments.byName)) {
    const key = normalizeManagerNameKey(name);
    const value = String(manager || '').trim();
    if (key && value) normalized.byName[key] = value;
  }
  await writeJsonAtomic(MANAGERS_FILE, normalized);
}

export function extractManagerAssignments(list: ServerEmployee[]): ManagerAssignments {
  const assignments = emptyAssignments();
  for (const emp of list) {
    const manager = String(emp.manager || '').trim();
    if (!manager) continue;
    assignments.byId[String(emp.id)] = manager;
    const nameKey = normalizeManagerNameKey(emp.name);
    if (nameKey) assignments.byName[nameKey] = manager;
  }
  return assignments;
}

export function resolveEmployeeManager(
  emp: Pick<ServerEmployee, 'id' | 'name' | 'manager'>,
  assignments: ManagerAssignments,
  fallbackManager?: string
): string {
  const fromId = assignments.byId[String(emp.id)];
  if (fromId?.trim()) return fromId.trim();

  const fromName = assignments.byName[normalizeManagerNameKey(emp.name)];
  if (fromName?.trim()) return fromName.trim();

  const fallback = String(fallbackManager ?? emp.manager ?? '').trim();
  return fallback;
}

export function applyManagerAssignments(
  list: ServerEmployee[],
  assignments: ManagerAssignments,
  fallbackById?: Map<number, string>
): ServerEmployee[] {
  return ensureEmployeeManagerIds(
    list.map((emp) => ({
      ...emp,
      manager: resolveEmployeeManager(
        emp,
        assignments,
        fallbackById?.get(emp.id) ?? emp.manager
      )
    }))
  );
}

export async function mergeManagerAssignments(
  current: ManagerAssignments,
  incoming: ManagerAssignments
): Promise<ManagerAssignments> {
  return {
    byId: { ...current.byId, ...incoming.byId },
    byName: { ...current.byName, ...incoming.byName }
  };
}
