import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Db } from '../db/client';
import { knowledgeArticles, knowledgeJsonImports, knowledgeState } from '../db/schema';
import {
  isInt,
  isoTimestamp,
  isStr,
  isStrArray,
  mapFromColumns,
  mapToColumns,
  nullColumns,
  type FieldSpecs
} from '../db/fieldMapping';
import type { KeyedListDef } from '../db/repositories/keyedList';
import {
  arrayPart,
  importStateFromJson,
  isPlainObject,
  type KeyedStateDef,
  type RawState,
  type StateImportResult
} from '../db/repositories/keyedState';
import { writeJsonAtomic } from '../utils/atomicJson';

/**
 * Этап 7: статьи базы знаний (server/data/knowledge-articles.json) → схема knowledge.
 * Маппинг «объект ↔ строка» (source_keys + extra), файл (JSON-бэкенд: прод и локалка), разовый импорт.
 * Нормализация (normalizeKnowledgeArticlesState) — в knowledgeArticlesStore, одна на оба бэкенда.
 * RAG-индекс (knowledge-rag-index.json) остаётся файлом-кэшем и сюда не относится.
 */

export const KNOWLEDGE_ARTICLES_JSON_FILE = join(process.cwd(), 'server/data/knowledge-articles.json');

/** pg_advisory_xact_lock на запись статей базы знаний. */
export const KNOWLEDGE_LOCK_KEY = 72_461_016;

export const defaultKnowledgeRaw = (): RawState => ({ articles: [], nextId: 1 });

const isArray = (v: unknown): v is unknown[] => Array.isArray(v);

const ARTICLE_FIELDS: FieldSpecs = {
  title: { col: 'title', ok: isStr },
  summary: { col: 'summary', ok: isStr },
  body: { col: 'body', ok: isStr },
  tags: { col: 'tags', ok: isStrArray },
  breadcrumbs: { col: 'breadcrumbs', ok: isStrArray },
  departments: { col: 'departments', ok: isStrArray },
  status: { col: 'status', ok: isStr },
  createdAt: isoTimestamp('createdAt'),
  updatedAt: isoTimestamp('updatedAt'),
  authorName: { col: 'authorName', ok: isStr },
  authorUserId: { col: 'authorUserId', ok: isInt },
  comments: { col: 'comments', ok: isArray },
  pendingRevision: { col: 'pendingRevision', ok: isPlainObject },
  approvedAt: isoTimestamp('approvedAt'),
  rejectionReason: { col: 'rejectionReason', ok: isStr },
  submittedAt: isoTimestamp('submittedAt'),
  closedAt: isoTimestamp('closedAt')
};

export const KNOWLEDGE_ARTICLE_DEF: KeyedListDef<Record<string, unknown>> = {
  table: knowledgeArticles,
  keyProp: 'id',
  lockKey: KNOWLEDGE_LOCK_KEY,
  auditEntity: 'knowledge.article',
  logTag: 'knowledge',
  // служебная row_updated_at ставится default now() при каждом upsert; updated_at — поле статьи
  touchUpdatedAt: false,
  toRow: (item, position) => {
    if (!isPlainObject(item) || typeof item.id !== 'string' || !item.id) return null;
    const { cols, sourceKeys, extra } = mapToColumns(item, ARTICLE_FIELDS, ['id']);
    return { ...nullColumns(ARTICLE_FIELDS), ...cols, id: item.id, position, sourceKeys, extra };
  },
  fromRow: (r) =>
    mapFromColumns(r, ARTICLE_FIELDS, r.sourceKeys as string[] | null, r.extra as Record<string, unknown> | null, { id: r.id })
};

export const KNOWLEDGE_STATE_DEF: Omit<KeyedStateDef, 'normalize'> = {
  lockKey: KNOWLEDGE_LOCK_KEY,
  logTag: 'knowledge',
  auditEntity: 'knowledge.state',
  metaTable: knowledgeState,
  metaFields: { nextId: { col: 'nextId', ok: isInt } },
  parts: [arrayPart('articles', KNOWLEDGE_ARTICLE_DEF)]
};

async function ensureFile(file: string) {
  await mkdir(dirname(file), { recursive: true });
  try {
    await readFile(file, 'utf8');
  } catch {
    await writeJsonAtomic(file, defaultKnowledgeRaw());
  }
}

/** Как до этапа 7: нет файла → создать пустой; битый JSON → ошибка. */
export const knowledgeJsonIo = (file = KNOWLEDGE_ARTICLES_JSON_FILE) => ({
  async read(): Promise<RawState> {
    await ensureFile(file);
    return JSON.parse(await readFile(file, 'utf8')) as RawState;
  },
  async write(raw: RawState) {
    await ensureFile(file);
    await writeJsonAtomic(file, raw);
  }
});

export async function importKnowledgeArticlesFromJson(
  db: Db,
  def: KeyedStateDef,
  file = KNOWLEDGE_ARTICLES_JSON_FILE
): Promise<StateImportResult> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(file, 'utf8'));
  } catch (err: any) {
    if (err?.code !== 'ENOENT') throw err;
    raw = defaultKnowledgeRaw();
  }
  return importStateFromJson(db, def, { source: 'knowledge-articles.json', jsonImports: knowledgeJsonImports, raw });
}
