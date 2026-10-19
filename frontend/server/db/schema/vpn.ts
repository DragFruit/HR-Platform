import { index, integer, json, pgSchema, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Схема `vpn`: учёт выданных VPN-ключей (этап 8). Флаг DB_VPN=1 (сейчас только стейдж).
 * Только метаданные, как в vpn-keys.json: id пира wg-easy, тип, кому выдан, имя клиента, когда.
 * Приватные ключи и конфиги здесь не хранятся (они живут в wg-easy). Импорт отказывается
 * переносить файл, если в записях есть поле, похожее на секрет (см. server/vpn/domain.ts).
 */
export const vpnSchema = pgSchema('vpn');

/** Выданные ключи (vpn-keys.json → keys[]). */
export const vpnKeys = vpnSchema.table(
  'keys',
  {
    id: text('id').primaryKey(),
    position: integer('position').notNull().default(0),
    /** wireguard | amnezia. */
    kind: text('kind'),
    userId: integer('user_id'),
    userEmail: text('user_email'),
    clientName: text('client_name'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }),
    sourceKeys: text('source_keys').array(),
    extra: json('extra').$type<Record<string, unknown>>(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index('vpn_keys_user_idx').on(t.userId)]
);

/** Остальное содержимое файла (порядок ключей верхнего уровня). Одна строка id=1. */
export const vpnState = vpnSchema.table('state', {
  id: integer('id').primaryKey(),
  sourceKeys: text('source_keys').array(),
  extra: json('extra').$type<Record<string, unknown>>(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

/** Разовые импорты из JSON: строка есть → импорт уже был, повторно не запускаем. */
export const vpnJsonImports = vpnSchema.table('json_imports', {
  source: text('source').primaryKey(),
  importedAt: timestamp('imported_at', { withTimezone: true }).notNull().defaultNow(),
  fileCount: integer('file_count').notNull(),
  inserted: integer('inserted').notNull(),
  skipped: integer('skipped').notNull()
});
