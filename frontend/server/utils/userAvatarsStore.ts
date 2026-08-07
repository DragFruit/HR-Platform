import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const DATA_FILE = join(process.cwd(), 'server/data/user-avatars.json');

const AVATAR_ID_PATTERN = /^character_(0[1-9]|[12]\d|3[0-9]|40)$/;

export type UserAvatarsStore = Record<string, string>;

export function isAvatarCharacterId(value: string): boolean {
  return AVATAR_ID_PATTERN.test(value);
}

async function ensureFile() {
  await mkdir(dirname(DATA_FILE), { recursive: true });
  try {
    await readFile(DATA_FILE, 'utf8');
  } catch {
    await writeFile(DATA_FILE, JSON.stringify({}, null, 2), 'utf8');
  }
}

export async function readUserAvatars(): Promise<UserAvatarsStore> {
  await ensureFile();
  const raw = await readFile(DATA_FILE, 'utf8');
  try {
    const parsed = JSON.parse(raw) as UserAvatarsStore;
    if (!parsed || typeof parsed !== 'object') return {};
    const clean: UserAvatarsStore = {};
    for (const [userId, characterId] of Object.entries(parsed)) {
      if (typeof characterId === 'string' && isAvatarCharacterId(characterId)) {
        clean[userId] = characterId;
      }
    }
    return clean;
  } catch {
    return {};
  }
}

export async function writeUserAvatars(store: UserAvatarsStore): Promise<UserAvatarsStore> {
  await ensureFile();
  const clean: UserAvatarsStore = {};
  for (const [userId, characterId] of Object.entries(store)) {
    if (typeof characterId === 'string' && isAvatarCharacterId(characterId)) {
      clean[userId] = characterId;
    }
  }
  await writeFile(DATA_FILE, JSON.stringify(clean, null, 2), 'utf8');
  return clean;
}

export async function setUserAvatar(userId: number, characterId: string): Promise<UserAvatarsStore> {
  if (!isAvatarCharacterId(characterId)) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректный аватар' });
  }
  const store = await readUserAvatars();
  store[String(userId)] = characterId;
  return writeUserAvatars(store);
}

/** Удалить аватары по id пользователей (отложенный офбординг). */
export async function removeUserAvatars(userIds: number[]): Promise<number> {
  const ids = new Set(userIds.filter((id) => Number.isFinite(id) && id > 0).map(String));
  if (!ids.size) return 0;
  const store = await readUserAvatars();
  let removed = 0;
  for (const key of ids) {
    if (store[key]) {
      delete store[key];
      removed += 1;
    }
  }
  if (removed) await writeUserAvatars(store);
  return removed;
}
