import { requireOgonekTttPlayer } from '../../../../utils/ogonekTttAuth';
import { tttJoin, tttView } from '../../../../utils/ogonekTtt';

/** Войти в комнату по коду. Кто ходит крестиками — жребий. */
export default defineEventHandler(async (event) => {
  const me = await requireOgonekTttPlayer(event);
  const body = await readBody<{ code?: string }>(event);
  const code = String(body?.code ?? '').trim();
  if (code.length !== 6) throw createError({ statusCode: 400, statusMessage: 'Код комнаты — 6 символов' });
  return tttView(await tttJoin(me, code), me.uid);
});
