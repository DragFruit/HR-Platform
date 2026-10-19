import { requireRole } from '../../../utils/requireRole';
import { setRaceCheatStatus, type PitStopCheatStatus } from '../../../utils/pitStopRaceStore';
import { sessionActorEmployeeId } from '../../../utils/employeesStore';

export default defineEventHandler(async (event) => {
  const session = await requireRole(event, ['admin']);
  const body = await readBody<{ userId?: unknown; status?: unknown }>(event);
  const userId = typeof body?.userId === 'number' ? body.userId : Number(body?.userId);
  const status = body?.status;
  if (!Number.isFinite(userId) || userId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'userId обязателен' });
  }
  if (status !== 'cleared' && status !== 'confirmed') {
    throw createError({ statusCode: 400, statusMessage: 'status: cleared | confirmed' });
  }
  const record = await setRaceCheatStatus(userId, status as PitStopCheatStatus, { actorEmployeeId: await sessionActorEmployeeId(session), reason: 'pit-stop-race:cheat-review' });
  if (!record) {
    throw createError({ statusCode: 404, statusMessage: 'Флаг не найден' });
  }
  return { ok: true, userId: record.userId, cheat: record.cheat };
});
