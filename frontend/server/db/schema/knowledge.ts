import { index, integer, json, pgSchema, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Схема `knowledge` — статьи базы знаний (этап 7, бывш. server/data/knowledge-articles.json).
 * Флаг DB_KNOWLEDGE=1 (сейчас только стейдж). RAG-индекс (knowledge-rag-index.json) остаётся
 * файлом-кэшем, фото оценок страниц — на диске. Комментарии и правка на проверке хранятся
 * в строке статьи как в файле (json). Формат API не меняется: source_keys + extra.
 */
export const knowledgeSchema = pgSchema('knowledge');

/** Статьи (бывш. knowledge-articles.json → articles[]), порядок файла — position. */
export const knowledgeArticles = knowledgeSchema.table(
  'articles',
  {
    /** id как в JSON (kb-NNNNN). */
    id: text('id').primaryKey(),
    position: integer('position').notNull().default(0),
    title: text('title'),
    summary: text('summary'),
    body: text('body'),
    tags: text('tags').array(),
    breadcrumbs: text('breadcrumbs').array(),
    /** Кому видна: [] — всей компании. */
    departments: text('departments').array(),
    /** draft | pending_review | published | revision_requested | rejected (legacy review). */
    status: text('status'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }),
    authorName: text('author_name'),
    authorUserId: integer('author_user_id'),
    /** Инлайн-комментарии руководителя, как в файле. */
    comments: json('comments').$type<unknown[]>(),
    /** Правка опубликованной статьи на проверке, как в файле. */
    pendingRevision: json('pending_revision').$type<Record<string, unknown>>(),
    approvedAt: timestamp('approved_at', { withTimezone: true, mode: 'date' }),
    rejectionReason: text('rejection_reason'),
    submittedAt: timestamp('submitted_at', { withTimezone: true, mode: 'date' }),
    closedAt: timestamp('closed_at', { withTimezone: true, mode: 'date' }),
    sourceKeys: text('source_keys').array(),
    extra: json('extra').$type<Record<string, unknown>>(),
    /** Когда строка менялась в базе (служебное, не updatedAt статьи). */
    rowUpdatedAt: timestamp('row_updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index('knowledge_articles_status_idx').on(t.status), index('knowledge_articles_author_idx').on(t.authorUserId)]
);

/** Остальное содержимое файла (nextId, порядок ключей верхнего уровня). Одна строка id=1. */
export const knowledgeState = knowledgeSchema.table('state', {
  id: integer('id').primaryKey(),
  nextId: integer('next_id'),
  sourceKeys: text('source_keys').array(),
  extra: json('extra').$type<Record<string, unknown>>(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

/** Разовые импорты из JSON: строка есть → импорт уже был, повторно не запускаем. */
export const knowledgeJsonImports = knowledgeSchema.table('json_imports', {
  source: text('source').primaryKey(),
  importedAt: timestamp('imported_at', { withTimezone: true }).notNull().defaultNow(),
  fileCount: integer('file_count').notNull(),
  inserted: integer('inserted').notNull(),
  skipped: integer('skipped').notNull()
});
