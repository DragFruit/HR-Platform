import type { Db } from '../db/client';
import { profileJsonImports } from '../db/schema';
import { importKeyedListFromJson, type KeyedImportResult } from '../db/repositories/keyedList';
import {
  PROFILE_ACTIVITY_DEF,
  PROFILE_ACTIVITY_JSON_FILE,
  SALES_BEST_AWARDS_DEF,
  SALES_BEST_AWARDS_JSON_FILE,
  USER_AVATARS_DEF,
  USER_AVATARS_JSON_FILE,
  VIBE_PASSWORDS_DEF,
  VIBE_PASSWORDS_JSON_FILE,
  WISHLISTS_DEF,
  WISHLISTS_JSON_FILE,
  avatarEntriesFromMap,
  readProfileActivityFileItems,
  readSalesBestFileAwards,
  readUserAvatarsFile,
  readVibePasswordsFileEntries,
  readWishlistsFile,
  wishlistEntriesFromFile
} from './domains';

/**
 * Разовые импорты этапа 6 (каждый — своя транзакция под advisory lock своего домена, маркер в
 * profile.json_imports, сверка поле-в-поле). Нет файла → 0 записей. Файлы не трогаем: остаются бэкапом.
 */

/**
 * user-avatars.json: в базу — то, что видел readUserAvatars (только character_01…40).
 * Невалидные значения он и раньше отбрасывал, они считаются в skipped.
 */
export async function importUserAvatarsFromJson(db: Db, file = USER_AVATARS_JSON_FILE): Promise<KeyedImportResult> {
  const parsed = await readUserAvatarsFile(file);
  const fileCount = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? Object.keys(parsed).length : 0;
  return importKeyedListFromJson(db, USER_AVATARS_DEF, {
    source: 'user-avatars.json',
    jsonImports: profileJsonImports,
    items: avatarEntriesFromMap(parsed),
    fileCount
  });
}

/** profile-activity.json → items как в файле (нормализация kind — при чтении, как раньше). */
export async function importProfileActivityFromJson(db: Db, file = PROFILE_ACTIVITY_JSON_FILE): Promise<KeyedImportResult> {
  return importKeyedListFromJson(db, PROFILE_ACTIVITY_DEF, {
    source: 'profile-activity.json',
    jsonImports: profileJsonImports,
    items: await readProfileActivityFileItems(file)
  });
}

export async function importSalesBestAwardsFromJson(db: Db, file = SALES_BEST_AWARDS_JSON_FILE): Promise<KeyedImportResult> {
  return importKeyedListFromJson(db, SALES_BEST_AWARDS_DEF, {
    source: 'sales-best-awards.json',
    jsonImports: profileJsonImports,
    items: await readSalesBestFileAwards(file)
  });
}

/** vibe-passwords.json: хеш и seal переносятся как есть; в логах и аудите — только счётчики. */
export async function importVibePasswordsFromJson(db: Db, file = VIBE_PASSWORDS_JSON_FILE): Promise<KeyedImportResult> {
  return importKeyedListFromJson(db, VIBE_PASSWORDS_DEF, {
    source: 'vibe-passwords.json',
    jsonImports: profileJsonImports,
    items: await readVibePasswordsFileEntries(file)
  });
}

/** wishlists.json (если был на JSON-бэкенде) → profile.wishlists. Нет файла → 0 записей. */
export async function importWishlistsFromJson(db: Db, file = WISHLISTS_JSON_FILE): Promise<KeyedImportResult> {
  const parsed = await readWishlistsFile(file);
  const raw = (parsed as { entries?: unknown } | null)?.entries;
  return importKeyedListFromJson(db, WISHLISTS_DEF, {
    source: 'wishlists.json',
    jsonImports: profileJsonImports,
    items: wishlistEntriesFromFile(parsed),
    fileCount: Array.isArray(raw) ? raw.length : 0
  });
}
