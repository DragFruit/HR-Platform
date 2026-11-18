import { requireVbiSession } from '../../../utils/session';
import { ogonekClock } from '../../../utils/ogonekClock';
import { getDeployAppEnv } from '../../../utils/appEnv';
import { findOrCreateOgonekPlayer, mutateOgonek } from '../../../utils/ogonekStore';
import { ogonekMailboxOpen } from '../../../utils/ogonekGate';
import { demoThanks } from '../../../utils/ogonekDemo';

/** Отметки коробки: показана, письмо вскрыто. Плюс сброс из панели отладки. */
export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const body = await readBody<{ kind?: string; id?: string }>(event).catch(
    () => ({}) as { kind?: string; id?: string }
  );
  const kind = String(body.kind || '');
  const isReset = kind === 'devReset';
  if (isReset && getDeployAppEnv() === 'production') {
    throw createError({ statusCode: 403, statusMessage: 'недоступно на бою' });
  }
  if (!isReset && !ogonekMailboxOpen(ogonekClock(event))) {
    throw createError({ statusCode: 403, statusMessage: 'коробка закрыта' });
  }

  return mutateOgonek((state) => {
    const player = findOrCreateOgonekPlayer(state, session.id, session.name || 'Сотрудник', session.department || '');
    const mine = [
      ...state.thanks.filter((t) => t.toUserId === session.id).map((t) => t.id),
      ...demoThanks().map((t) => t.id)
    ];
    if (isReset) {
      player.mailboxSeenCount = 0;
      player.thanksRead = [];
    } else if (kind === 'seen') {
      player.mailboxSeenCount = mine.length;
    } else if (kind === 'read') {
      const id = String(body.id || '');
      if (!mine.includes(id)) throw createError({ statusCode: 404, statusMessage: 'письмо не найдено' });
      if (!player.thanksRead.includes(id)) player.thanksRead.push(id);
    } else {
      throw createError({ statusCode: 400, statusMessage: 'unknown kind' });
    }
    return { ok: true };
  });
});
