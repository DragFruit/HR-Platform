import { requireOgonekTttPlayer } from '../../../../utils/ogonekTttAuth';
import { tttGet, tttView } from '../../../../utils/ogonekTtt';

/** Состояние комнаты: клиент опрашивает раз в секунду, пока идёт партия. */
export default defineEventHandler(async (event) => {
  const me = await requireOgonekTttPlayer(event);
  const id = Number(getQuery(event).id);
  if (!Number.isInteger(id) || id <= 0) throw createError({ statusCode: 400, statusMessage: 'id required' });
  return tttView(await tttGet(me.uid, id), me.uid);
});
