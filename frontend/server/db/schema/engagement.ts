import { boolean, doublePrecision, index, integer, json, pgSchema, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Схема `engagement`: ивент «Пит-стоп 14» (этап 8). Флаг DB_ENGAGEMENT=1 (сейчас только стейдж).
 * - pit-stop-14.json: пары, игроки, easterCode/finalizedAt (строка state id=1);
 * - pit-stop-race.json: рекорды гонки, заходы на хаб, топ-3 (строка state id=2).
 * Фото кофе (server/data/pit-stop-coffee/*) остаются файлами на диске, в базе только путь, как в JSON.
 * Формат API не меняется: source_keys + extra восстанавливают объект байт-в-байт.
 */
export const engagementSchema = pgSchema('engagement');

const service = {
  sourceKeys: text('source_keys').array(),
  extra: json('extra').$type<Record<string, unknown>>()
};

/** Пары (pit-stop-14.json → pairs[]). */
export const pitStopPairs = engagementSchema.table('pit_stop_pairs', {
  id: text('id').primaryKey(),
  position: integer('position').notNull().default(0),
  userIdA: integer('user_id_a'),
  userIdB: integer('user_id_b'),
  nameA: text('name_a'),
  nameB: text('name_b'),
  cipher: text('cipher'),
  assemblyTurn: text('assembly_turn'),
  assemblyStep: integer('assembly_step'),
  ignitionHeldBy: json('ignition_held_by').$type<unknown[]>(),
  blindRoleA: text('blind_role_a'),
  blindX: doublePrecision('blind_x'),
  blindY: doublePrecision('blind_y'),
  blindStartedAt: timestamp('blind_started_at', { withTimezone: true, mode: 'date' }),
  puzzleGlowA: json('puzzle_glow_a').$type<unknown[]>(),
  puzzleGlowB: json('puzzle_glow_b').$type<unknown[]>(),
  puzzlePressedA: json('puzzle_pressed_a').$type<unknown[]>(),
  puzzlePressedB: json('puzzle_pressed_b').$type<unknown[]>(),
  ...service,
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

/** Игроки (pit-stop-14.json → players[]), ключ: userId (bitrix id сессии). */
export const pitStopPlayers = engagementSchema.table(
  'pit_stop_players',
  {
    userId: integer('user_id').primaryKey(),
    position: integer('position').notNull().default(0),
    name: text('name'),
    pairId: text('pair_id'),
    role: text('role'),
    isRemote: boolean('is_remote'),
    checkpoints: json('checkpoints').$type<Record<string, unknown>>(),
    coffeePhotoPath: text('coffee_photo_path'),
    coffeeApproved: boolean('coffee_approved'),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
    rewardsGranted: boolean('rewards_granted'),
    ...service,
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index('pit_stop_players_pair_idx').on(t.pairId)]
);

/** Рекорды гонки (pit-stop-race.json → records[]). updatedAt: поле записи, служебной колонки нет. */
export const pitStopRaceRecords = engagementSchema.table('pit_stop_race_records', {
  userId: integer('user_id').primaryKey(),
  position: integer('position').notNull().default(0),
  name: text('name'),
  department: text('department'),
  bestMs: doublePrecision('best_ms'),
  color: text('color'),
  laps: integer('laps'),
  bestAt: timestamp('best_at', { withTimezone: true, mode: 'date' }),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }),
  history: json('history').$type<unknown[]>(),
  cheat: json('cheat').$type<Record<string, unknown>>(),
  ...service
});

/** Заходы на хаб гонки (pit-stop-race.json → visits[]). */
export const pitStopRaceVisits = engagementSchema.table('pit_stop_race_visits', {
  userId: integer('user_id').primaryKey(),
  position: integer('position').notNull().default(0),
  name: text('name'),
  at: timestamp('at', { withTimezone: true, mode: 'date' }),
  ...service,
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

/** Зафиксированный топ-3 (pit-stop-race.json → winners[]), ключ: место. */
export const pitStopRaceWinners = engagementSchema.table('pit_stop_race_winners', {
  rank: integer('rank').primaryKey(),
  position: integer('position').notNull().default(0),
  userId: integer('user_id'),
  name: text('name'),
  bestMs: doublePrecision('best_ms'),
  ...service,
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

/**
 * Остальное содержимое файлов (порядок ключей, счётчики, неизвестные ключи).
 * id=1: pit-stop-14.json (easterCode, finalizedAt), id=2: pit-stop-race.json (finalizedAt).
 */
export const engagementState = engagementSchema.table('state', {
  id: integer('id').primaryKey(),
  easterCode: text('easter_code'),
  finalizedAt: timestamp('finalized_at', { withTimezone: true, mode: 'date' }),
  ...service,
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

/** Разовые импорты из JSON: строка есть → импорт уже был, повторно не запускаем. */
export const engagementJsonImports = engagementSchema.table('json_imports', {
  source: text('source').primaryKey(),
  importedAt: timestamp('imported_at', { withTimezone: true }).notNull().defaultNow(),
  fileCount: integer('file_count').notNull(),
  inserted: integer('inserted').notNull(),
  skipped: integer('skipped').notNull()
});
