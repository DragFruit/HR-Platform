import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { writeJsonAtomic } from '../utils/atomicJson';
import type { ServerEmployee } from '../utils/employeesStore';
import type { ManagerAssignments } from '../utils/employeeManagersStore';
import type { OrgStructureState } from '../utils/orgStructureStore';
import type { CoreRepo } from './types';

export const EMPLOYEES_JSON_FILE = join(process.cwd(), 'server/data/employees.json');
export const MANAGERS_JSON_FILE = join(process.cwd(), 'server/data/employee-managers.json');
export const ORG_STRUCTURE_JSON_FILE = join(process.cwd(), 'server/data/org-structure.json');

export type CoreJsonFiles = { employees: string; managers: string; org: string };

export const defaultCoreJsonFiles = (): CoreJsonFiles => ({
  employees: EMPLOYEES_JSON_FILE,
  managers: MANAGERS_JSON_FILE,
  org: ORG_STRUCTURE_JSON_FILE
});

async function readJsonOrInit<T>(file: string, init: () => T): Promise<T> {
  await mkdir(dirname(file), { recursive: true });
  let raw: string;
  try {
    raw = await readFile(file, 'utf8');
  } catch {
    const value = init();
    await writeJsonAtomic(file, value);
    return value;
  }
  return JSON.parse(raw) as T;
}

export async function readEmployeesJson(file: string): Promise<ServerEmployee[]> {
  const parsed = await readJsonOrInit<unknown>(file, () => []);
  return Array.isArray(parsed) ? (parsed as ServerEmployee[]) : [];
}

export async function readManagerAssignmentsJson(file: string): Promise<ManagerAssignments> {
  try {
    const parsed = await readJsonOrInit<Partial<ManagerAssignments>>(file, () => ({ byId: {}, byName: {} }));
    return {
      byId: parsed?.byId && typeof parsed.byId === 'object' ? parsed.byId : {},
      byName: parsed?.byName && typeof parsed.byName === 'object' ? parsed.byName : {}
    };
  } catch {
    return { byId: {}, byName: {} };
  }
}

export async function readOrgStructureJson(file: string): Promise<Partial<OrgStructureState>> {
  const parsed = await readJsonOrInit<Partial<OrgStructureState>>(file, () => ({
    executives: [],
    units: [],
    groups: [],
    links: []
  }));
  return parsed && typeof parsed === 'object' ? parsed : {};
}

/** Файлы server/data/*.json — поведение до этапа 3 (прод и локалка). */
export function createJsonCoreRepo(files: CoreJsonFiles = defaultCoreJsonFiles()): CoreRepo {
  return {
    backend: 'json',
    readEmployeesRaw: () => readEmployeesJson(files.employees),
    writeEmployeesRaw: (list) => writeJsonAtomic(files.employees, list),
    readManagerAssignmentsRaw: () => readManagerAssignmentsJson(files.managers),
    writeManagerAssignmentsRaw: (assignments) => writeJsonAtomic(files.managers, assignments),
    readOrgStructureRaw: () => readOrgStructureJson(files.org),
    writeOrgStructureRaw: (state) => writeJsonAtomic(files.org, state)
  };
}
