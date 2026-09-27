import { requireVbiSession } from '../../../../../utils/session';
import {
  findPair,
  findPlayer,
  mutatePitStop,
  myCipherHalf,
  partnerOf,
  setCheckpointStatus
} from '../../../../../utils/pitStopStore';
import { isCheckpointUnlocked, isPitStopGameStopped } from '../../../../../../app/events/pit-stop-14/timeline';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  if (isPitStopGameStopped() || !isCheckpointUnlocked(1)) {
    throw createError({ statusCode: 403, statusMessage: 'Чек-поинт закрыт' });
  }
  const body = await readBody<{ code?: string }>(event);
  const raw = String(body?.code || '')
    .trim()
    .toUpperCase()
    .replace(/^VIBE_/, '')
    .replace(/[^A-Z0-9]/g, '');

  return mutatePitStop((state) => {
    const me = findPlayer(state, session.id);
    if (!me?.pairId) {
      throw createError({ statusCode: 400, statusMessage: 'Сначала нужна пара' });
    }
    const pair = findPair(state, me.pairId);
    if (!pair) throw createError({ statusCode: 400, statusMessage: 'Пара не найдена' });
    const { role } = partnerOf(pair, session.id);
    if (raw !== pair.cipher) {
      throw createError({
        statusCode: 400,
        statusMessage: `Неверный код. Твой фрагмент: ${myCipherHalf(pair, role)}`
      });
    }
    const partnerId = role === 'A' ? pair.userIdB : pair.userIdA;
    const partner = findPlayer(state, partnerId);
    setCheckpointStatus(me, 1, 'done');
    if (partner) setCheckpointStatus(partner, 1, 'done');
    return { ok: true };
  });
});
