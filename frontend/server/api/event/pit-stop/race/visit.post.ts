import { requireVbiSession } from '../../../../utils/session';
import { recordRaceVisit } from '../../../../utils/pitStopRaceStore';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const { visit, created } = await recordRaceVisit({
    userId: session.id,
    name: session.name || 'Сотрудник'
  });
  return { ok: true, created, at: visit.at };
});
