import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { accessDenylist } from '../db/schema';
import {
  isBool,
  isInt,
  isoTimestamp,
  isStr,
  mapFromColumns,
  mapToColumns,
  nullColumns,
  type FieldSpecs
} from '../db/fieldMapping';
import { createMutationQueue, writeJsonAtomic } from '../utils/atomicJson';
import type { CoreWriteContext } from './types';

export type AccessDenylistEntry = {
  bitrix_user_id?: number | null;
  platform_user_id?: number | null;
  email?: string;
  name?: string;
  employee_id?: number;
  revoked_at: string;
  reason?: string;
  /** Аватар удаляем через 14 дней после отзыва. */
  avatar_purge_at?: string;
  /** Отпуска удаляем через 1 год после отзыва. */
  vacations_purge_at?: string;
  /** Кошелёк / покупки магазина — 1 год (когда появятся серверные сторы). */
  wallet_purge_at?: string;
  purchases_purge_at?: string;
  avatar_purged?: boolean;
  vacations_purged?: boolean;
};

/**
 * Сырое хранилище стоп-листа доступа (этап 5). Логика (кого считать отозванным, каскад чисток)
 * — над ним, в utils/employeeAccessDenylist.ts, одна на оба бэкенда.
 */
export type AccessDenylistRepo = {
  backend: 'json' | 'postgres';
  read(): Promise<AccessDenylistEntry[]>;
  /**
   * Атомарное «прочитать → изменить → записать». fn получает копию и возвращает новый список
   * или null (ничего не менять). Правки строго по очереди; ошибка → ничего не записано.
   */
  mutate(fn: (entries: AccessDenylistEntry[]) => AccessDenylistEntry[] | null, ctx?: CoreWriteContext): Promise<void>;
};

export const ACCESS_DENYLIST_JSON_FILE = join(process.cwd(), 'server/data/employee-access-denylist.json');

type DenylistFile = { entries: AccessDenylistEntry[] };

/** Чтение без создания файла: нет файла → []. Битый файл → [] (как до этапа 5). */
export async function readAccessDenylistJson(file: string): Promise<AccessDenylistEntry[]> {
  let raw: string;
  try {
    raw = await readFile(file, 'utf8');
  } catch {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as DenylistFile;
    return Array.isArray(parsed.entries) ? parsed.entries : [];
  } catch {
    return [];
  }
}

export async function writeAccessDenylistJson(file: string, entries: AccessDenylistEntry[]): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  await writeJsonAtomic(file, { entries } satisfies DenylistFile);
}

/** server/data/employee-access-denylist.json — поведение до этапа 5 (прод и локалка). */
export function createJsonAccessDenylistRepo(file = ACCESS_DENYLIST_JSON_FILE): AccessDenylistRepo {
  const enqueue = createMutationQueue();
  async function read() {
    await mkdir(dirname(file), { recursive: true });
    try {
      await readFile(file, 'utf8');
    } catch {
      await writeAccessDenylistJson(file, []);
    }
    return readAccessDenylistJson(file);
  }
  return {
    backend: 'json',
    read,
    mutate: (fn) =>
      enqueue(async () => {
        const next = fn(await read());
        if (next) await writeAccessDenylistJson(file, next);
      })
  };
}

// ---------- маппинг для Postgres ----------

export type AccessDenylistRow = typeof accessDenylist.$inferInsert;

const intOrNull = (col: string) => ({ col, ok: isInt });

export const ACCESS_DENYLIST_FIELDS: FieldSpecs = {
  bitrix_user_id: intOrNull('bitrixUserId'),
  platform_user_id: intOrNull('platformUserId'),
  email: { col: 'email', ok: isStr },
  name: { col: 'name', ok: isStr },
  employee_id: intOrNull('employeeId'),
  revoked_at: isoTimestamp('revokedAt'),
  reason: { col: 'reason', ok: isStr },
  avatar_purge_at: isoTimestamp('avatarPurgeAt'),
  vacations_purge_at: isoTimestamp('vacationsPurgeAt'),
  wallet_purge_at: isoTimestamp('walletPurgeAt'),
  purchases_purge_at: isoTimestamp('purchasesPurgeAt'),
  avatar_purged: { col: 'avatarPurged', ok: isBool },
  vacations_purged: { col: 'vacationsPurged', ok: isBool }
};

/** null — не объект (такую запись не кладём, при импорте — skipped). id строки выдаёт база. */
export function denylistEntryToRow(item: unknown, position: number): AccessDenylistRow | null {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const { cols, sourceKeys, extra } = mapToColumns(item as Record<string, unknown>, ACCESS_DENYLIST_FIELDS);
  return {
    ...(nullColumns(ACCESS_DENYLIST_FIELDS) as Partial<AccessDenylistRow>),
    ...(cols as Partial<AccessDenylistRow>),
    position,
    sourceKeys,
    extra
  } as AccessDenylistRow;
}

export function rowToDenylistEntry(row: AccessDenylistRow | (typeof accessDenylist.$inferSelect)): AccessDenylistEntry {
  return mapFromColumns(
    row as Record<string, unknown>,
    ACCESS_DENYLIST_FIELDS,
    row.sourceKeys,
    row.extra as Record<string, unknown> | null
  ) as AccessDenylistEntry;
}

/** Метка записи для аудита (естественного ключа нет). */
export function denylistEntryLabel(e: AccessDenylistEntry): string {
  return String(e.employee_id ?? e.bitrix_user_id ?? e.platform_user_id ?? e.email ?? e.name ?? '');
}
