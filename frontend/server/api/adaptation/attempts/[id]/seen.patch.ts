import { requireRole } from '../../../../utils/requireRole';
import { markAttemptSeen } from '../../../../utils/adaptationStore';
import { sessionActorEmployeeId } from '../../../../utils/employeesStore';

export default defineEventHandler(async (event) => {
  const session = await requireRole(event, ['admin', 'hr']);
  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Не указан id' });
  }
  const attempt = await markAttemptSeen(id, { actorEmployeeId: await sessionActorEmployeeId(session), reason: 'adaptation:attempt-seen' });
  if (!attempt) {
    throw createError({ statusCode: 404, statusMessage: 'Попытка не найдена' });
  }
  return { ok: true, attempt };
});
