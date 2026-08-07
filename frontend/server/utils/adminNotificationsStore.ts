import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

export type AdminNotificationKind =
  | 'bitrix_employee_name'
  | 'bitrix_employee_title'
  | 'bitrix_vacation_sync_failed'
  | 'tenure_gift_order'
  | 'idea_submitted'
  | 'vpn_peer_delete_failed';

export type AdminNotification = {
  id: string;
  kind: AdminNotificationKind;
  employee_id: number;
  employee_name: string;
  created_at: string;
  admin_seen: boolean;
  /** Bitrix field sync */
  bitrix_user_id?: number;
  field?: 'name' | 'title';
  platform_value?: string;
  bitrix_value?: string;
  /** Юбилейный набор */
  years?: number;
  sku?: string;
  order_id?: string;
  /** Банк идей */
  idea_id?: string;
  idea_title?: string;
  /** Синк отпуска в Bitrix */
  vacation_request_id?: number;
  vacation_start?: string;
  vacation_end?: string;
  error_message?: string;
  /** VPN офбординг */
  vpn_peer_names?: string[];
  vpn_panel?: string;
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
      (item.kind === 'bitrix_employee_name' || item.kind === 'bitrix_employee_title') &&
      item.employee_id === input.employee_id &&
      item.field === input.field &&
      normalizeComparable(item.bitrix_value || '') === bitrix
  );
  if (existing) return existing;

  const stale = state.items.findIndex(
    (item) =>
      !item.admin_seen &&
      (item.kind === 'bitrix_employee_name' || item.kind === 'bitrix_employee_title') &&
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

export async function createTenureGiftOrderNotification(input: {
  employee_id: number;
  employee_name: string;
  years: number;
  sku: string;
  order_id: string;
}): Promise<AdminNotification> {
  const state = await readState();

  const existing = state.items.find(
    (item) =>
      !item.admin_seen &&
      item.kind === 'tenure_gift_order' &&
      item.order_id === input.order_id
  );
  if (existing) return existing;

  const notification: AdminNotification = {
    id: randomUUID(),
    kind: 'tenure_gift_order',
    employee_id: input.employee_id,
    employee_name: input.employee_name,
    years: input.years,
    sku: input.sku,
    order_id: input.order_id,
    created_at: new Date().toISOString(),
    admin_seen: false
  };
  state.items.push(notification);
  await writeState(state);
  return notification;
}

export async function createIdeaSubmittedNotification(input: {
  employee_id: number;
  employee_name: string;
  idea_id: string;
  idea_title: string;
}): Promise<AdminNotification> {
  const state = await readState();

  const existing = state.items.find(
    (item) =>
      !item.admin_seen &&
      item.kind === 'idea_submitted' &&
      item.idea_id === input.idea_id
  );
  if (existing) return existing;

  const notification: AdminNotification = {
    id: randomUUID(),
    kind: 'idea_submitted',
    employee_id: input.employee_id,
    employee_name: input.employee_name,
    idea_id: input.idea_id,
    idea_title: input.idea_title,
    created_at: new Date().toISOString(),
    admin_seen: false
  };
  state.items.push(notification);
  await writeState(state);
  return notification;
}

export async function createBitrixVacationSyncFailedNotification(input: {
  employee_id: number;
  employee_name: string;
  bitrix_user_id?: number;
  request_id: number;
  start: string;
  end: string;
  error: string;
}): Promise<AdminNotification> {
  const state = await readState();

  const existing = state.items.find(
    (item) =>
      !item.admin_seen &&
      item.kind === 'bitrix_vacation_sync_failed' &&
      item.vacation_request_id === input.request_id
  );
  if (existing) {
    existing.error_message = input.error;
    existing.vacation_start = input.start;
    existing.vacation_end = input.end;
    existing.created_at = new Date().toISOString();
    await writeState(state);
    return existing;
  }

  const notification: AdminNotification = {
    id: randomUUID(),
    kind: 'bitrix_vacation_sync_failed',
    employee_id: input.employee_id,
    employee_name: input.employee_name,
    bitrix_user_id: input.bitrix_user_id,
    vacation_request_id: input.request_id,
    vacation_start: input.start,
    vacation_end: input.end,
    error_message: input.error,
    created_at: new Date().toISOString(),
    admin_seen: false
  };
  state.items.push(notification);
  await writeState(state);
  return notification;
}

export async function createVpnPeerDeleteFailedNotification(input: {
  employee_id: number;
  employee_name: string;
  peer_names: string[];
  panel?: string;
  error: string;
}): Promise<AdminNotification> {
  const state = await readState();
  const peers = input.peer_names.map((n) => n.trim()).filter(Boolean);
  const notification: AdminNotification = {
    id: randomUUID(),
    kind: 'vpn_peer_delete_failed',
    employee_id: input.employee_id,
    employee_name: input.employee_name,
    vpn_peer_names: peers,
    vpn_panel: input.panel,
    error_message: input.error,
    created_at: new Date().toISOString(),
    admin_seen: false
  };
  state.items.push(notification);
  await writeState(state);
  return notification;
}

export { normalizeComparable as normalizeNotificationText };
