import { requireVbiSession } from '../../utils/session';
import { findEmployeeForSession } from '../../utils/employeesStore';
import { readWishlist } from '../../utils/wishlistsStore';

/** Свой вишлист (для редактора в настройках профиля). */
export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const emp = await findEmployeeForSession(session);
  if (!emp) {
    throw createError({ statusCode: 404, statusMessage: 'Сотрудник не найден в справочнике' });
  }
  return readWishlist(emp.id);
});
