import type { VpnKeyKind } from './wgEasyClient';
import { vpnLimitForKind } from './wgEasyClient';
import type { KeyedListWriteContext } from '../db/repositories/keyedList';
import type { KeyedStateDef, RawState } from '../db/repositories/keyedState';
import { defineStateFile } from '../db/repositories/stateFile';
import { vpnJsonImports } from '../db/schema';
import { VPN_KEYS_STATE_DEF, assertVpnMetadataOnly, vpnDbFlag } from '../vpn/domain';

export type StoredVpnKey = {
  id: string;
  kind: VpnKeyKind;
  userId: number;
  userEmail: string;
  clientName: string;
  createdAt: string;
};

type VpnKeysFile = {
  keys: StoredVpnKey[];
};

/** Как до этапа 8: только валидные записи; не тот формат → пусто. */
export function normalizeVpnKeys(parsed: unknown): StoredVpnKey[] {
  const keys = parsed && typeof parsed === 'object' ? (parsed as Partial<VpnKeysFile>).keys : null;
  if (!Array.isArray(keys)) return [];
  return keys.filter(
    (k) =>
      k &&
      typeof k.id === 'string' &&
      (k.kind === 'wireguard' || k.kind === 'amnezia') &&
      typeof k.userId === 'number' &&
      typeof k.clientName === 'string'
  );
}

export const VPN_KEYS_STATE_FULL_DEF: KeyedStateDef = {
  ...VPN_KEYS_STATE_DEF,
  normalize: (raw) => ({ keys: normalizeVpnKeys(raw) })
};

/**
 * Этап 8: DB_VPN=1 и задан DATABASE_URL → Postgres (схема vpn, только метаданные), иначе
 * server/data/vpn-keys.json. Флаг стоит только на стейдже. Правки теперь строго по очереди.
 */
export const vpnKeysFile = defineStateFile({
  fileName: 'vpn-keys.json',
  label: 'учёт VPN-ключей',
  logTag: 'vpn-keys',
  flag: vpnDbFlag,
  def: VPN_KEYS_STATE_FULL_DEF,
  jsonImports: vpnJsonImports,
  defaultRaw: () => ({ keys: [] }) as unknown as RawState,
  // битый файл стор читал как пустой список
  onBadJson: () => ({ keys: [] }) as unknown as RawState,
  beforeImport: assertVpnMetadataOnly
});

export async function readVpnKeys(): Promise<StoredVpnKey[]> {
  return normalizeVpnKeys(await (await vpnKeysFile.repo()).read());
}

async function mutateVpnKeys<R>(fn: (keys: StoredVpnKey[]) => { keys: StoredVpnKey[]; result: R }, ctx: KeyedListWriteContext): Promise<R> {
  const repo = await vpnKeysFile.repo();
  return repo.mutate(async (raw) => {
    const out = fn(normalizeVpnKeys(raw));
    const next = { keys: out.keys } satisfies VpnKeysFile;
    if (repo.backend === 'postgres') assertVpnMetadataOnly(next);
    return { next: next as unknown as RawState, result: out.result };
  }, ctx);
}

