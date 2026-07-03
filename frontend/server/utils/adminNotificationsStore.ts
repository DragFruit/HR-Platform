import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

export type AdminNotificationKind = 'bitrix_employee_name' | 'bitrix_employee_title';

export type AdminNotification = {
  id: string;
  kind: AdminNotificationKind;
  employee_id: number;
  bitrix_user_id: number;
  employee_name: string;
  field: 'name' | 'title';
  platform_value: string;
  bitrix_value: string;
  created_at: string;
  admin_seen: boolean;
};

type NotificationsState = {
  items: AdminNotification[];
};

const DATA_FILE = join(process.cwd(), 'server/data/admin-notifications.json');

const emptyState = (): NotificationsState => ({ items: [] });

function normalizeComparable(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ');
}

async function ensureFile() {
  await mkdir(dirname(DATA_FILE), { recursive: true });
  try {
    await readFile(DATA_FILE, 'utf8');
  } catch {
    await writeFile(DATA_FILE, JSON.stringify(emptyState(), null, 2) + '\n', 'utf8');
  }
}

async function readState(): Promise<NotificationsState> {
  await ensureFile();
  try {
    const raw = await readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<NotificationsState>;
    return { items: Array.isArray(parsed.items) ? parsed.items : [] };
  } catch {
    return emptyState();
  }
}

async function writeState(state: NotificationsState): Promise<void> {
  await ensureFile();
  await writeFile(DATA_FILE, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

export async function listAdminNotifications(filters?: {
  unseen?: boolean;
}): Promise<AdminNotification[]> {
  const state = await readState();
  let list = [...state.items].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  if (filters?.unseen) {
    list = list.filter((item) => !item.admin_seen);
  }
  return list;
}

export async function countUnseenAdminNotifications(): Promise<number> {
  const state = await readState();
  return state.items.filter((item) => !item.admin_seen).length;
}

export async function markAdminNotificationSeen(id: string): Promise<AdminNotification | null> {
  const state = await readState();
  const item = state.items.find((row) => row.id === id);
  if (!item) return null;
  item.admin_seen = true;
  await writeState(state);
  return item;
}

export async function markAllAdminNotificationsSeen(): Promise<number> {
  const state = await readState();
  let changed = 0;
  for (const item of state.items) {
    if (!item.admin_seen) {
      item.admin_seen = true;
      changed += 1;
    }
  }
  if (changed) await writeState(state);
  return changed;
}

export async function upsertBitrixFieldNotification(input: {
  employee_id: number;
  bitrix_user_id: number;
  employee_name: string;
  field: 'name' | 'title';
  platform_value: string;
  bitrix_value: string;
}): Promise<AdminNotification | null> {
  const platform = normalizeComparable(input.platform_value);
  const bitrix = normalizeComparable(input.bitrix_value);
  if (platform === bitrix) return null;

  const state = await readState();
  const kind: AdminNotificationKind =
    input.field === 'name' ? 'bitrix_employee_name' : 'bitrix_employee_title';

  const existing = state.items.find(
    (item) =>
      !item.admin_seen &&
      item.employee_id === input.employee_id &&
      item.field === input.field &&
      normalizeComparable(item.bitrix_value) === bitrix
  );
  if (existing) return existing;

  const stale = state.items.findIndex(
    (item) =>
      !item.admin_seen &&
      item.employee_id === input.employee_id &&
      item.field === input.field
  );
  if (stale >= 0) {
    state.items.splice(stale, 1);
  }

  const notification: AdminNotification = {
    id: randomUUID(),
    kind,
    employee_id: input.employee_id,
    bitrix_user_id: input.bitrix_user_id,
    employee_name: input.employee_name,
    field: input.field,
    platform_value: input.platform_value,
    bitrix_value: input.bitrix_value,
    created_at: new Date().toISOString(),
    admin_seen: false
  };
  state.items.push(notification);
  await writeState(state);
  return notification;
}

export { normalizeComparable as normalizeNotificationText };
