import { requireOgonekTttPlayer } from '../../../../utils/ogonekTttAuth';
import { tttDraw, tttView } from '../../../../utils/ogonekTtt';

/** Ничья по согласию: предложить, принять или отклонить. */
export default defineEventHandler(async (event) => {
  const me = await requireOgonekTttPlayer(event);
  const body = await readBody<{ id?: number; action?: string }>(event);
  const action = body?.action === 'accept' || body?.action === 'decline' ? body.action : 'offer';
  return tttView(await tttDraw(me.uid, Number(body?.id), action), me.uid);
});
