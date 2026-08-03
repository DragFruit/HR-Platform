import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { dedupeEmployeeList, employeeIdentityKeys } from '../../app/utils/employeeDedupe';
import {
  mergeQaTestEmployees,
  stripQaTestEmployees
} from '../../app/data/qaTestDepartment';
import type { SessionUser } from './credentials';
import {
  applyManagerAssignments,
  extractManagerAssignments,
  mergeManagerAssignments,
  readManagerAssignments,
  writeManagerAssignments
} from './employeeManagersStore';

export type ServerEmployee = {
  id: number;
  name: string;
  title: string;
  department: string;
  manager: string;
  hired_at: string;
  /** День рождения: `YYYY-MM-DD` или `MM-DD`. */
  birthday?: string | null;
  platform_user_id: number | null;
  bitrix_user_id?: number | null;
  email?: string;
  account_role?: string;
  vacation_opening_balance?: number | null;
};

const DATA_FILE = join(process.cwd(), 'server/data/employees.json');

export const defaultEmployees = (): ServerEmployee[] => [];

async function ensureFile() {
  await mkdir(dirname(DATA_FILE), { recursive: true });
  try {
    await readFile(DATA_FILE, 'utf8');
  } catch {
    await writeFile(DATA_FILE, JSON.stringify(defaultEmployees(), null, 2), 'utf8');
  }
}

export function dedupeEmployees(list: ServerEmployee[]): ServerEmployee[] {
  return dedupeEmployeeList(
    list.map((row) => ({
      ...row,
      bitrix_user_id:
        row.bitrix_user_id ??
        (row.platform_user_id && row.id === row.platform_user_id ? row.id : row.bitrix_user_id ?? null)
    }))
  );
}

export { employeeIdentityKeys };

export async function readEmployees(): Promise<ServerEmployee[]> {
  await ensureFile();
  const raw = await readFile(DATA_FILE, 'utf8');
  const parsed = JSON.parse(raw) as ServerEmployee[];
  const deduped = dedupeEmployees(parsed);
  if (deduped.length !== parsed.length) {
    await writeFile(DATA_FILE, JSON.stringify(deduped, null, 2), 'utf8');
  }
  const assignments = await readManagerAssignments();
  const withManagers = applyManagerAssignments(deduped, assignments);
  return mergeQaTestEmployees(withManagers);
}

export type WriteEmployeesOptions = {
  /** Не обновлять overlay руководителей (синк Bitrix, импорт). */
  preserveManagers?: boolean;
};

export async function writeEmployees(
  list: ServerEmployee[],
  options: WriteEmployeesOptions = {}
): Promise<ServerEmployee[]> {
  await ensureFile();
  const normalized = dedupeEmployees(stripQaTestEmployees(list));
  const currentAssignments = await readManagerAssignments();
  let mergedAssignments = currentAssignments;
  if (!options.preserveManagers) {
    const incomingAssignments = extractManagerAssignments(normalized);
    mergedAssignments = await mergeManagerAssignments(currentAssignments, incomingAssignments);
    await writeManagerAssignments(mergedAssignments);
  }
  const withManagers = applyManagerAssignments(normalized, mergedAssignments);
  await writeFile(DATA_FILE, JSON.stringify(withManagers, null, 2), 'utf8');
  return withManagers;
}

export async function findEmployeeByPlatformUserId(userId: number): Promise<ServerEmployee | null> {
  const list = await readEmployees();
  return list.find((e) => e.platform_user_id === userId) ?? null;
}

const DEMO_HIRED_AT: Record<string, string> = {
  'alina@vbi.local': '2026-06-23',
  'katya@vbi.local': '2026-06-10',
  'vasya@vbi.local': '2026-05-01',
  'masha@vbi.local': '2026-04-15',
  'kostya@vbi.local': '2020-01-10',
  'stas@vbi.local': '2019-01-10'
};

function demoEmployeeFromSession(session: SessionUser): ServerEmployee {
  const email = session.email.toLowerCase();
  return {
    id: session.id,
    name: session.name,
    title: session.role === 'admin' ? 'HR-админ' : session.role === 'manager' ? 'Руководитель' : 'Сотрудник',
    department: session.department,
    manager: session.role === 'manager' ? 'Стас' : 'Костя',
    hired_at: DEMO_HIRED_AT[email] ?? '2026-06-01',
    platform_user_id: session.id,
    email: session.email,
    account_role: session.role
  };
}

/** Сотрудник для API адаптации: справочник, email или демо-профиль. */
export async function findEmployeeForSession(session: SessionUser): Promise<ServerEmployee | null> {
  const list = await readEmployees();
  const byPlatformId = list.find((e) => e.platform_user_id === session.id);
  if (byPlatformId) return byPlatformId;

  const email = session.email.trim().toLowerCase();
  if (email) {
    const byEmail = list.find((e) => e.email?.trim().toLowerCase() === email);
    if (byEmail) return byEmail;
  }

  if (session.auth_source === 'demo') {
    return demoEmployeeFromSession(session);
  }

  return null;
}

export async function findEmployeeById(id: number): Promise<ServerEmployee | null> {
  const list = await readEmployees();
  return list.find((e) => e.id === id) ?? null;
}

export async function findEmployeeByName(name: string): Promise<ServerEmployee | null> {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return null;
  const list = await readEmployees();
  return list.find((e) => e.name.trim().toLowerCase() === normalized) ?? null;
}

/** id для user-notifications: Bitrix/platform id, иначе id из справочника. */
export function employeeNotificationUserId(employee: ServerEmployee): number | null {
  const uid = employee.platform_user_id ?? employee.bitrix_user_id ?? employee.id;
  return uid > 0 ? uid : null;
}
