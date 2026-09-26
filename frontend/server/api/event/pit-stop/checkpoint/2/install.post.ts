import { requireVbiSession } from '../../../../../utils/session';
import {
  findPair,
  findPlayer,
  mutatePitStop,
  partnerOf,
  setCheckpointStatus
} from '../../../../../utils/pitStopStore';
import { PIT_STOP_ASSEMBLY_PARTS } from '../../../../../../app/events/pit-stop-14/copy';
import { isCheckpointUnlocked, isPitStopGameStopped } from '../../../../../../app/events/pit-stop-14/timeline';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  if (isPitStopGameStopped() || !isCheckpointUnlocked(2)) {
    throw createError({ statusCode: 403, statusMessage: 'Чек-поинт закрыт' });
  }

  return mutatePitStop((state) => {
    const me = findPlayer(state, session.id);
    if (!me?.pairId) throw createError({ statusCode: 400, statusMessage: 'Нужна пара' });
    const pair = findPair(state, me.pairId);
    if (!pair) throw createError({ statusCode: 400, statusMessage: 'Пара не найдена' });
    if (me.checkpoints[1] !== 'done') {
      throw createError({ statusCode: 400, statusMessage: 'Сначала откройте бокс (точка 1)' });
    }
    const { role } = partnerOf(pair, session.id);
    if (pair.assemblyTurn !== role) {
      throw createError({ statusCode: 409, statusMessage: 'Сейчас ход напарника' });
    }
    if (pair.assemblyStep >= PIT_STOP_ASSEMBLY_PARTS.length) {
      return { ok: true, done: true, step: pair.assemblyStep };
    }
    pair.assemblyStep += 1;
    pair.assemblyTurn = role === 'A' ? 'B' : 'A';
    if (pair.assemblyStep >= PIT_STOP_ASSEMBLY_PARTS.length) {
      const partner = findPlayer(state, role === 'A' ? pair.userIdB : pair.userIdA);
      setCheckpointStatus(me, 2, 'done');
      if (partner) setCheckpointStatus(partner, 2, 'done');
      return { ok: true, done: true, step: pair.assemblyStep };
    }
    return {
      ok: true,
      done: false,
      step: pair.assemblyStep,
      nextTurn: pair.assemblyTurn,
      nextLabel: PIT_STOP_ASSEMBLY_PARTS[pair.assemblyStep]
    };
  });
});
