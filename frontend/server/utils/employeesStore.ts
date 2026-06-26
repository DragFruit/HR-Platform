import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { dedupeEmployeeList, employeeIdentityKeys } from '../../app/utils/employeeDedupe';

export type ServerEmployee = {
  id: number;
  name: string;
  title: string;
  department: string;
  manager: string;
  hired_at: string;
  platform_user_id: number | null;
  bitrix_user_id?: number | null;
  email?: string;
  account_role?: string;
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
  return deduped;
}

export async function writeEmployees(list: ServerEmployee[]): Promise<ServerEmployee[]> {
  await ensureFile();
  const normalized = dedupeEmployees(list);
  await writeFile(DATA_FILE, JSON.stringify(normalized, null, 2), 'utf8');
  return normalized;
}

export async function findEmployeeByPlatformUserId(userId: number): Promise<ServerEmployee | null> {
  const list = await readEmployees();
  return list.find((e) => e.platform_user_id === userId) ?? null;
}

export async function findEmployeeById(id: number): Promise<ServerEmployee | null> {
  const list = await readEmployees();
  return list.find((e) => e.id === id) ?? null;
}
