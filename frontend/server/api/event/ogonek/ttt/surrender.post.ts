import { requireOgonekTttPlayer } from '../../../../utils/ogonekTttAuth';
import { tttSurrender, tttView } from '../../../../utils/ogonekTtt';

/** Сдаться (или закрыть свою пустую комнату). */
export default defineEventHandler(async (event) => {
  const me = await requireOgonekTttPlayer(event);
  const body = await readBody<{ id?: number }>(event);
  return tttView(await tttSurrender(me.uid, Number(body?.id)), me.uid);
});
