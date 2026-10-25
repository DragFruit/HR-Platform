import type { KeyedListWriteContext } from '../db/repositories/keyedList';
import type { WishlistEntry } from '../profile/domains';
import { validateWishlistInput, WishlistValidationError, type WishlistItem } from '../../app/utils/wishlist';
import { wishlistsRepo } from './profileStore';

/**
 * Вишлисты сотрудников. DB_PROFILE=1 → profile.wishlists, иначе server/data/wishlists.json.
 * Читать может любой вошедший сотрудник, менять — только владелец (проверка в API).
 */

export type WishlistView = { employee_id: number; items: WishlistItem[]; updated_at: string | null };

export async function readWishlist(employeeId: number): Promise<WishlistView> {
  const entries = await (await wishlistsRepo()).read();
  const found = entries.find((e) => e.employee_id === employeeId);
  return { employee_id: employeeId, items: found?.items ?? [], updated_at: found?.updated_at ?? null };
}

/** Полная замена вишлиста владельца. Пустой список удаляет запись. Ошибка проверки → 400. */
export async function saveWishlist(
  employeeId: number,
  rawItems: unknown,
  ctx: KeyedListWriteContext = {}
): Promise<WishlistView> {
  let items: WishlistItem[];
  try {
    items = validateWishlistInput(rawItems);
  } catch (err) {
    if (err instanceof WishlistValidationError) {
      throw createError({ statusCode: 400, statusMessage: err.message });
    }
    throw err;
  }
  const updatedAt = new Date().toISOString();
  await (await wishlistsRepo()).mutate(
    (entries: WishlistEntry[]) => {
      const idx = entries.findIndex((e) => e.employee_id === employeeId);
      if (!items.length) {
        if (idx >= 0) entries.splice(idx, 1);
        return;
      }
      const next: WishlistEntry = { employee_id: employeeId, items, updated_at: updatedAt };
      if (idx >= 0) {
        if (JSON.stringify(entries[idx]!.items) === JSON.stringify(items)) return;
        entries[idx] = next;
      } else entries.push(next);
    },
    { reason: 'self-wishlist-set', ...ctx }
  );
  return readWishlist(employeeId);
}
