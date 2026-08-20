import { readFile, mkdir } from 'node:fs/promises';
import { writeJsonAtomic } from './atomicJson';
import { dirname, join } from 'node:path';
import type { VpnKeyKind } from './wgEasyClient';
import { vpnLimitForKind } from './wgEasyClient';

const DATA_FILE = join(process.cwd(), 'server/data/vpn-keys.json');

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

async function ensureFile() {
  await mkdir(dirname(DATA_FILE), { recursive: true });
  try {
    await readFile(DATA_FILE, 'utf8');
  } catch {
    await writeJsonAtomic(DATA_FILE, { keys: [] } satisfies VpnKeysFile);
  }
}

export async function readVpnKeys(): Promise<StoredVpnKey[]> {
  await ensureFile();
  const raw = await readFile(DATA_FILE, 'utf8');
  try {
    const parsed = JSON.parse(raw) as VpnKeysFile;
    if (!parsed || !Array.isArray(parsed.keys)) return [];
    return parsed.keys.filter(
      (k) =>
        k &&
        typeof k.id === 'string' &&
        (k.kind === 'wireguard' || k.kind === 'amnezia') &&
        typeof k.userId === 'number' &&
        typeof k.clientName === 'string'
    );
  } catch {
    return [];
  }
}

async function writeVpnKeys(keys: StoredVpnKey[]) {
  await ensureFile();
  await writeJsonAtomic(DATA_FILE, { keys } satisfies VpnKeysFile);
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

export async function appendVpnKey(entry: StoredVpnKey): Promise<StoredVpnKey> {
  const keys = await readVpnKeys();
  if (keys.some((k) => k.id === entry.id)) {
    return entry;
  }
  keys.push(entry);
  await writeVpnKeys(keys);
  return entry;
}

/** Убрать из учёта пиры, которых уже нет в админке (после ручного удаления). Не трогает панель. */
export async function removeVpnKeysByIds(ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  const idSet = new Set(ids);
  const keys = await readVpnKeys();
  const next = keys.filter((k) => !idSet.has(k.id));
  const removed = keys.length - next.length;
  if (removed > 0) await writeVpnKeys(next);
  return removed;
}


/**
 * Имя пира в wg-easy:
 * - WireGuard: LastName_Belg_Aeza
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
    return `${surname}_Belg_Aeza`.slice(0, 64);
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

