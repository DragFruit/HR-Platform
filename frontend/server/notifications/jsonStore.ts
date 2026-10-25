import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createMutationQueue, writeJsonAtomic } from '../utils/atomicJson';
import {
  USER_NOTIFICATIONS_MAX_PER_RECIPIENT,
  recipientList,
  type UserNotification,
  type UserNotificationsRepo
} from './types';

/**
 * Хранилище уведомлений в JSON-файле (как было до этапа 2). Остаётся основным на проде
 * и локально без DB_NOTIFICATIONS=1. На стейдже после переезда файл — замороженный бэкап.
 */
type NotificationsState = { items: UserNotification[] };

export const USER_NOTIFICATIONS_JSON_FILE = join(process.cwd(), 'server/data/user-notifications.json');

const emptyState = (): NotificationsState => ({ items: [] });

export async function readUserNotificationsJson(file: string): Promise<UserNotification[]> {
  try {
    const raw = await readFile(file, 'utf8');
    const parsed = JSON.parse(raw) as Partial<NotificationsState>;
    return Array.isArray(parsed.items) ? parsed.items : [];
  } catch {
    return [];
  }
}

const byCreatedDesc = (a: UserNotification, b: UserNotification) =>
  new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

const trimRecipientToMax = (state: NotificationsState, recipientUserId: number) => {
  const owned = state.items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.recipient_user_id === recipientUserId)
    .sort((a, b) => new Date(a.item.created_at).getTime() - new Date(b.item.created_at).getTime());
  const overflow = owned.length - USER_NOTIFICATIONS_MAX_PER_RECIPIENT;
  if (overflow <= 0) return;
  const removeIndexes = new Set(owned.slice(0, overflow).map(({ index }) => index));
  state.items = state.items.filter((_, index) => !removeIndexes.has(index));
};

export function createJsonUserNotificationsRepo(file = USER_NOTIFICATIONS_JSON_FILE): UserNotificationsRepo {
  const enqueue = createMutationQueue();

  async function readState(): Promise<NotificationsState> {
    await mkdir(dirname(file), { recursive: true });
    try {
      await readFile(file, 'utf8');
    } catch {
      await writeJsonAtomic(file, emptyState());
    }
    return { items: await readUserNotificationsJson(file) };
  }

  const writeState = (state: NotificationsState) => writeJsonAtomic(file, state);

  /** read-modify-write одной очередью — без гонок между параллельными запросами. */
  const mutate = <T>(fn: (state: NotificationsState) => { result: T; changed: boolean }) =>
    enqueue(async () => {
      const state = await readState();
      const { result, changed } = fn(state);
      if (changed) await writeState(state);
      return result;
    });

  return {
    backend: 'json',

    async list(recipients, filters) {
      const ids = new Set(recipientList(recipients));
      const state = await readState();
      let list = state.items.filter((item) => ids.has(item.recipient_user_id)).sort(byCreatedDesc);
      if (filters?.forBell) list = list.filter((item) => !item.hidden_from_bell);
      if (filters?.unseen) list = list.filter((item) => !item.seen);
      return list;
    },

    async countUnseen(recipients) {
      const ids = new Set(recipientList(recipients));
      const state = await readState();
      return state.items.filter(
        (item) => ids.has(item.recipient_user_id) && !item.seen && !item.hidden_from_bell
      ).length;
    },

    markSeen(recipients, id) {
      const ids = new Set(recipientList(recipients));
      return mutate((state) => {
        const item = state.items.find((row) => row.id === id && ids.has(row.recipient_user_id));
        if (!item) return { result: null, changed: false };
        item.seen = true;
        return { result: item, changed: true };
      });
    },

    markAllSeen(recipients) {
      const ids = new Set(recipientList(recipients));
      return mutate((state) => {
        let changed = 0;
        for (const item of state.items) {
          if (ids.has(item.recipient_user_id) && !item.seen) {
            item.seen = true;
            changed += 1;
          }
        }
        return { result: changed, changed: changed > 0 };
      });
    },

    hideFromBell(recipients, id) {
      const ids = new Set(recipientList(recipients));
      return mutate((state) => {
        const item = state.items.find((row) => row.id === id && ids.has(row.recipient_user_id));
        if (!item) return { result: null, changed: false };
        item.hidden_from_bell = true;
        item.seen = true;
        return { result: item, changed: true };
      });
    },

    dismiss(recipients, id) {
      const ids = new Set(recipientList(recipients));
      return mutate((state) => {
        const index = state.items.findIndex((row) => row.id === id && ids.has(row.recipient_user_id));
        if (index === -1) return { result: false, changed: false };
        state.items.splice(index, 1);
        return { result: true, changed: true };
      });
    },

    create(input) {
      return mutate((state) => {
        const notification: UserNotification = {
          ...input,
          id: randomUUID(),
          created_at: new Date().toISOString(),
          seen: false,
          hidden_from_bell: false
        };
        state.items.push(notification);
        trimRecipientToMax(state, notification.recipient_user_id);
        return { result: notification, changed: true };
      });
    },

    deleteForRecipients(recipientUserIds) {
      const ids = new Set(recipientUserIds.filter((id) => Number.isFinite(id) && id > 0));
      if (!ids.size) return Promise.resolve(0);
      return mutate((state) => {
        const before = state.items.length;
        state.items = state.items.filter((item) => !ids.has(item.recipient_user_id));
        const removed = before - state.items.length;
        return { result: removed, changed: removed > 0 };
      });
    }
  };
}
