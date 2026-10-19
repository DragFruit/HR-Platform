import { randomUUID } from 'node:crypto';
import { getDb, isDbEnabled } from '../db/client';
import { createPgAdminNotificationsRepo } from '../db/repositories/adminNotifications';
import { createJsonAdminNotificationsRepo } from '../adminNotifications/jsonStore';
import type {
  AdminNotification,
  AdminNotificationKind,
  AdminNotificationsRepo,
  AdminNotificationsWriteContext
} from '../adminNotifications/types';

export type { AdminNotification, AdminNotificationKind, AdminNotificationsWriteContext } from '../adminNotifications/types';

/**
 * Уведомления админки (этап 5). DB_ADMIN_NOTIFICATIONS=1 и задан DATABASE_URL → Postgres
 * (notifications.admin_notifications), иначе server/data/admin-notifications.json.
 * Флаг стоит только на стейдже; на проде DATABASE_URL есть, но флага нет → JSON.
 * Публичный API (функции ниже) не менялся; все правки — через repo().mutate (по очереди, атомарно).
 */
export function adminNotificationsDbFlag(): boolean {
  return String(process.env.DB_ADMIN_NOTIFICATIONS || '').trim() === '1' && isDbEnabled();
}

let resolvePgReady!: (ok: boolean) => void;
const pgReady = new Promise<boolean>((resolve) => {
  resolvePgReady = resolve;
});

/** Вызывает плагин db-migrate: true — миграции и импорт прошли, можно работать с Postgres. */
export function setAdminNotificationsPgReady(ok: boolean) {
  resolvePgReady(ok);
}

let jsonRepo: AdminNotificationsRepo | null = null;
let pgRepo: AdminNotificationsRepo | null = null;
let warnedFallback = false;

async function repo(): Promise<AdminNotificationsRepo> {
  if (adminNotificationsDbFlag()) {
    const ok = await pgReady;
    const db = ok ? getDb() : null;
    if (db) return (pgRepo ??= createPgAdminNotificationsRepo(db));
    if (!warnedFallback) {
      warnedFallback = true;
      console.error('[admin-notifications] DB_ADMIN_NOTIFICATIONS=1, но Postgres недоступен — работаем на JSON (бэкап может быть устаревшим)');
    }
  }
  return (jsonRepo ??= createJsonAdminNotificationsRepo());
}

export async function getAdminNotificationsBackend(): Promise<'json' | 'postgres'> {
  return (await repo()).backend;
}

function normalizeComparable(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ');
}

export async function listAdminNotifications(filters?: {
  unseen?: boolean;
}): Promise<AdminNotification[]> {
  const items = await (await repo()).readAll();
  let list = [...items].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  if (filters?.unseen) {
    list = list.filter((item) => !item.admin_seen);
  }
  return list;
}

export async function countUnseenAdminNotifications(): Promise<number> {
  return (await repo()).countUnseen();
}

export async function markAdminNotificationSeen(
  id: string,
  ctx: AdminNotificationsWriteContext = {}
): Promise<AdminNotification | null> {
  return (await repo()).mutate(
    (items) => {
      const item = items.find((row) => row.id === id);
      if (!item) return null;
      item.admin_seen = true;
      return item;
    },
    { reason: 'admin-seen', ...ctx }
  );
}

