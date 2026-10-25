import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '../client';
import { writeAudit } from '../audit';
import { userNotifications as t } from '../schema';
import { isUuid, rowToNotification, type UserNotificationRow } from '../../notifications/rowMapping';
import {
  USER_NOTIFICATIONS_MAX_PER_RECIPIENT,
  recipientList,
  type UserNotificationsRepo
} from '../../notifications/types';

export const NOTIFICATION_AUDIT_ENTITY = 'notifications.user_notification';

/**
 * Уведомления на Postgres (схема `notifications`). Интерфейс тот же, что у JSON-хранилища.
 * Аудит: создание, удаление, массовое удаление (офбординг), обрезка по лимиту 100.
 * Прочтение/скрытие не пишем в аудит — для них есть колонки seen_at / hidden_at.
 */
export function createPgUserNotificationsRepo(db: Db): UserNotificationsRepo {
  const toApi = (row: unknown) => rowToNotification(row as UserNotificationRow);

  return {
    backend: 'postgres',

    async list(recipients, filters) {
      const ids = recipientList(recipients);
      if (!ids.length) return [];
      const conds = [inArray(t.recipientUserId, ids)];
      if (filters?.forBell) conds.push(eq(t.hiddenFromBell, false));
      if (filters?.unseen) conds.push(eq(t.seen, false));
      const rows = await db.select().from(t).where(and(...conds)).orderBy(desc(t.createdAt));
      return rows.map(toApi);
    },

    async countUnseen(recipients) {
      const ids = recipientList(recipients);
      if (!ids.length) return 0;
      const [row] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(t)
        .where(and(inArray(t.recipientUserId, ids), eq(t.seen, false), eq(t.hiddenFromBell, false)));
      return row?.n ?? 0;
    },

    async markSeen(recipients, id) {
      const ids = recipientList(recipients);
      if (!ids.length || !isUuid(id)) return null;
      const [row] = await db
        .update(t)
        .set({ seen: true, seenAt: sql`coalesce(${t.seenAt}, now())` })
        .where(and(eq(t.id, id.toLowerCase()), inArray(t.recipientUserId, ids)))
        .returning();
      return row ? toApi(row) : null;
    },

    async markAllSeen(recipients) {
      const ids = recipientList(recipients);
      if (!ids.length) return 0;
      const rows = await db
        .update(t)
        .set({ seen: true, seenAt: sql`now()` })
        .where(and(inArray(t.recipientUserId, ids), eq(t.seen, false)))
        .returning({ id: t.id });
      return rows.length;
    },

    async hideFromBell(recipients, id) {
      const ids = recipientList(recipients);
      if (!ids.length || !isUuid(id)) return null;
      const [row] = await db
        .update(t)
        .set({
          hiddenFromBell: true,
          hiddenAt: sql`coalesce(${t.hiddenAt}, now())`,
          seen: true,
          seenAt: sql`coalesce(${t.seenAt}, now())`
        })
        .where(and(eq(t.id, id.toLowerCase()), inArray(t.recipientUserId, ids)))
        .returning();
      return row ? toApi(row) : null;
    },

    async dismiss(recipients, id) {
      const ids = recipientList(recipients);
      if (!ids.length || !isUuid(id)) return false;
      return db.transaction(async (tx) => {
        const [row] = await tx
          .delete(t)
          .where(and(eq(t.id, id.toLowerCase()), inArray(t.recipientUserId, ids)))
          .returning();
        if (!row) return false;
        await writeAudit(tx, {
          action: 'delete',
          entity: NOTIFICATION_AUDIT_ENTITY,
          entityId: row.id,
          before: toApi(row)
        });
        return true;
      });
    },

    async create(input) {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .insert(t)
          .values({
            id: randomUUID(),
            kind: input.kind,
            recipientUserId: input.recipient_user_id,
            vacationRequestId: input.vacation_request_id ?? null,
            employeeName: input.employee_name ?? '',
            startDate: input.start ?? null,
            endDate: input.end ?? null,
            stageLabel: input.stage_label ?? null,
            ideaId: input.idea_id ?? null,
            ideaTitle: input.idea_title ?? null,
            statusComment: input.status_comment ?? null
          })
          .returning();
        const created = toApi(row);

        // Лимит на получателя: всё старше 100-го — удаляем (как в JSON).
        const trimmed = await tx
          .delete(t)
          .where(
            inArray(
              t.id,
              tx
                .select({ id: t.id })
                .from(t)
                .where(eq(t.recipientUserId, input.recipient_user_id))
                .orderBy(desc(t.createdAt), desc(t.id))
                .offset(USER_NOTIFICATIONS_MAX_PER_RECIPIENT)
            )
          )
          .returning({ id: t.id });

        await writeAudit(tx, [
          { action: 'create', entity: NOTIFICATION_AUDIT_ENTITY, entityId: created.id, after: created },
          ...trimmed.map((r) => ({
            action: 'trim',
            entity: NOTIFICATION_AUDIT_ENTITY,
            entityId: r.id,
            after: { reason: `лимит ${USER_NOTIFICATIONS_MAX_PER_RECIPIENT} на получателя` }
          }))
        ]);
        return created;
      });
    },

    async deleteForRecipients(recipientUserIds) {
      const ids = recipientUserIds.filter((id) => Number.isFinite(id) && id > 0);
      if (!ids.length) return 0;
      return db.transaction(async (tx) => {
        const rows = await tx.delete(t).where(inArray(t.recipientUserId, ids)).returning({ id: t.id });
        if (rows.length) {
          await writeAudit(tx, {
            action: 'delete_for_recipients',
            entity: NOTIFICATION_AUDIT_ENTITY,
            after: { recipient_user_ids: ids, removed: rows.length }
          });
        }
        return rows.length;
      });
    }
  };
}
