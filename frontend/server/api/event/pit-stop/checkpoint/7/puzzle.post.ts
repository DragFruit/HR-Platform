import { requireVbiSession } from '../../../../../utils/session';
import {
  findPair,
  findPlayer,
  mutatePitStop,
  partnerOf,
  setCheckpointStatus
} from '../../../../../utils/pitStopStore';
import { isCheckpointUnlocked, isPitStopGameStopped } from '../../../../../../app/events/pit-stop-14/timeline';
import { sessionActorEmployeeId } from '../../../../../utils/employeesStore';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  if (isPitStopGameStopped() || !isCheckpointUnlocked(7)) {
    throw createError({ statusCode: 403, statusMessage: 'Чек-поинт закрыт' });
  }
  const body = await readBody<{ cell?: number }>(event);
  const cell = Number(body?.cell);
  if (!Number.isInteger(cell) || cell < 0 || cell > 15) {
    throw createError({ statusCode: 400, statusMessage: 'Ячейка 0…15' });
  }

  return mutatePitStop((state) => {
    const me = findPlayer(state, session.id);
    if (!me?.pairId) throw createError({ statusCode: 400, statusMessage: 'Нужна пара' });
    const pair = findPair(state, me.pairId);
    if (!pair) throw createError({ statusCode: 400, statusMessage: 'Пара не найдена' });
    const { role } = partnerOf(pair, session.id);

    const partnerGlow = role === 'A' ? pair.puzzleGlowB : pair.puzzleGlowA;
    if (!partnerGlow.includes(cell)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Эта ячейка не горит у напарника'
      });
    }

    const mine = role === 'A' ? pair.puzzlePressedA : pair.puzzlePressedB;
    if (!mine.includes(cell)) mine.push(cell);
    if (role === 'A') pair.puzzlePressedA = mine;
    else pair.puzzlePressedB = mine;

    const aDone = pair.puzzleGlowB.every((c) => pair.puzzlePressedA.includes(c));
    const bDone = pair.puzzleGlowA.every((c) => pair.puzzlePressedB.includes(c));
    if (aDone && bDone) {
      const partner = findPlayer(state, role === 'A' ? pair.userIdB : pair.userIdA);
      setCheckpointStatus(me, 7, 'done');
      if (partner) setCheckpointStatus(partner, 7, 'done');
      return { ok: true, done: true };
    }
    return { ok: true, done: false, pressed: mine };
  }, { actorEmployeeId: await sessionActorEmployeeId(session), reason: 'pit-stop:checkpoint-7' });
});
