import { index, integer, json, pgSchema, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Схема `profile` — то, что сотрудник видит и настраивает в своём профиле: аватар-персонаж,
 * лента «Недавняя активность», награды «Лучший специалист продаж», пароль входа Vibe.
 * Этап 6 миграции с JSON (раньше server/data/user-avatars.json, profile-activity.json,
 * sales-best-awards.json, vibe-passwords.json). Флаг DB_PROFILE=1 (сейчас только стейдж).
 * Формат API не меняется: source_keys + extra восстанавливают объект байт-в-байт;
 * extra — тип `json` (порядок ключей сохраняется).
 */
export const profileSchema = pgSchema('profile');

/** Аватар-персонаж пользователя (бывш. user-avatars.json: { "<user id>": "character_NN" }). */
export const userAvatars = profileSchema.table('user_avatars', {
  /** Ключ как в файле: id пользователя сессии (bitrix_user_id, иначе platform id) строкой. */
  userId: text('user_id').primaryKey(),
  characterId: text('character_id').notNull(),
  /** Порядок ключей файла. */
  position: integer('position').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

/** Лента «Недавняя активность» в профиле (бывш. profile-activity.json → items). */
export const profileActivity = profileSchema.table(
  'activity',
  {
    /** id как в JSON (uuid, seed-*, sales-best-YYYY-MM). */
    id: text('id').primaryKey(),
    position: integer('position').notNull().default(0),
    employeeId: integer('employee_id'),
    platformUserId: integer('platform_user_id'),
    kind: text('kind'),
    text: text('text'),
    occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'date' }),
    /** manual | seed | auto. */
    source: text('source'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }),
    createdByUserId: integer('created_by_user_id'),
    createdByName: text('created_by_name'),
    sourceKeys: text('source_keys').array(),
    extra: json('extra').$type<Record<string, unknown>>(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index('profile_activity_employee_idx').on(t.employeeId), index('profile_activity_platform_user_idx').on(t.platformUserId)]
);

/** «Лучший специалист отдела продаж» за месяц (бывш. sales-best-awards.json → awards). */
export const salesBestAwards = profileSchema.table(
  'sales_best_awards',
  {
    id: text('id').primaryKey(),
    position: integer('position').notNull().default(0),
    /** YYYY-MM. */
    period: text('period'),
    employeeId: integer('employee_id'),
    employeeName: text('employee_name'),
    selectedAt: timestamp('selected_at', { withTimezone: true, mode: 'date' }),
    selectedBy: integer('selected_by'),
    /** YYYY-MM-DD, первый рабочий день следующего месяца (строкой, как в файле). */
    revealOn: text('reveal_on'),
    activityId: text('activity_id'),
    sourceKeys: text('source_keys').array(),
    extra: json('extra').$type<Record<string, unknown>>(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index('sales_best_awards_period_idx').on(t.period), index('sales_best_awards_employee_idx').on(t.employeeId)]
);

/**
 * Пароль входа Vibe (не пароль Bitrix). Хранится ровно то же, что было в vibe-passwords.json:
 * хеш scrypt и зашифрованная (aes-256-gcm) копия для показа владельцу. Открытого текста нет.
 * В аудит значения не пишутся — только факт «пароль задан / снят» и кто это сделал.
 */
export const vibePasswords = profileSchema.table('vibe_passwords', {
  employeeId: integer('employee_id').primaryKey(),
  position: integer('position').notNull().default(0),
  passwordHash: text('password_hash'),
  passwordSeal: text('password_seal'),
  /** updated_at записи из файла (когда пароль задан / дописан seal). */
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }),
  sourceKeys: text('source_keys').array(),
  extra: json('extra').$type<Record<string, unknown>>()
});

/** Разовые импорты из JSON: строка есть → импорт уже был, повторно не запускаем. */
export const profileJsonImports = profileSchema.table('json_imports', {
  source: text('source').primaryKey(),
  importedAt: timestamp('imported_at', { withTimezone: true }).notNull().defaultNow(),
  fileCount: integer('file_count').notNull(),
  inserted: integer('inserted').notNull(),
  skipped: integer('skipped').notNull()
});
