import { requireVbiSession } from '../../../../../utils/session';
import {
  findPlayer,
  mutatePitStop,
  readPitStop,
  setCheckpointStatus
} from '../../../../../utils/pitStopStore';
import { isCheckpointUnlocked, isPitStopGameStopped } from '../../../../../../app/events/pit-stop-14/timeline';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  if (isPitStopGameStopped() || !isCheckpointUnlocked(7)) {
    throw createError({ statusCode: 403, statusMessage: 'Чек-поинт закрыт' });
  }
  const body = await readBody<{ code?: string }>(event);
  const state = await readPitStop();
  const expected = state.easterCode.replace(/\s/g, '').toUpperCase();
  const got = String(body?.code || '')
    .trim()
    .replace(/\s/g, '')
    .toUpperCase();
  if (got !== expected) {
    throw createError({ statusCode: 400, statusMessage: 'Неверный код' });
  }

  return mutatePitStop((s) => {
    const me = findPlayer(s, session.id);
    if (!me) throw createError({ statusCode: 400, statusMessage: 'Сначала /join' });
    setCheckpointStatus(me, 7, 'done');
    return { ok: true };
  });
});
