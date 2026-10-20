import { getDb, isDbEnabled, type Db } from '../db/client';
import { createJsonKeyedListRepo, createPgKeyedListRepo, type KeyedListDef, type KeyedListRepo } from '../db/repositories/keyedList';
import {
  PROFILE_ACTIVITY_DEF,
  PROFILE_ACTIVITY_JSON_FILE,
  SALES_BEST_AWARDS_DEF,
  USER_AVATARS_DEF,
  VIBE_PASSWORDS_DEF,
  WISHLISTS_DEF,
  profileActivityJsonIo,
  salesBestJsonIo,
  userAvatarsJsonIo,
  vibePasswordsJsonIo,
  wishlistsJsonIo,
  type AvatarEntry,
  type ProfileActivityRaw,
  type SalesBestAwardRaw,
  type VibePasswordEntry,
  type WishlistEntry,
  normalizeProfileActivityKind
} from '../profile/domains';
import seed from '../data/profile-activity.json';

/**
 * Хранилища профиля (этап 6): аватары, лента активности, награды продаж, пароли Vibe.
 * DB_PROFILE=1 и задан DATABASE_URL → Postgres (схема profile), иначе JSON-файлы server/data.
 * Флаг стоит только на стейдже; на проде DATABASE_URL есть, но флага нет → JSON.
 * У каждого из четырёх своя готовность: сбой импорта одного файла не уводит на файлы остальные.
 * Публичный API сторов (userAvatarsStore, profileActivityStore, salesBestAwardsStore,
 * vibePasswordsStore) не менялся.
 */
export function profileDbFlag(): boolean {
  return String(process.env.DB_PROFILE || '').trim() === '1' && isDbEnabled();
}

function profileGate<T>(label: string, def: KeyedListDef<T>, makeJson: () => KeyedListRepo<T>) {
  let resolveReady!: (ok: boolean) => void;
  const ready = new Promise<boolean>((resolve) => {
    resolveReady = resolve;
  });
  let jsonRepo: KeyedListRepo<T> | null = null;
  let pgRepo: KeyedListRepo<T> | null = null;
  let warned = false;
  return {
    setReady: (ok: boolean) => resolveReady(ok),
    async repo(): Promise<KeyedListRepo<T>> {
      if (profileDbFlag()) {
        const ok = await ready;
        const db: Db | null = ok ? getDb() : null;
        if (db) return (pgRepo ??= createPgKeyedListRepo(db, def));
        if (!warned) {
          warned = true;
          console.error(`[profile] DB_PROFILE=1, но ${label} не на Postgres — работаем на JSON-файле`);
        }
      }
      return (jsonRepo ??= makeJson());
    }
  };
}

/** Начальная лента из git (server/data/profile-activity.json в сборке) — как было до этапа 6. */
export const profileActivitySeedItems = (): ProfileActivityRaw[] =>
  ((seed as { items?: ProfileActivityRaw[] }).items || []).map((row) => ({
    ...row,
    kind: normalizeProfileActivityKind(row.kind as string),
    source: row.source === 'manual' ? 'manual' : 'seed'
  }));

const avatars = profileGate<AvatarEntry>('аватары', USER_AVATARS_DEF, () => createJsonKeyedListRepo(userAvatarsJsonIo()));
const activity = profileGate<ProfileActivityRaw>('лента активности', PROFILE_ACTIVITY_DEF, () =>
  createJsonKeyedListRepo(profileActivityJsonIo(PROFILE_ACTIVITY_JSON_FILE, profileActivitySeedItems))
);
const salesBest = profileGate<SalesBestAwardRaw>('награды продаж', SALES_BEST_AWARDS_DEF, () =>
  createJsonKeyedListRepo(salesBestJsonIo())
);
const vibe = profileGate<VibePasswordEntry>('пароли Vibe', VIBE_PASSWORDS_DEF, () => createJsonKeyedListRepo(vibePasswordsJsonIo()));
const wishlist = profileGate<WishlistEntry>('вишлисты', WISHLISTS_DEF, () => createJsonKeyedListRepo(wishlistsJsonIo()));

export const userAvatarsRepo = avatars.repo;
export const profileActivityRepo = activity.repo;
export const salesBestAwardsRepo = salesBest.repo;
export const vibePasswordsRepo = vibe.repo;
export const wishlistsRepo = wishlist.repo;

/** Вызывает плагин db-migrate после импорта каждого файла. */
export const setUserAvatarsPgReady = avatars.setReady;
export const setProfileActivityPgReady = activity.setReady;
export const setSalesBestAwardsPgReady = salesBest.setReady;
export const setVibePasswordsPgReady = vibe.setReady;
export const setWishlistsPgReady = wishlist.setReady;

export function setAllProfilePgReady(ok: boolean) {
  avatars.setReady(ok);
  activity.setReady(ok);
  salesBest.setReady(ok);
  vibe.setReady(ok);
  wishlist.setReady(ok);
}

/** Где сейчас живёт каждый домен профиля (для /api/admin/db-health). */
export async function getProfileBackends() {
  return {
    userAvatars: (await avatars.repo()).backend,
    profileActivity: (await activity.repo()).backend,
    salesBestAwards: (await salesBest.repo()).backend,
    vibePasswords: (await vibe.repo()).backend,
    wishlists: (await wishlist.repo()).backend
  };
}
