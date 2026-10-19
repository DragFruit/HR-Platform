import { asc, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '../client';
import { writeAudit, type AuditEntry } from '../audit';
import { adminNotifications as t } from '../schema';
import { chunks, excludedSet } from './core';
import { createMutationQueue } from '../../utils/atomicJson';
import { adminNotificationToRow, asStored, rowToAdminNotification, type AdminNotificationRow } from '../../adminNotifications/rowMapping';
import type { AdminNotification, AdminNotificationsRepo, AdminNotificationsWriteContext } from '../../adminNotifications/types';

/** pg_advisory_xact_lock на запись уведомлений админки (несколько процессов на одной базе). */
export const ADMIN_NOTIFICATIONS_WRITE_LOCK_KEY = 72_461_005;
export const ADMIN_NOTIFICATION_AUDIT_ENTITY = 'notifications.admin_notification';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type Q = Pick<Db, 'select'>;

export async function loadAdminNotificationRows(q: Q) {
  return q.select().from(t).orderBy(asc(t.position), asc(t.id));
}

export async function lockAdminNotifications(tx: Tx) {
  await tx.execute(sql`select pg_advisory_xact_lock(${ADMIN_NOTIFICATIONS_WRITE_LOCK_KEY})`);
}

/** Позиции: старые записи сохраняют свою, новые (в конце) — следующие; если порядок поменялся — перенумеровать. */
function assignPositions(next: AdminNotification[], prevPos: Map<string, number>): number[] {
  let last = -1;
  let maxPrev = -1;
  for (const p of prevPos.values()) maxPrev = Math.max(maxPrev, p);
  let seenNew = false;
  let keep = true;
  for (const item of next) {
    const p = prevPos.get(item.id);
    if (p === undefined) {
      seenNew = true;
      continue;
    }
    if (seenNew || p <= last) {
      keep = false;
      break;
    }
    last = p;
  }
  if (!keep) return next.map((_, i) => i);
  let nextNew = maxPrev + 1;
  return next.map((item) => prevPos.get(item.id) ?? nextNew++);
}

/** Какие поля поменялись (для аудита). */
function changedFields(before: Record<string, unknown>, after: Record<string, unknown>) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const k of keys) {
    if (JSON.stringify(before[k]) === JSON.stringify(after[k])) continue;
    b[k] = before[k];
    a[k] = after[k];
  }
  return { before: b, after: a };
}

export function createPgAdminNotificationsRepo(db: Db): AdminNotificationsRepo {
  const enqueue = createMutationQueue();

  async function applyDiff(
    tx: Tx,
    prevRows: Awaited<ReturnType<typeof loadAdminNotificationRows>>,
    nextItems: AdminNotification[],
    ctx: AdminNotificationsWriteContext
  ) {
    const prevById = new Map(prevRows.map((r) => [r.id, r]));
    const prevItems = new Map(prevRows.map((r) => [r.id, rowToAdminNotification(r)]));
    const positions = assignPositions(nextItems, new Map(prevRows.map((r) => [r.id, r.position])));
    const actor = { actorEmployeeId: ctx.actorEmployeeId ?? null };
    const reason = ctx.reason ?? null;
    const audits: AuditEntry[] = [];
    const markedSeen: string[] = [];
    const upserts: AdminNotificationRow[] = [];
    const nextIds = new Set<string>();
    const now = new Date();

    nextItems.forEach((raw, i) => {
      const item = asStored(raw);
      const row = adminNotificationToRow(item as unknown as Record<string, unknown>, positions[i]!);
      if (!row) throw new Error('[admin-notifications] запись отменена: уведомление без id или kind');
      if (nextIds.has(row.id)) throw new Error(`[admin-notifications] запись отменена: дубль id ${row.id}`);
      nextIds.add(row.id);
      const prevRow = prevById.get(row.id);
      if (!prevRow) {
        row.seenAt = row.adminSeen === true ? now : null;
        upserts.push(row);
        audits.push({ ...actor, action: 'create', entity: ADMIN_NOTIFICATION_AUDIT_ENTITY, entityId: row.id, after: { reason, ...item } });
        return;
      }
      const prevItem = prevItems.get(row.id)!;
      const sameData = JSON.stringify(prevItem) === JSON.stringify(item);
      if (sameData && prevRow.position === row.position) return;
      // seen_at: ставим при переходе в «прочитано», сбрасываем при возврате в «не прочитано».
      if (row.adminSeen === true) row.seenAt = prevRow.adminSeen === true ? prevRow.seenAt : now;
      else row.seenAt = null;
      upserts.push(row);
      if (sameData) return; // только перенумерация
      const diff = changedFields(prevItem as Record<string, unknown>, item as Record<string, unknown>);
      const keys = Object.keys(diff.after);
      if (keys.length === 1 && keys[0] === 'admin_seen' && diff.after.admin_seen === true) {
        markedSeen.push(row.id);
        return;
      }
      audits.push({ ...actor, action: 'update', entity: ADMIN_NOTIFICATION_AUDIT_ENTITY, entityId: row.id, before: diff.before, after: { reason, ...diff.after } });
    });

    const removed = prevRows.filter((r) => !nextIds.has(r.id));
    for (const r of removed) {
      audits.push({ ...actor, action: 'delete', entity: ADMIN_NOTIFICATION_AUDIT_ENTITY, entityId: r.id, before: prevItems.get(r.id), after: reason ? { reason } : null });
    }
    if (markedSeen.length) {
      audits.push({ ...actor, action: 'mark_seen', entity: ADMIN_NOTIFICATION_AUDIT_ENTITY, entityId: markedSeen.length === 1 ? markedSeen[0] : null, after: { reason, ids: markedSeen } });
    }

    for (const part of chunks(removed.map((r) => r.id), 1000)) await tx.delete(t).where(inArray(t.id, part));
    for (const part of chunks(upserts)) {
      await tx
        .insert(t)
        .values(part.map((r) => ({ ...r, updatedAt: now })))
        .onConflictDoUpdate({ target: t.id, set: excludedSet(t, ['id']) });
    }
    for (const part of chunks(audits, 200)) await writeAudit(tx, part);
  }

  return {
    backend: 'postgres',
    async readAll() {
      return (await loadAdminNotificationRows(db)).map(rowToAdminNotification);
    },
    async countUnseen() {
      const [row] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(t)
        .where(sql`${t.adminSeen} is not true`);
      return row?.n ?? 0;
    },
    async getById(id) {
      const [row] = await db.select().from(t).where(eq(t.id, id));
      return row ? rowToAdminNotification(row) : null;
    },
    mutate: (fn, ctx = {}) =>
      enqueue(() =>
        db.transaction(async (tx) => {
          await lockAdminNotifications(tx);
          const prevRows = await loadAdminNotificationRows(tx);
          const items = prevRows.map(rowToAdminNotification);
          const result = await fn(items);
          await applyDiff(tx, prevRows, items, ctx);
          return result;
        })
      )
  };
}
