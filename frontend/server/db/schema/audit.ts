import { bigserial, index, integer, jsonb, pgSchema, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Схема `audit` — журнал изменений (кто, что, до/после).
 * Конвенция: одна Postgres-схема на домен (core, vacations, integrations, …) — см. docs/ARCHITECTURE.md
 * «База данных (миграция с JSON)». Фаза 1: таблица создаётся, но код в неё ещё не пишет.
 */
export const auditSchema = pgSchema('audit');

export const auditLog = auditSchema.table(
  'audit_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
    /** id сотрудника из справочника (не ФИО); null — система / cron / интеграция. */
    actorEmployeeId: integer('actor_employee_id'),
    action: text('action').notNull(),
    entity: text('entity').notNull(),
    entityId: text('entity_id'),
    before: jsonb('before'),
    after: jsonb('after')
  },
  (t) => [
    index('audit_log_entity_idx').on(t.entity, t.entityId),
    index('audit_log_at_idx').on(t.at)
  ]
);
