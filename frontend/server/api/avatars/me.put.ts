import { requireVbiSession } from '../../utils/session';
import { setUserAvatar } from '../../utils/userAvatarsStore';
import { sessionActorEmployeeId } from '../../utils/employeesStore';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const body = await readBody<{ characterId?: string }>(event);
  if (!body?.characterId) {
    throw createError({ statusCode: 400, statusMessage: 'Укажите characterId' });
  }

  const avatars = await setUserAvatar(session.id, body.characterId, {
    actorEmployeeId: await sessionActorEmployeeId(session)
  });
  return { ok: true, avatars };
});
