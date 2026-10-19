import { sql } from 'drizzle-orm';
import { boolean, date, index, integer, json, jsonb, pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core';

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

/**
 * Уведомления админки (раздел «Уведомления» у admin/hr): расхождения с Bitrix, сбои синка,
 * заказы юбилейных наборов, идеи, оценки страниц. Этап 5 (раньше server/data/admin-notifications.json),
 * флаг DB_ADMIN_NOTIFICATIONS=1. Формат API не меняется: source_keys + extra восстанавливают объект
 * байт-в-байт; extra — тип `json` (порядок ключей сохраняется).
 */
export const adminNotifications = notificationsSchema.table(
  'admin_notifications',
  {
    /** id как в JSON (uuid строкой; тип text, чтобы не терять нестандартные id). */
    id: text('id').primaryKey(),
    /** Порядок как в массиве файла (новые — в конец); сортировка «новые сверху» — по created_at. */
    position: integer('position').notNull().default(0),
    kind: text('kind').notNull(),
    /** id сотрудника, о ком событие (0 — не про сотрудника, например «Отдел продаж»). */
    employeeId: integer('employee_id'),
    /** Подпись «о ком» на момент события (снимок для текста, не ключ). */
    employeeName: text('employee_name'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }),
    adminSeen: boolean('admin_seen'),
    /** Когда отмечено прочитанным. null — не прочитано или прочитано до переезда (время неизвестно). */
    seenAt: timestamp('seen_at', { withTimezone: true, mode: 'date' }),
    bitrixUserId: integer('bitrix_user_id'),
    field: text('field'),
    platformValue: text('platform_value'),
    bitrixValue: text('bitrix_value'),
    years: integer('years'),
    sku: text('sku'),
    orderId: text('order_id'),
    ideaId: text('idea_id'),
    ideaTitle: text('idea_title'),
    vacationRequestId: integer('vacation_request_id'),
    vacationStart: text('vacation_start'),
    vacationEnd: text('vacation_end'),
    errorMessage: text('error_message'),
    vpnPeerNames: text('vpn_peer_names').array(),
    vpnPanel: text('vpn_panel'),
    salesPeriod: text('sales_period'),
    salesPeriodLabel: text('sales_period_label'),
    stars: integer('stars'),
    comment: text('comment'),
    page: text('page'),
    photoId: text('photo_id'),
    photoIds: text('photo_ids').array(),
    /** Набор и порядок ключей исходного объекта: отсутствующее поле ≠ null. */
    sourceKeys: text('source_keys').array(),
    /** Поля, которых нет в колонках, и значения не своего типа. */
    extra: json('extra').$type<Record<string, unknown>>(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index('admin_notifications_created_idx').on(t.createdAt.desc()),
    index('admin_notifications_unseen_idx').on(t.createdAt).where(sql`${t.adminSeen} is not true`),
    index('admin_notifications_kind_employee_idx').on(t.kind, t.employeeId),
    index('admin_notifications_kind_vacation_idx').on(t.kind, t.vacationRequestId)
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
