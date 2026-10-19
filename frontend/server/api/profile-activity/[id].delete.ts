import { requireVbiSession } from '../../utils/session';
import { deleteProfileActivity } from '../../utils/profileActivityStore';
import { sessionActorEmployeeId } from '../../utils/employeesStore';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  if (session.role !== 'admin' && session.role !== 'hr') {
    throw createError({ statusCode: 403, statusMessage: 'Только admin/HR' });
  }

  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Не указан id' });
  }

  const ok = await deleteProfileActivity(id, { actorEmployeeId: await sessionActorEmployeeId(session) });
  if (!ok) {
    throw createError({ statusCode: 404, statusMessage: 'Запись не найдена' });
  }
  return { ok: true };
});
