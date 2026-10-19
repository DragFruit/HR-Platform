import { requireVbiSession } from '../../../../../utils/session';
import {
  findPlayer,
  mutatePitStop,
  setCheckpointStatus
} from '../../../../../utils/pitStopStore';
import { isCheckpointUnlocked, isPitStopGameStopped } from '../../../../../../app/events/pit-stop-14/timeline';
import { sessionActorEmployeeId } from '../../../../../utils/employeesStore';

/** Офис: код из QR. Удалёнка: кодовое слово из видео. */
export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  if (isPitStopGameStopped() || !isCheckpointUnlocked(8)) {
    throw createError({ statusCode: 403, statusMessage: 'Чек-поинт закрыт' });
  }
  const body = await readBody<{ code?: string; isRemote?: boolean }>(event);
  const code = String(body?.code || '')
    .trim()
    .toUpperCase();

  return mutatePitStop((state) => {
    const me = findPlayer(state, session.id);
    if (!me) throw createError({ statusCode: 400, statusMessage: 'Сначала /join' });
    if (typeof body?.isRemote === 'boolean') me.isRemote = body.isRemote;

    const officeOk = !me.isRemote && (code === 'PITSTOP14' || code === 'VIBE_CHECKERED');
    const remoteOk = me.isRemote && (code === '14YEARS' || code === 'VIBE_REMOTE_14');
    if (!officeOk && !remoteOk) {
      throw createError({
        statusCode: 400,
        statusMessage: me.isRemote
          ? 'Неверное кодовое слово из видео'
          : 'Неверный QR-код картодрома'
      });
    }
    setCheckpointStatus(me, 8, 'done');
    me.completedAt = new Date().toISOString();
    return { ok: true, isRemote: me.isRemote };
  }, { actorEmployeeId: await sessionActorEmployeeId(session), reason: 'pit-stop:checkpoint-8' });
});
