import { getDb, isDbEnabled } from '../db/client';
import { createPgUserNotificationsRepo } from '../db/repositories/userNotifications';
import { createJsonUserNotificationsRepo } from '../notifications/jsonStore';
import type {
  CreateUserNotificationInput,
  RecipientIds,
  UserNotification,
  UserNotificationsRepo
} from '../notifications/types';

export type { UserNotification, UserNotificationKind } from '../notifications/types';
export { USER_NOTIFICATIONS_MAX_PER_RECIPIENT } from '../notifications/types';

/**
 * Единая точка входа уведомлений. Хранилище выбирается одним переключателем:
 * DB_NOTIFICATIONS=1 и задан DATABASE_URL → Postgres (схема notifications), иначе JSON-файл.
 * Флаг стоит только на стейдже; на проде DATABASE_URL есть, но флага нет → JSON.
 */
export function notificationsDbFlag(): boolean {
  return String(process.env.DB_NOTIFICATIONS || '').trim() === '1' && isDbEnabled();
}

let resolvePgReady!: (ok: boolean) => void;
const pgReady = new Promise<boolean>((resolve) => {
  resolvePgReady = resolve;
});

/** Вызывает плагин db-migrate: true — миграции и импорт прошли, можно читать/писать в Postgres. */
export function setNotificationsPgReady(ok: boolean) {
  resolvePgReady(ok);
}

let jsonRepo: UserNotificationsRepo | null = null;
let pgRepo: UserNotificationsRepo | null = null;
let warnedFallback = false;

async function repo(): Promise<UserNotificationsRepo> {
  if (notificationsDbFlag()) {
    const ok = await pgReady;
    const db = ok ? getDb() : null;
    if (db) return (pgRepo ??= createPgUserNotificationsRepo(db));
    if (!warnedFallback) {
      warnedFallback = true;
      console.error('[notifications] DB_NOTIFICATIONS=1, но Postgres недоступен — работаем на JSON (бэкап может быть устаревшим)');
    }
  }
  return (jsonRepo ??= createJsonUserNotificationsRepo());
}

export async function getUserNotificationsBackend(): Promise<'json' | 'postgres'> {
  return (await repo()).backend;
}

export async function listUserNotifications(
  recipientUserId: RecipientIds,
  filters?: { unseen?: boolean; forBell?: boolean }
): Promise<UserNotification[]> {
  return (await repo()).list(recipientUserId, filters);
}

export async function countUnseenUserNotifications(recipientUserId: RecipientIds): Promise<number> {
  return (await repo()).countUnseen(recipientUserId);
}

export async function markUserNotificationSeen(recipientUserId: RecipientIds, id: string) {
  return (await repo()).markSeen(recipientUserId, id);
}

export async function markAllUserNotificationsSeen(recipientUserId: RecipientIds): Promise<number> {
  return (await repo()).markAllSeen(recipientUserId);
}

/** Убрать из колокольчика; запись остаётся в разделе «Уведомления». */
export async function hideUserNotificationFromBell(recipientUserId: RecipientIds, id: string) {
  return (await repo()).hideFromBell(recipientUserId, id);
}

/** Полное удаление (раздел «Уведомления» / админская очистка). */
export async function dismissUserNotification(recipientUserId: RecipientIds, id: string): Promise<boolean> {
  return (await repo()).dismiss(recipientUserId, id);
}

export async function createUserNotification(input: CreateUserNotificationInput): Promise<UserNotification> {
  return (await repo()).create(input);
}

/** Полная очистка колокольчика/истории для получателей (офбординг). */
export async function deleteUserNotificationsForRecipients(recipientUserIds: number[]): Promise<number> {
  return (await repo()).deleteForRecipients(recipientUserIds);
}
