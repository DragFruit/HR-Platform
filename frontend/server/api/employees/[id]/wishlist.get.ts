import { requireVbiSession } from '../../../utils/session';
import { findEmployeeById, findEmployeeForSession } from '../../../utils/employeesStore';
import { readWishlist } from '../../../utils/wishlistsStore';

/**
 * Вишлист сотрудника для визитки: читать может любой вошедший сотрудник.
 * own=true — это мой вишлист (на визитке покажем «заполнить», даже если пусто).
 */
export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const id = Number(getRouterParam(event, 'id'));
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректный id сотрудника' });
  }
  const emp = await findEmployeeById(id);
  if (!emp) {
    throw createError({ statusCode: 404, statusMessage: 'Сотрудник не найден' });
  }
  const me = await findEmployeeForSession(session);
  const wishlist = await readWishlist(emp.id);
  return { ...wishlist, own: me?.id === emp.id };
});
