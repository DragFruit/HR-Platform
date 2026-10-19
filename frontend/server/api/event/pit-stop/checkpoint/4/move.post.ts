import { requireVbiSession } from '../../../../../utils/session';
import {
  findPair,
  findPlayer,
  mutatePitStop,
  setCheckpointStatus
} from '../../../../../utils/pitStopStore';
import { isCheckpointUnlocked, isPitStopGameStopped } from '../../../../../../app/events/pit-stop-14/timeline';
import { sessionActorEmployeeId } from '../../../../../utils/employeesStore';

const FINISH_X = 4;
const FINISH_Y = 4;
const LIMIT_MS = 45_000;

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  if (isPitStopGameStopped() || !isCheckpointUnlocked(4)) {
    throw createError({ statusCode: 403, statusMessage: 'Чек-поинт закрыт' });
  }
  const body = await readBody<{ dir?: 'left' | 'up' | 'right'; start?: boolean }>(event);

  return mutatePitStop((state) => {
    const me = findPlayer(state, session.id);
    if (!me?.pairId) throw createError({ statusCode: 400, statusMessage: 'Нужна пара' });
    const pair = findPair(state, me.pairId);
    if (!pair) throw createError({ statusCode: 400, statusMessage: 'Пара не найдена' });

    const roleA = pair.userIdA === session.id;
    const myBlind =
      roleA
        ? pair.blindRoleA
        : pair.blindRoleA === 'navigator'
          ? 'pilot'
          : 'navigator';

    if (body?.start) {
      pair.blindStartedAt = new Date().toISOString();
      pair.blindX = 0;
      pair.blindY = 0;
      return { ok: true, x: 0, y: 0 };
    }

    if (myBlind !== 'pilot') {
      throw createError({ statusCode: 403, statusMessage: 'Двигает только пилот' });
    }
    if (!pair.blindStartedAt) {
      throw createError({ statusCode: 400, statusMessage: 'Сначала старт заезда' });
    }
    if (Date.now() - Date.parse(pair.blindStartedAt) > LIMIT_MS) {
      throw createError({ statusCode: 408, statusMessage: 'Время вышло (45 с)' });
    }

    if (body?.dir === 'left') pair.blindX = Math.max(0, pair.blindX - 1);
    if (body?.dir === 'right') pair.blindX = Math.min(6, pair.blindX + 1);
    if (body?.dir === 'up') pair.blindY = Math.min(6, pair.blindY + 1);

    const finished = pair.blindX === FINISH_X && pair.blindY === FINISH_Y;
    if (finished) {
      const partner = findPlayer(state, roleA ? pair.userIdB : pair.userIdA);
      setCheckpointStatus(me, 4, 'done');
      if (partner) setCheckpointStatus(partner, 4, 'done');
    }
    return { ok: true, x: pair.blindX, y: pair.blindY, finished };
  }, { actorEmployeeId: await sessionActorEmployeeId(session), reason: 'pit-stop:checkpoint-4' });
});
