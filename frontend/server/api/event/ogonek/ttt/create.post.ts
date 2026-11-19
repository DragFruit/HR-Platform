import { requireOgonekTttPlayer } from '../../../../utils/ogonekTttAuth';
import { tttCreate, tttView } from '../../../../utils/ogonekTtt';

/** Создать комнату: код на 6 символов, ждёт соперника 30 минут. */
export default defineEventHandler(async (event) => {
  const me = await requireOgonekTttPlayer(event);
  return tttView(await tttCreate(me), me.uid);
});
