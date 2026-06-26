import { requireRole } from '../../../../utils/requireRole';
import { markAttemptSeen } from '../../../../utils/adaptationStore';

export default defineEventHandler(async (event) => {
  await requireRole(event, ['admin', 'hr']);
  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Не указан id' });
  }
  const attempt = await markAttemptSeen(id);
  if (!attempt) {
    throw createError({ statusCode: 404, statusMessage: 'Попытка не найдена' });
  }
  return { ok: true, attempt };
});
