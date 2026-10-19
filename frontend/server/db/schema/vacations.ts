import { bigserial, date, doublePrecision, index, integer, json, pgSchema, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Схема `vacations` — заявки на отпуск, предварительные брони и общее состояние графика.
 * Этап 4 миграции с JSON (раньше server/data/vacations.json). Включается флагом DB_VACATIONS=1
 * (сейчас только стейдж), см. docs/ARCHITECTURE.md «Этап 4».
 *
 * Непрозрачные значения (extra, qa_demo_suppressed, лимиты) — тип `json`, не `jsonb`:
 * json хранит текст как есть, порядок ключей не меняется, API отдаёт то же, что отдавал файл.
 */
export const vacationsSchema = pgSchema('vacations');

/**
 * Общее состояние графика (одна строка, id = 1): учётный год, счётчики id, служебные поля.
 * request_years / reservation_years — какие «папки» годов есть в requestsByYear / reservationsByYear
 * (в том числе пустые, `"2026": []`), чтобы ответ API не менялся.
 */
export const vacationState = vacationsSchema.table('state', {
  id: integer('id').primaryKey(),
  primaryYear: integer('primary_year'),
  nextRequestId: integer('next_request_id'),
  nextReservationId: integer('next_reservation_id'),
  requestYears: text('request_years').array().notNull(),
  reservationYears: text('reservation_years').array().notNull(),
  /** Удалённые демо-записи (localhost/стейдж), чтобы seed не возвращался. null — поля нет. */
  qaDemoSuppressed: json('qa_demo_suppressed'),
  /** Лимит броней на месяц по группам (groupId → max). null — поля нет. */
  reservationMonthlyCapsByGroup: json('reservation_monthly_caps_by_group'),
  /** Поля верхнего уровня, которых нет в колонках, и значения не своего типа. */
  extra: json('extra').$type<Record<string, unknown>>(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

/**
 * Заявка на отпуск. id — тот же, что в JSON: на него ссылаются Bitrix (CODE vbi-hr-vac-<id>)
 * и уведомления (vacation_request_id). employee — снимок ФИО для подписи, связь — employee_id
 * (id из core.employees; без FK: старые заявки бывают без id, сотрудник может быть удалён).
 */
export const vacationRequests = vacationsSchema.table(
  'requests',
  {
    id: integer('id').primaryKey(),
    /** Ключ «папки» года в requestsByYear (обычно год начала). */
    bucketYear: text('bucket_year').notNull(),
    /** Порядок внутри папки (как в массиве JSON). */
    position: integer('position').notNull().default(0),
    employee: text('employee'),
    employeeId: integer('employee_id'),
    startDate: date('start_date', { mode: 'string' }),
    endDate: date('end_date', { mode: 'string' }),
    status: text('status'),
    approvalStep: text('approval_step'),
    comment: text('comment'),
    /** createdAt как в JSON: строка «ДД.ММ.ГГГГ» (toLocaleDateString), не метка времени. */
    createdAtText: text('created_at_text'),
    bitrixAbsenceId: integer('bitrix_absence_id'),
    bitrixAbsenceIblockId: integer('bitrix_absence_iblock_id'),
    bitrixSyncStatus: text('bitrix_sync_status'),
    bitrixSyncMethod: text('bitrix_sync_method'),
    /** ISO-строка как в JSON (без переформатирования через timestamptz). */
    bitrixSyncedAt: text('bitrix_synced_at'),
    bitrixSyncError: text('bitrix_sync_error'),
    /** Набор и порядок ключей исходного объекта: отсутствующее поле ≠ null. */
    sourceKeys: text('source_keys').array(),
    extra: json('extra').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index('requests_bucket_idx').on(t.bucketYear, t.position),
    index('requests_employee_id_idx').on(t.employeeId),
    index('requests_status_idx').on(t.status),
    index('requests_bitrix_absence_idx').on(t.bitrixAbsenceId)
  ]
);

/** Предварительная бронь (месяц + длительность, без дат). */
export const vacationReservations = vacationsSchema.table(
  'reservations',
  {
    id: integer('id').primaryKey(),
    bucketYear: text('bucket_year').notNull(),
    position: integer('position').notNull().default(0),
    employee: text('employee'),
    employeeId: integer('employee_id'),
    year: integer('year'),
    month: integer('month'),
    durationDays: doublePrecision('duration_days'),
    comment: text('comment'),
    createdAtText: text('created_at_text'),
    expiryNoticeSentAt: text('expiry_notice_sent_at'),
    sourceKeys: text('source_keys').array(),
    extra: json('extra').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index('reservations_bucket_idx').on(t.bucketYear, t.position),
    index('reservations_employee_id_idx').on(t.employeeId)
  ]
);

/**
 * История статуса и дат заявки. Пишется только с момента переезда в Postgres
 * (создание, смена статуса / шага согласования / дат, удаление); прошлое не восстанавливаем.
 */
export const vacationRequestHistory = vacationsSchema.table(
  'request_status_history',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    requestId: integer('request_id').notNull(),
    changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
    /** create | update | delete. */
    kind: text('kind').notNull(),
    actorEmployeeId: integer('actor_employee_id'),
    reason: text('reason'),
    statusBefore: text('status_before'),
    statusAfter: text('status_after'),
    approvalStepBefore: text('approval_step_before'),
    approvalStepAfter: text('approval_step_after'),
    startBefore: text('start_before'),
    startAfter: text('start_after'),
    endBefore: text('end_before'),
    endAfter: text('end_after')
  },
  (t) => [index('request_status_history_request_idx').on(t.requestId, t.changedAt)]
);

/** Разовые импорты из JSON домена vacations: строка есть → импорт уже был. */
export const vacationsJsonImports = vacationsSchema.table('json_imports', {
  source: text('source').primaryKey(),
  importedAt: timestamp('imported_at', { withTimezone: true }).notNull().defaultNow(),
  fileCount: integer('file_count').notNull(),
  inserted: integer('inserted').notNull(),
  skipped: integer('skipped').notNull()
});
