import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Db } from '../db/client';
import { ideaUserVotes, ideas, ideasJsonImports, ideasState } from '../db/schema';
import { isBool, isInt, isoTimestamp, isStr, mapFromColumns, mapToColumns, nullColumns, type FieldSpecs } from '../db/fieldMapping';
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
 * Этап 7: банк идей (server/data/ideas.json) → схема ideas. Маппинг «объект ↔ строка»
 * (source_keys + extra), чтение/запись файла (JSON-бэкенд: прод и локалка) и разовый импорт.
 * Нормализация (normalizeIdeasStoreState) — в ideasStore, одна на оба бэкенда.
 */

export const IDEAS_JSON_FILE = join(process.cwd(), 'server/data/ideas.json');

/** pg_advisory_xact_lock на запись банка идей. */
export const IDEAS_LOCK_KEY = 72_461_015;

/** Начальное содержимое файла (как defaultIdeasState до этапа 7). */
export const defaultIdeasRaw = (): RawState => ({ ideas: [], nextIdeaId: 1, votesByUserId: {} });

const IDEA_FIELDS: FieldSpecs = {
  authorUserId: { col: 'authorUserId', ok: isInt },
  authorName: { col: 'authorName', ok: isStr },
  title: { col: 'title', ok: isStr },
  description: { col: 'description', ok: isStr },
  category: { col: 'category', ok: isStr },
  city: { col: 'city', ok: isStr },
  status: { col: 'status', ok: isStr },
  createdAt: { col: 'createdAt', ok: isStr },
  votesUp: { col: 'votesUp', ok: isInt },
  votesDown: { col: 'votesDown', ok: isInt },
  attachmentName: { col: 'attachmentName', ok: isStr },
  attachmentStored: { col: 'attachmentStored', ok: isBool },
  statusComment: { col: 'statusComment', ok: isStr },
  statusChangedAt: isoTimestamp('statusChangedAt')
};

export const IDEA_DEF: KeyedListDef<Record<string, unknown>> = {
  table: ideas,
  keyProp: 'id',
  lockKey: IDEAS_LOCK_KEY,
  auditEntity: 'ideas.idea',
  logTag: 'ideas',
  touchUpdatedAt: true,
  toRow: (item, position) => {
    if (!isPlainObject(item) || typeof item.id !== 'string' || !item.id) return null;
    const { cols, sourceKeys, extra } = mapToColumns(item, IDEA_FIELDS, ['id']);
    return { ...nullColumns(IDEA_FIELDS), ...cols, id: item.id, position, sourceKeys, extra };
  },
  fromRow: (r) => mapFromColumns(r, IDEA_FIELDS, r.sourceKeys as string[] | null, r.extra as Record<string, unknown> | null, { id: r.id })
};

/** Голоса пользователя: { user_id, votes } ↔ строка user_votes (карта голосов как в файле). */
export type IdeaUserVotesEntry = { user_id: string; votes: Record<string, unknown> };

export const IDEA_VOTES_DEF: KeyedListDef<IdeaUserVotesEntry> = {
  table: ideaUserVotes,
  keyProp: 'userId',
  lockKey: IDEAS_LOCK_KEY,
  auditEntity: 'ideas.user_votes',
  logTag: 'ideas',
  touchUpdatedAt: true,
  toRow: (e, position) =>
    e && typeof e.user_id === 'string' && isPlainObject(e.votes) ? { userId: e.user_id, votes: e.votes, position } : null,
  fromRow: (r) => ({ user_id: r.userId as string, votes: r.votes as Record<string, unknown> })
};

export const IDEAS_STATE_DEF: Omit<KeyedStateDef, 'normalize'> = {
  lockKey: IDEAS_LOCK_KEY,
  logTag: 'ideas',
  auditEntity: 'ideas.state',
  metaTable: ideasState,
  metaFields: { nextIdeaId: { col: 'nextIdeaId', ok: isInt } },
  parts: [
    arrayPart('ideas', IDEA_DEF),
    {
      prop: 'votesByUserId',
      def: IDEA_VOTES_DEF,
      // карта { "<user id>": { "<idea id>": "up" | "down" } } → строки; не карта карт → extra как есть
      toItems: (v) =>
        isPlainObject(v) && Object.values(v).every(isPlainObject)
          ? Object.entries(v).map(([user_id, votes]) => ({ user_id, votes }))
          : null,
      fromItems: (items) => {
        const out: Record<string, unknown> = {};
        for (const e of items as IdeaUserVotesEntry[]) out[e.user_id] = e.votes;
        return out;
      }
    }
  ]
};

async function ensureFile(file: string) {
  await mkdir(dirname(file), { recursive: true });
  try {
    await readFile(file, 'utf8');
  } catch {
    await writeJsonAtomic(file, defaultIdeasRaw());
  }
}

/** Как до этапа 7: нет файла → создать пустой; битый JSON → ошибка. */
export const ideasJsonIo = (file = IDEAS_JSON_FILE) => ({
  async read(): Promise<RawState> {
    await ensureFile(file);
    return JSON.parse(await readFile(file, 'utf8')) as RawState;
  },
  async write(raw: RawState) {
    await ensureFile(file);
    await writeJsonAtomic(file, raw);
  }
});

/** Нет файла → импорт пустого состояния (как ensureFile). */
async function readIdeasFileForImport(file: string): Promise<unknown> {
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch {
    return defaultIdeasRaw();
  }
  return JSON.parse(text);
}

export async function importIdeasFromJson(
  db: Db,
  def: KeyedStateDef,
  file = IDEAS_JSON_FILE
): Promise<StateImportResult> {
  return importStateFromJson(db, def, { source: 'ideas.json', jsonImports: ideasJsonImports, raw: await readIdeasFileForImport(file) });
}
