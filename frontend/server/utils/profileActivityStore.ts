import { randomUUID } from 'node:crypto';
import { normalizeProfileActivityKind, type ProfileActivityKind, type ProfileActivityRaw } from '../profile/domains';
import type { KeyedListWriteContext } from '../db/repositories/keyedList';
import { profileActivityRepo, profileActivitySeedItems } from './profileStore';

export { PROFILE_ACTIVITY_KINDS, normalizeProfileActivityKind } from '../profile/domains';
export type { ProfileActivityKind } from '../profile/domains';

/**
 * Лента «Недавняя активность» в профиле. Этап 6: DB_PROFILE=1 → profile.activity,
 * иначе server/data/profile-activity.json. Логика (нормализация kind, пустая лента → сид из git)
 * — здесь, одна на оба бэкенда; все правки через repo().mutate (по очереди, атомарно).
 */
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

/** Как readState до этапа 6: пусто → сид, kind приводится к канону. */
function normalizeItems(items: ProfileActivityRaw[]): ProfileActivity[] {
  return (items.length ? items : profileActivitySeedItems()).map((row) => ({
    ...row,
    kind: normalizeProfileActivityKind(row.kind as string)
  })) as unknown as ProfileActivity[];
}

async function readItems(): Promise<ProfileActivity[]> {
  return normalizeItems(await (await profileActivityRepo()).read());
}

/**
 * Прочитать (нормализовать) → изменить → записать, строго по очереди. Как до этапа 6:
 * ничего не поменялось → ничего не пишем; поменялось → пишется весь нормализованный список
 * (в том числе сид, если лента была пуста).
 */
async function mutateItems<R>(fn: (items: ProfileActivity[]) => R, ctx: KeyedListWriteContext): Promise<R> {
  return (await profileActivityRepo()).mutate((raw) => {
    const items = normalizeItems(raw);
    const before = JSON.stringify(items);
    const result = fn(items);
    if (JSON.stringify(items) !== before) raw.splice(0, raw.length, ...(items as unknown as ProfileActivityRaw[]));
    return result;
  }, ctx);
}

export async function listProfileActivity(filters?: {
  employee_id?: number;
  platform_user_id?: number;
}): Promise<ProfileActivity[]> {
  let list = await readItems();
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

export async function createProfileActivity(
  input: {
    employee_id: number;
    platform_user_id?: number | null;
    kind: string;
    text: string;
    occurred_at?: string;
    created_by_user_id: number;
    created_by_name: string;
  },
  ctx: KeyedListWriteContext = {}
): Promise<ProfileActivity> {
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

  await mutateItems((items) => items.push(item), { reason: 'profile-activity-create', ...ctx });
  return item;
}

/** Идемпотентная авто-запись (например reveal ачивки) — по стабильному id. */
export async function upsertAutoProfileActivity(
  input: {
    id: string;
    employee_id: number;
    platform_user_id?: number | null;
    kind: string;
    text: string;
    occurred_at: string;
  },
  ctx: KeyedListWriteContext = {}
): Promise<ProfileActivity> {
  const text = String(input.text || '').trim();
  if (text.length < 3) {
    throw createError({ statusCode: 400, statusMessage: 'Текст — минимум 3 символа' });
  }
  let occurred = new Date(input.occurred_at.includes('T') ? input.occurred_at : `${input.occurred_at}T12:00:00`);
  if (Number.isNaN(occurred.getTime())) occurred = new Date();

  return mutateItems(
    (items) => {
      const existingIdx = items.findIndex((row) => row.id === input.id);
      const item: ProfileActivity = {
        id: input.id,
        employee_id: input.employee_id,
        platform_user_id: input.platform_user_id ?? null,
        kind: normalizeProfileActivityKind(input.kind),
        text,
        occurred_at: occurred.toISOString(),
        source: 'auto',
        created_at: existingIdx >= 0 ? items[existingIdx]!.created_at : new Date().toISOString(),
        created_by_name: 'system'
      };
      if (existingIdx >= 0) items[existingIdx] = item;
      else items.push(item);
      return item;
    },
    { reason: 'profile-activity-auto', ...ctx }
  );
}

export async function deleteProfileActivity(id: string, ctx: KeyedListWriteContext = {}): Promise<boolean> {
  return mutateItems(
    (items) => {
      const next = items.filter((row) => row.id !== id);
      if (next.length === items.length) return false;
      items.splice(0, items.length, ...next);
      return true;
    },
    { reason: 'profile-activity-delete', ...ctx }
  );
}

/** Удалить всю ленту профиля сотрудника (офбординг). */
export async function deleteProfileActivityForEmployee(
  ids: {
    employee_id?: number;
    platform_user_ids?: number[];
  },
  ctx: KeyedListWriteContext = {}
): Promise<number> {
  const employeeId = ids.employee_id;
  const platformIds = new Set(
    (ids.platform_user_ids || []).filter((id) => Number.isFinite(id) && id > 0)
  );
  if (employeeId && employeeId > 0) platformIds.add(employeeId);

  return mutateItems(
    (items) => {
      const next = items.filter((row) => {
        if (employeeId && row.employee_id === employeeId) return false;
        if (row.platform_user_id && platformIds.has(row.platform_user_id)) return false;
        if (platformIds.has(row.employee_id)) return false;
        return true;
      });
      const removed = items.length - next.length;
      if (removed) items.splice(0, items.length, ...next);
      return removed;
    },
    { reason: 'access-revoked', ...ctx }
  );
}
