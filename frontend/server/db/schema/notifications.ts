import { sql } from 'drizzle-orm';
import { boolean, date, index, integer, jsonb, pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Схема `notifications` — уведомления пользователей (колокольчик + раздел «Уведомления»).
 * Этап 2 миграции с JSON (раньше server/data/user-notifications.json). Включается флагом
 * DB_NOTIFICATIONS=1 (сейчас только стейдж), см. docs/ARCHITECTURE.md.
 */
export const notificationsSchema = pgSchema('notifications');

export const userNotifications = notificationsSchema.table(
  'user_notifications',
  {
    id: uuid('id').primaryKey(),
    kind: text('kind').notNull(),
    /** Получатель: тот же id, что session.id (bitrix_user_id, иначе platform id) — как в JSON. */
    recipientUserId: integer('recipient_user_id').notNull(),
    vacationRequestId: integer('vacation_request_id'),
    /** Подпись «о ком» на момент события (снимок для текста уведомления, не ключ). */
    employeeName: text('employee_name').notNull().default(''),
    startDate: date('start_date', { mode: 'string' }),
    endDate: date('end_date', { mode: 'string' }),
    stageLabel: text('stage_label'),
    ideaId: text('idea_id'),
    ideaTitle: text('idea_title'),
    statusComment: text('status_comment'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    seen: boolean('seen').notNull().default(false),
    /** Когда прочитано. null — не прочитано или прочитано до переезда в Postgres (время неизвестно). */
    seenAt: timestamp('seen_at', { withTimezone: true, mode: 'date' }),
    hiddenFromBell: boolean('hidden_from_bell').notNull().default(false),
    /** Когда убрано из колокольчика. null — не скрыто или скрыто до переезда. */
    hiddenAt: timestamp('hidden_at', { withTimezone: true, mode: 'date' }),
    /** Поля из JSON, которых нет в колонках (чтобы импорт ничего не терял). */
    extra: jsonb('extra').$type<Record<string, unknown>>()
  },
  (t) => [
    index('user_notifications_recipient_created_idx').on(t.recipientUserId, t.createdAt.desc()),
    index('user_notifications_unseen_bell_idx')
      .on(t.recipientUserId)
      .where(sql`${t.seen} = false and ${t.hiddenFromBell} = false`),
    index('user_notifications_kind_vacation_idx').on(t.kind, t.vacationRequestId)
  ]
);

/** Разовые импорты из JSON: строка есть → импорт уже был, повторно не запускаем. */
export const jsonImports = notificationsSchema.table('json_imports', {
  source: text('source').primaryKey(),
  importedAt: timestamp('imported_at', { withTimezone: true }).notNull().defaultNow(),
  fileCount: integer('file_count').notNull(),
  inserted: integer('inserted').notNull(),
  skipped: integer('skipped').notNull()
});
