import { avatarEntriesFromMap, avatarMapFromEntries, isAvatarCharacterId, type AvatarEntry } from '../profile/domains';
import type { KeyedListWriteContext } from '../db/repositories/keyedList';
import { userAvatarsRepo } from './profileStore';

export { isAvatarCharacterId } from '../profile/domains';

/**
 * Аватары-персонажи пользователей. Этап 6: DB_PROFILE=1 → profile.user_avatars,
 * иначе server/data/user-avatars.json ({ "<user id>": "character_NN" }). API не менялся.
 */
export type UserAvatarsStore = Record<string, string>;

export async function readUserAvatars(): Promise<UserAvatarsStore> {
  return avatarMapFromEntries(await (await userAvatarsRepo()).read());
}

/** Заменить карту целиком (невалидные значения отбрасываются, как раньше). */
export async function writeUserAvatars(store: UserAvatarsStore, ctx: KeyedListWriteContext = {}): Promise<UserAvatarsStore> {
  const next = avatarEntriesFromMap(store);
  return (await userAvatarsRepo()).mutate((entries: AvatarEntry[]) => {
    entries.splice(0, entries.length, ...next);
    return avatarMapFromEntries(entries);
  }, ctx);
}

export async function setUserAvatar(
  userId: number,
  characterId: string,
  ctx: KeyedListWriteContext = {}
): Promise<UserAvatarsStore> {
  if (!isAvatarCharacterId(characterId)) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректный аватар' });
  }
  const key = String(userId);
  return (await userAvatarsRepo()).mutate(
    (entries) => {
      const existing = entries.find((e) => e.user_id === key);
      if (existing) existing.character_id = characterId;
      else entries.push({ user_id: key, character_id: characterId });
      return avatarMapFromEntries(entries);
    },
    { reason: 'avatar-set', ...ctx }
  );
}

/** Удалить аватары по id пользователей (отложенный офбординг). */
export async function removeUserAvatars(userIds: number[], ctx: KeyedListWriteContext = {}): Promise<number> {
  const ids = new Set(userIds.filter((id) => Number.isFinite(id) && id > 0).map(String));
  if (!ids.size) return 0;
  return (await userAvatarsRepo()).mutate(
    (entries) => {
      const before = entries.length;
      const kept = entries.filter((e) => !ids.has(e.user_id));
      entries.splice(0, entries.length, ...kept);
      return before - kept.length;
    },
    { reason: 'access-revoked:avatar-purge', ...ctx }
  );
}
