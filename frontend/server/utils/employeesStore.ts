import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

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

export async function readEmployees(): Promise<ServerEmployee[]> {
  await ensureFile();
  const raw = await readFile(DATA_FILE, 'utf8');
  return JSON.parse(raw) as ServerEmployee[];
}

export async function writeEmployees(list: ServerEmployee[]): Promise<ServerEmployee[]> {
  await ensureFile();
  await writeFile(DATA_FILE, JSON.stringify(list, null, 2), 'utf8');
  return list;
}

export async function findEmployeeByPlatformUserId(userId: number): Promise<ServerEmployee | null> {
  const list = await readEmployees();
  return list.find((e) => e.platform_user_id === userId) ?? null;
}

export async function findEmployeeById(id: number): Promise<ServerEmployee | null> {
  const list = await readEmployees();
  return list.find((e) => e.id === id) ?? null;
}