export async function markAllAdminNotificationsSeen(ctx: AdminNotificationsWriteContext = {}): Promise<number> {
  return (await repo()).mutate(
    (items) => {
      let changed = 0;
      for (const item of items) {
        if (!item.admin_seen) {
          item.admin_seen = true;
          changed += 1;
        }
      }
      return changed;
    },
    { reason: 'admin-seen-all', ...ctx }
  );
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

  return (await repo()).mutate(
    (items) => {
      const kind: AdminNotificationKind =
        input.field === 'name' ? 'bitrix_employee_name' : 'bitrix_employee_title';

      const existing = items.find(
        (item) =>
          (item.kind === 'bitrix_employee_name' || item.kind === 'bitrix_employee_title') &&
          item.employee_id === input.employee_id &&
          item.field === input.field &&
          normalizeComparable(item.bitrix_value || '') === bitrix
      );
      if (existing) return existing;

      const stale = items.findIndex(
        (item) =>
          !item.admin_seen &&
          (item.kind === 'bitrix_employee_name' || item.kind === 'bitrix_employee_title') &&
          item.employee_id === input.employee_id &&
          item.field === input.field
      );
      if (stale >= 0) {
        items.splice(stale, 1);
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
      items.push(notification);
      return notification;
    },
    { reason: 'bitrix-field-sync' }
  );
}

export async function createTenureGiftOrderNotification(input: {
  employee_id: number;
  employee_name: string;
  years: number;
  sku: string;
  order_id: string;
}): Promise<AdminNotification> {
  return (await repo()).mutate(
    (items) => {
      const existing = items.find(
        (item) => item.kind === 'tenure_gift_order' && item.order_id === input.order_id
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
      items.push(notification);
      return notification;
    },
    { reason: 'tenure-gift-order' }
  );
}

export async function createIdeaSubmittedNotification(input: {
  employee_id: number;
  employee_name: string;
  idea_id: string;
  idea_title: string;
}): Promise<AdminNotification> {
  return (await repo()).mutate(
    (items) => {
      const existing = items.find(
        (item) => item.kind === 'idea_submitted' && item.idea_id === input.idea_id
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
      items.push(notification);
      return notification;
    },
    { reason: 'idea-submitted' }
  );
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
  return (await repo()).mutate(
    (items) => {
      const existing = items.find(
        (item) =>
          item.kind === 'bitrix_vacation_sync_failed' &&
          item.vacation_request_id === input.request_id
      );
      if (existing) {
        existing.error_message = input.error;
        existing.vacation_start = input.start;
        existing.vacation_end = input.end;
        existing.created_at = new Date().toISOString();
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
      items.push(notification);
      return notification;
    },
    { reason: 'bitrix-vacation-sync-failed' }
  );
}

export async function createVpnPeerDeleteFailedNotification(input: {
  employee_id: number;
  employee_name: string;
  peer_names: string[];
  panel?: string;
  error: string;
}): Promise<AdminNotification> {
  return (await repo()).mutate(
    (items) => {
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
      items.push(notification);
      return notification;
    },
    { reason: 'vpn-peer-delete-failed' }
  );
}

/** Напоминание 29-го: выбрать лучшего специалиста продаж за месяц (идемпотентно по period). */
export async function createSalesBestPickDueNotification(input: {
  period: string;
  period_label: string;
}): Promise<AdminNotification> {
  return (await repo()).mutate(
    (items) => {
      const existing = items.find(
        (item) => item.kind === 'sales_best_pick_due' && item.sales_period === input.period
      );
      if (existing) return existing;

      const notification: AdminNotification = {
        id: randomUUID(),
        kind: 'sales_best_pick_due',
        employee_id: 0,
        employee_name: 'Отдел продаж',
        sales_period: input.period,
        sales_period_label: input.period_label,
        created_at: new Date().toISOString(),
        admin_seen: false
      };
      items.push(notification);
      return notification;
    },
    { reason: 'sales-best-pick-due' }
  );
}

export async function createPageFeedbackNotification(input: {
  employee_id: number;
  employee_name: string;
  stars: number;
  comment?: string;
  page?: string;
  photo_id?: string;
  photo_ids?: string[];
}): Promise<AdminNotification> {
  return (await repo()).mutate(
    (items) => {
      const photoIds = (input.photo_ids || []).filter(Boolean).slice(0, 5);
      const notification: AdminNotification = {
        id: randomUUID(),
        kind: 'page_feedback',
        employee_id: input.employee_id,
        employee_name: input.employee_name,
        stars: input.stars,
        comment: input.comment || '',
        page: input.page || '/knowledge',
        photo_id: photoIds[0] || input.photo_id || undefined,
        photo_ids: photoIds.length ? photoIds : undefined,
        created_at: new Date().toISOString(),
        admin_seen: false
      };
      items.push(notification);
      return notification;
    },
    { reason: 'page-feedback' }
  );
}

/** Дописать фото к уже созданной оценке (после JSON-ответа, по одному файлу). */
export async function appendPageFeedbackPhotoIds(
  notificationId: string,
  employeeId: number,
  newIds: string[]
): Promise<AdminNotification | null> {
  return (await repo()).mutate(
    (items) => {
      const item = items.find((row) => row.id === notificationId);
      if (!item || item.kind !== 'page_feedback') return null;
      if (item.employee_id !== employeeId) return null;
      const merged = [...(item.photo_ids || []), ...(item.photo_id ? [item.photo_id] : []), ...newIds]
        .filter(Boolean)
        .filter((id, idx, arr) => arr.indexOf(id) === idx)
        .slice(0, 5);
      item.photo_ids = merged.length ? merged : undefined;
      item.photo_id = merged[0];
      return item;
    },
    { reason: 'page-feedback-photo' }
  );
}

export async function getAdminNotificationById(id: string): Promise<AdminNotification | null> {
  return (await repo()).getById(id);
}

export async function createKnowledgeAiDegradedNotification(input: {
  employee_id: number;
  employee_name: string;
  error_message: string;
  question?: string;
}): Promise<AdminNotification> {
  return (await repo()).mutate(
    (items) => {
      // не спамим: если за последний час уже есть такое — обновим текст
      const hourAgo = Date.now() - 60 * 60 * 1000;
      const recent = items.find(
        (item) =>
          item.kind === 'knowledge_ai_degraded' && new Date(item.created_at).getTime() >= hourAgo
      );
      if (recent) {
        recent.error_message = input.error_message;
        recent.employee_id = input.employee_id;
        recent.employee_name = input.employee_name;
        recent.admin_seen = false;
        recent.created_at = new Date().toISOString();
        return recent;
      }

      const notification: AdminNotification = {
        id: randomUUID(),
        kind: 'knowledge_ai_degraded',
        employee_id: input.employee_id,
        employee_name: input.employee_name,
        error_message: input.error_message,
        page: '/knowledge',
        comment: input.question ? input.question.slice(0, 200) : '',
        created_at: new Date().toISOString(),
        admin_seen: false
      };
      items.push(notification);
      return notification;
    },
    { reason: 'knowledge-ai-degraded' }
  );
}

/** Bitrix не создал колокольчик согласующему (timestamp вместо ID / ошибка bridge). */
export async function createBitrixNotifyFailedNotification(input: {
  employee_id: number;
  employee_name: string;
  bitrix_user_id: number;
  error_message: string;
  vacation_request_id?: number;
}): Promise<AdminNotification> {
  return (await repo()).mutate(
    (items) => {
      const notification: AdminNotification = {
        id: randomUUID(),
        kind: 'bitrix_notify_failed',
        employee_id: input.employee_id,
        employee_name: input.employee_name,
        bitrix_user_id: input.bitrix_user_id,
        error_message: input.error_message,
        vacation_request_id: input.vacation_request_id,
        created_at: new Date().toISOString(),
        admin_seen: false
      };
      items.push(notification);
      return notification;
    },
    { reason: 'bitrix-notify-failed' }
  );
}

export { normalizeComparable as normalizeNotificationText };
