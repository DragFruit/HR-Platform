import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { profileActivity, salesBestAwards, userAvatars, vibePasswords } from '../db/schema';
import { isInt, isoTimestamp, isStr, mapFromColumns, mapToColumns, nullColumns, type FieldSpecs } from '../db/fieldMapping';
import { writeJsonAtomic } from '../utils/atomicJson';
import type { KeyedListDef } from '../db/repositories/keyedList';

/**
 * Этап 6: четыре файла профиля → схема profile. Здесь — формат записей, маппинг «объект ↔ строка»
 * (source_keys + extra из db/fieldMapping.ts, объект из базы байт-в-байт как из файла)
 * и чтение/запись самих файлов (JSON-бэкенд: прод и локалка).
 */

const dataFile = (name: string) => join(process.cwd(), 'server/data', name);

export const USER_AVATARS_JSON_FILE = dataFile('user-avatars.json');
export const PROFILE_ACTIVITY_JSON_FILE = dataFile('profile-activity.json');
export const SALES_BEST_AWARDS_JSON_FILE = dataFile('sales-best-awards.json');
export const VIBE_PASSWORDS_JSON_FILE = dataFile('vibe-passwords.json');

/** pg_advisory_xact_lock на запись — у каждого домена свой (без взаимных блокировок). */
export const USER_AVATARS_LOCK_KEY = 72_461_011;
export const PROFILE_ACTIVITY_LOCK_KEY = 72_461_012;
export const SALES_BEST_AWARDS_LOCK_KEY = 72_461_013;
export const VIBE_PASSWORDS_LOCK_KEY = 72_461_014;

