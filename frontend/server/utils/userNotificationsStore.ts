import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

export type UserNotificationKind =
  | 'vacation_submitted'
  | 'vacation_updated'
  | 'vacation_deleted'
  | 'vacation_approved'
  | 'vacation_rejected'
  | 'vacation_next_stage'
  | 'vacation_reservation_updated'
  | 'vacation_reservation_expiring'
  | 'vacation_reservation_expiring_manager'
  | 'idea_status_changed';

export type UserNotification = {
  id: string;
  kind: UserNotificationKind;
  recipient_user_id: number;
  /** Для уведомлений по отпускам; для идей может отсутствовать */
  vacation_request_id?: number;
  employee_name: string;
  start?: string;
  end?: string;
  /** Подпись этапа (отпуска / статус идеи) */
  stage_label?: string;
  idea_id?: string;
  idea_title?: string;
  status_comment?: string;
  created_at: string;
  seen: boolean;
  /** Скрыто из выпадающего колокольчика; остаётся на /notifications */
  hidden_from_bell?: boolean;
};

type NotificationsState = {
  items: UserNotification[];
};

/** Максимум уведомлений на одного получателя; при превышении удаляются самые старые. */
export const USER_NOTIFICATIONS_MAX_PER_RECIPIENT = 100;

const DATA_FILE = join(process.cwd(), 'server/data/user-notifications.json');

const emptyState = (): NotificationsState => ({ items: [] });

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

const trimRecipientToMax = (state: NotificationsState, recipientUserId: number) => {
  const owned = state.items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.recipient_user_id === recipientUserId)
    .sort(
      (a, b) =>
        new Date(a.item.created_at).getTime() - new Date(b.item.created_at).getTime()
    );

  const overflow = owned.length - USER_NOTIFICATIONS_MAX_PER_RECIPIENT;
  if (overflow <= 0) return;

  const removeIndexes = new Set(owned.slice(0, overflow).map(({ index }) => index));
  state.items = state.items.filter((_, index) => !removeIndexes.has(index));
};

export async function listUserNotifications(
  recipientUserId: number,
  filters?: { unseen?: boolean; forBell?: boolean }
): Promise<UserNotification[]> {
  const state = await readState();
  let list = state.items
    .filter((item) => item.recipient_user_id === recipientUserId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  if (filters?.forBell) {
    list = list.filter((item) => !item.hidden_from_bell);
  }
  if (filters?.unseen) {
    list = list.filter((item) => !item.seen);
  }
  return list;
}

export async function countUnseenUserNotifications(recipientUserId: number): Promise<number> {
  const state = await readState();
  return state.items.filter(
    (item) =>
      item.recipient_user_id === recipientUserId &&
      !item.seen &&
      !item.hidden_from_bell
  ).length;
}

export async function markUserNotificationSeen(
  recipientUserId: number,
  id: string
): Promise<UserNotification | null> {
  const state = await readState();
  const item = state.items.find(
    (row) => row.id === id && row.recipient_user_id === recipientUserId
  );
  if (!item) return null;
  item.seen = true;
  await writeState(state);
  return item;
}

export async function markAllUserNotificationsSeen(recipientUserId: number): Promise<number> {
  const state = await readState();
  let changed = 0;
  for (const item of state.items) {
    if (item.recipient_user_id === recipientUserId && !item.seen) {
      item.seen = true;
      changed += 1;
    }
  }
  if (changed) await writeState(state);
  return changed;
}

/** Убрать из колокольчика; запись остаётся в разделе «Уведомления». */
export async function hideUserNotificationFromBell(
  recipientUserId: number,
  id: string
): Promise<UserNotification | null> {
  const state = await readState();
  const item = state.items.find(
    (row) => row.id === id && row.recipient_user_id === recipientUserId
  );
  if (!item) return null;
  item.hidden_from_bell = true;
  item.seen = true;
  await writeState(state);
  return item;
}

/** Полное удаление (раздел «Уведомления» / админская очистка). */
export async function dismissUserNotification(
  recipientUserId: number,
  id: string
): Promise<boolean> {
  const state = await readState();
  const index = state.items.findIndex(
    (row) => row.id === id && row.recipient_user_id === recipientUserId
  );
  if (index === -1) return false;
  state.items.splice(index, 1);
  await writeState(state);
  return true;
}

export async function createUserNotification(
  input: Omit<UserNotification, 'id' | 'created_at' | 'seen' | 'hidden_from_bell'>
): Promise<UserNotification> {
  const state = await readState();
  const notification: UserNotification = {
    ...input,
    id: randomUUID(),
    created_at: new Date().toISOString(),
    seen: false,
    hidden_from_bell: false
  };
  state.items.push(notification);
  trimRecipientToMax(state, notification.recipient_user_id);
  await writeState(state);
  return notification;
}
