import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createMutationQueue, writeJsonAtomic } from '../utils/atomicJson';
import type { AdminNotification, AdminNotificationsRepo } from './types';

/**
 * server/data/admin-notifications.json — поведение до этапа 5 (прод и локалка).
 * На стейдже после переезда файл — замороженный бэкап.
 */
export const ADMIN_NOTIFICATIONS_JSON_FILE = join(process.cwd(), 'server/data/admin-notifications.json');

type NotificationsState = { items: AdminNotification[] };

/** Чтение без создания файла (для импорта): нет файла / битый → пустой список. */
export async function readAdminNotificationsJson(file: string): Promise<AdminNotification[]> {
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8')) as Partial<NotificationsState>;
    return Array.isArray(parsed.items) ? parsed.items : [];
  } catch {
    return [];
  }
}

export function createJsonAdminNotificationsRepo(file = ADMIN_NOTIFICATIONS_JSON_FILE): AdminNotificationsRepo {
  const enqueue = createMutationQueue();

  async function readItems(): Promise<AdminNotification[]> {
    await mkdir(dirname(file), { recursive: true });
    try {
      await readFile(file, 'utf8');
    } catch {
      await writeJsonAtomic(file, { items: [] } satisfies NotificationsState);
    }
    return readAdminNotificationsJson(file);
  }

  return {
    backend: 'json',
    readAll: readItems,
    async countUnseen() {
      return (await readItems()).filter((item) => !item.admin_seen).length;
    },
    async getById(id) {
      return (await readItems()).find((row) => row.id === id) ?? null;
    },
    mutate: (fn) =>
      enqueue(async () => {
        const items = await readItems();
        const before = JSON.stringify(items);
        const result = await fn(items);
        if (JSON.stringify(items) !== before) await writeJsonAtomic(file, { items } satisfies NotificationsState);
        return result;
      })
  };
}
