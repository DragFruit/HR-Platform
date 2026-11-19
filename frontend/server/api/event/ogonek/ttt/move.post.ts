import { requireOgonekTttPlayer } from '../../../../utils/ogonekTttAuth';
import { tttMove, tttView } from '../../../../utils/ogonekTtt';

/** Ход: большое поле big и клетка small (0..8). Правила проверяет сервер. */
export default defineEventHandler(async (event) => {
  const me = await requireOgonekTttPlayer(event);
  const body = await readBody<{ id?: number; big?: number; small?: number }>(event);
  const id = Number(body?.id);
  const big = Number(body?.big);
  const small = Number(body?.small);
  if (![id, big, small].every(Number.isInteger) || big < 0 || big > 8 || small < 0 || small > 8) {
    throw createError({ statusCode: 400, statusMessage: 'bad move' });
  }
  return tttView(await tttMove(me.uid, id, { big, small }), me.uid);
});