async function readJsonOr<T>(file: string, fallback: T): Promise<unknown> {
  let raw: string;
  try {
    raw = await readFile(file, 'utf8');
  } catch {
    return fallback;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/** Как до этапа 6: нет файла → создать с начальным содержимым. */
async function ensureFile(file: string, initial: () => unknown) {
  await mkdir(dirname(file), { recursive: true });
  try {
    await readFile(file, 'utf8');
  } catch {
    await writeJsonAtomic(file, initial());
  }
}

// ---------- аватары ----------

const AVATAR_ID_PATTERN = /^character_(0[1-9]|[12]\d|3[0-9]|40)$/;

export function isAvatarCharacterId(value: string): boolean {
  return AVATAR_ID_PATTERN.test(value);
}

/** Запись аватара: файл — объект { "<user id>": "character_NN" }, в репозитории — список пар. */
export type AvatarEntry = { user_id: string; character_id: string };

/** Карта из файла → чистые пары (как readUserAvatars до этапа 6: только character_01…40). */
export function avatarEntriesFromMap(parsed: unknown): AvatarEntry[] {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return [];
  const out: AvatarEntry[] = [];
  for (const [user_id, character_id] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof character_id === 'string' && isAvatarCharacterId(character_id)) out.push({ user_id, character_id });
  }
  return out;
}

export function avatarMapFromEntries(entries: AvatarEntry[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of entries) {
    if (typeof e.character_id === 'string' && isAvatarCharacterId(e.character_id)) out[e.user_id] = e.character_id;
  }
  return out;
}

export async function readUserAvatarsFile(file = USER_AVATARS_JSON_FILE): Promise<unknown> {
  return readJsonOr(file, {});
}

export const userAvatarsJsonIo = (file = USER_AVATARS_JSON_FILE) => ({
  async read() {
    await ensureFile(file, () => ({}));
    return avatarEntriesFromMap(await readJsonOr(file, {}));
  },
  async write(entries: AvatarEntry[]) {
    await ensureFile(file, () => ({}));
    await writeJsonAtomic(file, avatarMapFromEntries(entries));
  }
});

export const USER_AVATARS_DEF: KeyedListDef<AvatarEntry> = {
  table: userAvatars,
  keyProp: 'userId',
  lockKey: USER_AVATARS_LOCK_KEY,
  auditEntity: 'profile.user_avatar',
  logTag: 'avatars',
  touchUpdatedAt: true,
  toRow: (e, position) =>
    typeof e?.user_id === 'string' && typeof e.character_id === 'string'
      ? { userId: e.user_id, characterId: e.character_id, position }
      : null,
  fromRow: (r) => ({ user_id: r.userId as string, character_id: r.characterId as string })
};

// ---------- лента активности ----------

/** Канонические типы ленты «Недавняя активность». */
export type ProfileActivityKind =
  | 'store'
  | 'talk'
  | 'learning'
  | 'idea'
  | 'achievement'
  | 'promotion'
  | 'mentor'
  | 'practice'
  | 'recognition'
  | 'welcome'
  | 'other';

export const PROFILE_ACTIVITY_KINDS: { id: ProfileActivityKind; label: string }[] = [
  { id: 'store', label: 'Магазин' },
  { id: 'talk', label: 'Выступление' },
  { id: 'learning', label: 'Обучение' },
  { id: 'idea', label: 'Идея' },
  { id: 'achievement', label: 'Достижение' },
  { id: 'promotion', label: 'Повышение' },
  { id: 'mentor', label: 'Наставник' },
  { id: 'practice', label: 'Практика' },
  { id: 'recognition', label: 'Признание' },
  { id: 'welcome', label: 'Велком' },
  { id: 'other', label: 'Другое' }
];

const KIND_IDS = new Set(PROFILE_ACTIVITY_KINDS.map((k) => k.id));

/** Старые id → канон (для сидов и уже сохранённых записей). */
export const normalizeProfileActivityKind = (raw: string): ProfileActivityKind => {
  const value = String(raw || '').trim();
  if (KIND_IDS.has(value as ProfileActivityKind)) return value as ProfileActivityKind;
  if (value === 'conference') return 'talk';
  if (value === 'tenure') return 'achievement';
  if (value === 'custom') return 'other';
  if (value === 'vacation') return 'other';
  return 'other';
};

/** Сырые записи ленты (нормализация kind и seed-fallback — в profileActivityStore, одна на оба бэкенда). */
export type ProfileActivityRaw = Record<string, unknown> & { id: string };

const ACTIVITY_FIELDS: FieldSpecs = {
  employee_id: { col: 'employeeId', ok: isInt },
  platform_user_id: { col: 'platformUserId', ok: isInt },
  kind: { col: 'kind', ok: isStr },
  text: { col: 'text', ok: isStr },
  occurred_at: isoTimestamp('occurredAt'),
  source: { col: 'source', ok: isStr },
  created_at: isoTimestamp('createdAt'),
  created_by_user_id: { col: 'createdByUserId', ok: isInt },
  created_by_name: { col: 'createdByName', ok: isStr }
};

export async function readProfileActivityFileItems(file = PROFILE_ACTIVITY_JSON_FILE): Promise<unknown[]> {
  const parsed = (await readJsonOr(file, {})) as { items?: unknown };
  return Array.isArray(parsed?.items) ? parsed.items : [];
}

export const profileActivityJsonIo = (file: string, seedItems: () => unknown[]) => ({
  async read() {
    await ensureFile(file, () => ({ items: seedItems() }));
    return (await readProfileActivityFileItems(file)) as ProfileActivityRaw[];
  },
  async write(items: ProfileActivityRaw[]) {
    await ensureFile(file, () => ({ items: seedItems() }));
    await writeJsonAtomic(file, { items });
  }
});

/** Общая часть для записей со строковым id (лента, награды). */
function stringIdDef(table: typeof profileActivity | typeof salesBestAwards, fields: FieldSpecs) {
  return {
    table,
    keyProp: 'id',
    touchUpdatedAt: true,
    toRow: (item: Record<string, unknown>, position: number) => {
      if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !item.id) return null;
      const { cols, sourceKeys, extra } = mapToColumns(item, fields, ['id']);
      return { ...nullColumns(fields), ...cols, id: item.id, position, sourceKeys, extra };
    },
    fromRow: (r: Record<string, unknown>) =>
      mapFromColumns(r, fields, r.sourceKeys as string[] | null, r.extra as Record<string, unknown> | null, { id: r.id })
  };
}

export const PROFILE_ACTIVITY_DEF: KeyedListDef<ProfileActivityRaw> = {
  ...stringIdDef(profileActivity, ACTIVITY_FIELDS),
  lockKey: PROFILE_ACTIVITY_LOCK_KEY,
  auditEntity: 'profile.activity',
  logTag: 'profile-activity'
} as unknown as KeyedListDef<ProfileActivityRaw>;

// ---------- награды «Лучший специалист продаж» ----------

export type SalesBestAwardRaw = Record<string, unknown> & { id: string };

