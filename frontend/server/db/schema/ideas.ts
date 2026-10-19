import { boolean, index, integer, json, pgSchema, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Схема `ideas` — банк идей (этап 7, бывш. server/data/ideas.json). Флаг DB_IDEAS=1 (сейчас только стейдж).
 * Файлы вложений остаются на диске (server/data/idea-attachments/<id>/), в базе — только то,
 * что было в JSON (attachmentName / attachmentStored).
 * Формат API не меняется: source_keys + extra восстанавливают объект байт-в-байт.
 */
export const ideasSchema = pgSchema('ideas');

/** Идеи (бывш. ideas.json → ideas[]), порядок файла — position. */
export const ideas = ideasSchema.table(
  'ideas',
  {
    /** id как в JSON (idea-N). */
    id: text('id').primaryKey(),
    position: integer('position').notNull().default(0),
    authorUserId: integer('author_user_id'),
    authorName: text('author_name'),
    title: text('title'),
    description: text('description'),
    category: text('category'),
    city: text('city'),
    /** review | implementation | done | rejected. */
    status: text('status'),
    /** YYYY-MM-DD строкой, как в файле. */
    createdAt: text('created_at'),
    votesUp: integer('votes_up'),
    votesDown: integer('votes_down'),
    attachmentName: text('attachment_name'),
    attachmentStored: boolean('attachment_stored'),
    statusComment: text('status_comment'),
    statusChangedAt: timestamp('status_changed_at', { withTimezone: true, mode: 'date' }),
    sourceKeys: text('source_keys').array(),
    extra: json('extra').$type<Record<string, unknown>>(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index('ideas_author_idx').on(t.authorUserId), index('ideas_status_idx').on(t.status)]
);

/** Голоса (бывш. votesByUserId): строка на пользователя, votes — карта { "<idea id>": "up" | "down" } как в файле. */
export const ideaUserVotes = ideasSchema.table('user_votes', {
  userId: text('user_id').primaryKey(),
  position: integer('position').notNull().default(0),
  votes: json('votes').$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

/** Остальное содержимое файла (nextIdeaId, порядок ключей верхнего уровня). Одна строка id=1. */
export const ideasState = ideasSchema.table('state', {
  id: integer('id').primaryKey(),
  nextIdeaId: integer('next_idea_id'),
  sourceKeys: text('source_keys').array(),
  extra: json('extra').$type<Record<string, unknown>>(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

/** Разовые импорты из JSON: строка есть → импорт уже был, повторно не запускаем. */
export const ideasJsonImports = ideasSchema.table('json_imports', {
  source: text('source').primaryKey(),
  importedAt: timestamp('imported_at', { withTimezone: true }).notNull().defaultNow(),
  fileCount: integer('file_count').notNull(),
  inserted: integer('inserted').notNull(),
  skipped: integer('skipped').notNull()
});
