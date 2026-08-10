import { readFile, mkdir } from 'node:fs/promises';
import { writeJsonAtomic } from './atomicJson';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import seed from '../data/profile-activity.json';

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

export type ProfileActivitySource = 'manual' | 'seed' | 'auto';

export type ProfileActivity = {
  id: string;
  employee_id: number;
  platform_user_id?: number | null;
  kind: ProfileActivityKind;
  text: string;
  occurred_at: string;
  source: ProfileActivitySource;
  created_at: string;
  created_by_user_id?: number;
  created_by_name?: string;
};

type ActivityState = {
  items: ProfileActivity[];
};

const DATA_FILE = join(process.cwd(), 'server/data/profile-activity.json');

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

const emptyState = (): ActivityState => ({ items: [] });

const seedItems = (): ProfileActivity[] =>
  ((seed as { items?: ProfileActivity[] }).items || []).map((row) => ({
    ...row,
    kind: normalizeProfileActivityKind(row.kind),
    source: row.source === 'manual' ? 'manual' : 'seed'
  }));

async function ensureFile() {
  await mkdir(dirname(DATA_FILE), { recursive: true });
  try {
    await readFile(DATA_FILE, 'utf8');
  } catch {
    await writeJsonAtomic(DATA_FILE, { items: seedItems() });
  }
}

async function readState(): Promise<ActivityState> {
  await ensureFile();
  try {
    const raw = await readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<ActivityState>;
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    const normalized = (items.length ? items : seedItems()).map((row) => ({
      ...row,
      kind: normalizeProfileActivityKind(row.kind)
    }));
    return { items: normalized };
  } catch {
    return { items: seedItems() };
  }
}

async function writeState(state: ActivityState) {
  await ensureFile();
  await writeJsonAtomic(DATA_FILE, state);
}

export async function listProfileActivity(filters?: {
  employee_id?: number;
  platform_user_id?: number;
}): Promise<ProfileActivity[]> {
  const state = await readState();
  let list = [...state.items];
  if (filters?.employee_id) {
    list = list.filter((row) => row.employee_id === filters.employee_id);
  }
  if (filters?.platform_user_id) {
    list = list.filter(
      (row) =>
        row.platform_user_id === filters.platform_user_id ||
        row.employee_id === filters.platform_user_id
    );
  }
  return list.sort(
    (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
  );
}

export async function createProfileActivity(input: {
  employee_id: number;
  platform_user_id?: number | null;
  kind: string;
  text: string;
  occurred_at?: string;
  created_by_user_id: number;
  created_by_name: string;
}): Promise<ProfileActivity> {
  const text = String(input.text || '').trim();
  if (text.length < 3) {
    throw createError({ statusCode: 400, statusMessage: 'Текст — минимум 3 символа' });
  }
  if (!Number.isFinite(input.employee_id) || input.employee_id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Не указан сотрудник' });
  }

  let occurred = input.occurred_at ? new Date(input.occurred_at) : new Date();
  if (Number.isNaN(occurred.getTime())) occurred = new Date();

  const item: ProfileActivity = {
    id: randomUUID(),
    employee_id: input.employee_id,
    platform_user_id: input.platform_user_id ?? null,
    kind: normalizeProfileActivityKind(input.kind),
    text,
    occurred_at: occurred.toISOString(),
    source: 'manual',
    created_at: new Date().toISOString(),
    created_by_user_id: input.created_by_user_id,
    created_by_name: input.created_by_name
  };

  const state = await readState();
  state.items.push(item);
  await writeState(state);
  return item;
}

/** Идемпотентная авто-запись (например reveal ачивки) — по стабильному id. */
export async function upsertAutoProfileActivity(input: {
  id: string;
  employee_id: number;
  platform_user_id?: number | null;
  kind: string;
  text: string;
  occurred_at: string;
}): Promise<ProfileActivity> {
  const text = String(input.text || '').trim();
  if (text.length < 3) {
    throw createError({ statusCode: 400, statusMessage: 'Текст — минимум 3 символа' });
  }
  let occurred = new Date(input.occurred_at.includes('T') ? input.occurred_at : `${input.occurred_at}T12:00:00`);
  if (Number.isNaN(occurred.getTime())) occurred = new Date();

  const state = await readState();
  const existingIdx = state.items.findIndex((row) => row.id === input.id);
  const item: ProfileActivity = {
    id: input.id,
    employee_id: input.employee_id,
    platform_user_id: input.platform_user_id ?? null,
    kind: normalizeProfileActivityKind(input.kind),
    text,
    occurred_at: occurred.toISOString(),
    source: 'auto',
    created_at:
      existingIdx >= 0 ? state.items[existingIdx]!.created_at : new Date().toISOString(),
    created_by_name: 'system'
  };

  if (existingIdx >= 0) {
    state.items[existingIdx] = item;
  } else {
    state.items.push(item);
  }
  await writeState(state);
  return item;
}

export async function deleteProfileActivity(id: string): Promise<boolean> {
  const state = await readState();
  const next = state.items.filter((row) => row.id !== id);
  if (next.length === state.items.length) return false;
  state.items = next;
  await writeState(state);
  return true;
}

/** Удалить всю ленту профиля сотрудника (офбординг). */
export async function deleteProfileActivityForEmployee(ids: {
  employee_id?: number;
  platform_user_ids?: number[];
}): Promise<number> {
  const employeeId = ids.employee_id;
  const platformIds = new Set(
    (ids.platform_user_ids || []).filter((id) => Number.isFinite(id) && id > 0)
  );
  if (employeeId && employeeId > 0) platformIds.add(employeeId);

  const state = await readState();
  const before = state.items.length;
  state.items = state.items.filter((row) => {
    if (employeeId && row.employee_id === employeeId) return false;
    if (row.platform_user_id && platformIds.has(row.platform_user_id)) return false;
    if (platformIds.has(row.employee_id)) return false;
    return true;
  });
  const removed = before - state.items.length;
  if (removed) await writeState(state);
  return removed;
}