const AWARD_FIELDS: FieldSpecs = {
  period: { col: 'period', ok: isStr },
  employee_id: { col: 'employeeId', ok: isInt },
  employee_name: { col: 'employeeName', ok: isStr },
  selected_at: isoTimestamp('selectedAt'),
  selected_by: { col: 'selectedBy', ok: isInt },
  reveal_on: { col: 'revealOn', ok: isStr },
  activity_id: { col: 'activityId', ok: isStr }
};

export async function readSalesBestFileAwards(file = SALES_BEST_AWARDS_JSON_FILE): Promise<unknown[]> {
  const parsed = (await readJsonOr(file, {})) as { awards?: unknown };
  return Array.isArray(parsed?.awards) ? parsed.awards : [];
}

export const salesBestJsonIo = (file = SALES_BEST_AWARDS_JSON_FILE) => ({
  async read() {
    await ensureFile(file, () => ({ awards: [] }));
    return (await readSalesBestFileAwards(file)) as SalesBestAwardRaw[];
  },
  async write(awards: SalesBestAwardRaw[]) {
    await ensureFile(file, () => ({ awards: [] }));
    await writeJsonAtomic(file, { awards });
  }
});

export const SALES_BEST_AWARDS_DEF: KeyedListDef<SalesBestAwardRaw> = {
  ...stringIdDef(salesBestAwards, AWARD_FIELDS),
  lockKey: SALES_BEST_AWARDS_LOCK_KEY,
  auditEntity: 'profile.sales_best_award',
  logTag: 'sales-best'
} as unknown as KeyedListDef<SalesBestAwardRaw>;

// ---------- пароли Vibe ----------

/**
 * Запись пароля Vibe. password_hash — scrypt, password_seal — aes-256-gcm (для показа владельцу).
 * Значения переносятся как есть и нигде не логируются.
 */
export type VibePasswordEntry = {
  employee_id: number;
  password_hash: string;
  password_seal?: string;
  updated_at: string;
};

const VIBE_FIELDS: FieldSpecs = {
  password_hash: { col: 'passwordHash', ok: isStr },
  password_seal: { col: 'passwordSeal', ok: isStr },
  updated_at: isoTimestamp('updatedAt')
};

/** Как до этапа 6: нет файла или битый → пустой список; файл при чтении не создаём. */
export async function readVibePasswordsFileEntries(file = VIBE_PASSWORDS_JSON_FILE): Promise<unknown[]> {
  const parsed = (await readJsonOr(file, null)) as { entries?: unknown } | null;
  return parsed && Array.isArray(parsed.entries) ? parsed.entries : [];
}

export const vibePasswordsJsonIo = (file = VIBE_PASSWORDS_JSON_FILE) => ({
  async read() {
    return (await readVibePasswordsFileEntries(file)) as VibePasswordEntry[];
  },
  async write(entries: VibePasswordEntry[]) {
    await mkdir(dirname(file), { recursive: true });
    await writeJsonAtomic(file, { entries });
  }
});

export const VIBE_PASSWORDS_DEF: KeyedListDef<VibePasswordEntry> = {
  table: vibePasswords,
  keyProp: 'employeeId',
  lockKey: VIBE_PASSWORDS_LOCK_KEY,
  auditEntity: 'profile.vibe_password',
  logTag: 'vibe-passwords',
  touchUpdatedAt: false,
  sensitive: true,
  toRow: (item, position) => {
    const e = item as unknown as Record<string, unknown>;
    if (!e || typeof e !== 'object' || !isInt(e.employee_id)) return null;
    const { cols, sourceKeys, extra } = mapToColumns(e, VIBE_FIELDS, ['employee_id']);
    return { ...nullColumns(VIBE_FIELDS), ...cols, employeeId: e.employee_id, position, sourceKeys, extra };
  },
  fromRow: (r) =>
    mapFromColumns(r, VIBE_FIELDS, r.sourceKeys as string[] | null, r.extra as Record<string, unknown> | null, {
      employee_id: r.employeeId
    }) as unknown as VibePasswordEntry,
  /** Только факт и кто: ни хеш, ни seal в аудит не попадают. */
  audit(change, reason) {
    const after = reason ? { reason } : null;
    if (change.kind === 'create') return { action: 'password_set', after };
    if (change.kind === 'delete') return { action: 'password_cleared', after };
    if (change.before.password_hash !== change.after.password_hash) return { action: 'password_set', after };
    if (change.before.password_seal !== change.after.password_seal) return { action: 'password_seal_added', after };
    return { action: 'password_touched', after };
  }
};
