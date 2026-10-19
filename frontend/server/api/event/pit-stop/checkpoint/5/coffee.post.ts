import { mkdir, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { requireVbiSession } from '../../../../../utils/session';
import {
  findPlayer,
  mutatePitStop,
  setCheckpointStatus
} from '../../../../../utils/pitStopStore';
import { isCheckpointUnlocked, isPitStopGameStopped } from '../../../../../../app/events/pit-stop-14/timeline';
import { sessionActorEmployeeId } from '../../../../../utils/employeesStore';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  if (isPitStopGameStopped() || !isCheckpointUnlocked(5)) {
    throw createError({ statusCode: 403, statusMessage: 'Чек-поинт закрыт' });
  }
  const form = await readMultipartFormData(event);
  const file = form?.find((p) => p.name === 'photo' && p.data && p.filename);
  if (!file?.data || !file.filename) {
    throw createError({ statusCode: 400, statusMessage: 'Нужен файл .jpg/.png' });
  }
  const ext = extname(file.filename).toLowerCase();
  if (ext !== '.jpg' && ext !== '.jpeg' && ext !== '.png') {
    throw createError({ statusCode: 400, statusMessage: 'Только .jpg или .png' });
  }

  const dir = join(process.cwd(), 'server/data/pit-stop-coffee');
  await mkdir(dir, { recursive: true });
  const stored = `coffee-${session.id}-${Date.now()}${ext === '.jpeg' ? '.jpg' : ext}`;
  await writeFile(join(dir, stored), file.data);

  return mutatePitStop((state) => {
    let me = findPlayer(state, session.id);
    if (!me) {
      throw createError({ statusCode: 400, statusMessage: 'Сначала /join' });
    }
    me.coffeePhotoPath = stored;
    me.coffeeApproved = false;
    setCheckpointStatus(me, 5, 'pending_review');
    return { ok: true, pending: true };
  }, { actorEmployeeId: await sessionActorEmployeeId(session), reason: 'pit-stop:checkpoint-5' });
});
