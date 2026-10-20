import { requireVbiSession } from '../../utils/session';
import { findEmployeeForSession } from '../../utils/employeesStore';
import { checkRateLimit } from '../../utils/simpleRateLimit';
import { saveWishlist } from '../../utils/wishlistsStore';

/**
 * Сохранить свой вишлист целиком: { items: [{ id?, text, url }] }.
 * Сотрудник берётся только из сессии — чужой вишлист этим запросом не поменять.
 */
export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const emp = await findEmployeeForSession(session);
  if (!emp) {
    throw createError({ statusCode: 404, statusMessage: 'Сотрудник не найден в справочнике' });
  }
  checkRateLimit(event, `wishlist-put:${emp.id}`, 30, 60_000);
  const body = await readBody<{ items?: unknown }>(event);
  return saveWishlist(emp.id, body?.items, { actorEmployeeId: emp.id });
});
