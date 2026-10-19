import { requireVbiSession } from '../../../../../utils/session';
import {
  findPair,
  findPlayer,
  mutatePitStop,
  setCheckpointStatus
} from '../../../../../utils/pitStopStore';
import { isCheckpointUnlocked, isPitStopGameStopped } from '../../../../../../app/events/pit-stop-14/timeline';
import { sessionActorEmployeeId } from '../../../../../utils/employeesStore';

/** Зажать / отпустить тумблер. Успех — оба держат одновременно. */
export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  if (isPitStopGameStopped() || !isCheckpointUnlocked(3)) {
    throw createError({ statusCode: 403, statusMessage: 'Чек-поинт закрыт' });
  }
  const body = await readBody<{ held?: boolean }>(event);
  const held = Boolean(body?.held);

  return mutatePitStop((state) => {
    const me = findPlayer(state, session.id);
    if (!me?.pairId) throw createError({ statusCode: 400, statusMessage: 'Нужна пара' });
    const pair = findPair(state, me.pairId);
    if (!pair) throw createError({ statusCode: 400, statusMessage: 'Пара не найдена' });

    const set = new Set(pair.ignitionHeldBy);
    if (held) set.add(session.id);
    else set.delete(session.id);
    pair.ignitionHeldBy = [...set];

    const both =
      set.has(pair.userIdA) && set.has(pair.userIdB) && pair.ignitionHeldBy.length >= 2;
    if (both) {
      const partner = findPlayer(
        state,
        session.id === pair.userIdA ? pair.userIdB : pair.userIdA
      );
      setCheckpointStatus(me, 3, 'done');
      if (partner) setCheckpointStatus(partner, 3, 'done');
      pair.ignitionHeldBy = [];
      return { ok: true, started: true, waitingPartner: false };
    }
    return {
      ok: true,
      started: false,
      waitingPartner: held && pair.ignitionHeldBy.length === 1
    };
  }, { actorEmployeeId: await sessionActorEmployeeId(session), reason: 'pit-stop:checkpoint-3' });
});