export async function listUserVpnKeys(userId: number, kind?: VpnKeyKind): Promise<StoredVpnKey[]> {
  const all = await readVpnKeys();
  return all
    .filter((k) => k.userId === userId && (!kind || k.kind === kind))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function countUserVpnKeys(userId: number, kind: VpnKeyKind): Promise<number> {
  return (await listUserVpnKeys(userId, kind)).length;
}

export async function canIssueVpnKey(userId: number, kind: VpnKeyKind): Promise<boolean> {
  const count = await countUserVpnKeys(userId, kind);
  return count < vpnLimitForKind(kind);
}

export async function appendVpnKey(entry: StoredVpnKey, ctx: KeyedListWriteContext = {}): Promise<StoredVpnKey> {
  return mutateVpnKeys((keys) => {
    if (keys.some((k) => k.id === entry.id)) return { keys, result: entry };
    return { keys: [...keys, entry], result: entry };
  }, { reason: 'vpn:issue', ...ctx });
}

/** Убрать из учёта пиры, которых уже нет в админке (после ручного удаления). Не трогает панель. */
export async function removeVpnKeysByIds(ids: string[], ctx: KeyedListWriteContext = {}): Promise<number> {
  if (!ids.length) return 0;
  const idSet = new Set(ids);
  return mutateVpnKeys((keys) => {
    const next = keys.filter((k) => !idSet.has(k.id));
    return { keys: next, result: keys.length - next.length };
  }, { reason: 'vpn:remove', ...ctx });
}


/**
 * Имя пира в wg-easy:
 * Сервер: Бельгия 188.190.10.62, хостинг Ahost.
 * - WireGuard: LastName_Belg_Ahost
 * - AmneziaWG: LastName_Belg_Ahost, второй — LastName_Belg_Ahost_2
 *
 * LastName — фамилия в латинице (ASCII), чтобы имя peer'а/конфига не ломалось на русских символах.
 */
export function buildVpnClientName(
  _userId: number,
  kind: VpnKeyKind,
  slot: number,
  displayName: string,
  authSource?: 'demo' | 'bitrix' | string | null
): string {
  const surname = extractSurname(displayName, authSource) || 'User';
  if (kind === 'wireguard') {
    return `${surname}_Belg_Ahost`.slice(0, 64);
  }
  const base = `${surname}_Belg_Ahost`;
  const withSlot = slot > 1 ? `${base}_2` : base;
  return withSlot.slice(0, 64);
}

function transliterateRuToLat(value: string): string {
  // Небольшая и стабильная схема транслитерации для имён/фамилий:
  // цель — получить чистый ASCII (A-Za-z0-9_), чтобы не ловить проблемы в конфигах/файлах.
  const map: Record<string, string> = {
    а: 'a',
    б: 'b',
    в: 'v',
    г: 'g',
    д: 'd',
    е: 'e',
    ё: 'yo',
    ж: 'zh',
    з: 'z',
    и: 'i',
    й: 'y',
    к: 'k',
    л: 'l',
    м: 'm',
    н: 'n',
    о: 'o',
    п: 'p',
    р: 'r',
    с: 's',
    т: 't',
    у: 'u',
    ф: 'f',
    х: 'kh',
    ц: 'ts',
    ч: 'ch',
    ш: 'sh',
    щ: 'shch',
    ъ: '',
    ы: 'y',
    ь: '',
    э: 'e',
    ю: 'yu',
    я: 'ya'
  };

  let out = '';
  for (const ch of value) {
    const lower = ch.toLowerCase();
    const mapped = map[lower];
    if (mapped === undefined) {
      out += ch;
      continue;
    }
    // Простейшая поддержка заглавных: первая буква заменяемого слова делаем заглавной.
    if (ch === ch.toUpperCase() && mapped) {
      out += mapped[0]!.toUpperCase() + mapped.slice(1);
    } else {
      out += mapped;
    }
  }

  // Нормализация разделителей.
  out = out.replace(/[\s-]+/g, '_');
  return out;
}

function sanitizeNamePart(value: string): string {
  const latin = transliterateRuToLat(value);
  return latin.replace(/[^A-Za-z0-9_]/g, '').slice(0, 40);
}

/**
 * Фамилия для имени пира.
 * Bitrix: «Фамилия Имя» → первое слово.
 * Демо QA часто «Имя Фамилия» (… Тестов/Тестова) → последнее слово, если похоже на фамилию.
 */
export function extractSurname(
  displayName: string,
  authSource?: 'demo' | 'bitrix' | string | null
): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (authSource === 'bitrix' || parts.length === 1) {
    return sanitizeNamePart(parts[0]);
  }
  const last = parts[parts.length - 1];
  // Типичные окончания русских фамилий — в демо стоят в конце («Мария Тестова»)
  if (/([оеё]в|ин|ын|ский|цкая|ова|ева|ёва|ина|ына|ая|ой)$/i.test(last)) {
    return sanitizeNamePart(last);
  }
  return sanitizeNamePart(parts[0]);
}

