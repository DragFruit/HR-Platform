import { requireVbiSession } from '../../../../utils/session';
import { recordRaceVisit } from '../../../../utils/pitStopRaceStore';

/** Админ только смотрит статистику — в игру не заходит. */
export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  if (session.role === 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Админу игра недоступна' });
  }
  const { visit, created } = await recordRaceVisit({
    userId: session.id,
    name: session.name || 'Сотрудник'
  });
  return { ok: true, created, at: visit.at };
});
