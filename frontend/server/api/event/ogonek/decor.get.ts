import { getVbiSessionChecked } from '../../../utils/session';
import { ogonekNow } from '../../../utils/ogonekClock';
import { readOgonekState } from '../../../utils/ogonekStore';
import { demoSnowflakes } from '../../../utils/ogonekDemo';
import { ogonekDebugAllOpen } from '../../../utils/ogonekGate';
import { OGONEK_DAY_IDS, ogonekDayScheduleOpen } from '../../../../app/events/ogonek/timeline';

/**
 * Лёгкая ручка для декора платформы: её дёргает слой, который висит на всех
 * страницах, поэтому отдаём только то, что ему нужно — состояние вилки и
 * авторские снежинки для метели.
 *
 * Авторские снежинки подмешиваются в снегопад с 16 декабря (окно 12). До
 * этой даты летят только наши — так снегопад и «становится авторским
 * на глазах» (спека, раздел 3).
 */
export default defineEventHandler(async (event) => {
  const session = await getVbiSessionChecked(event);
  if (!session) return { plugged: false, hat: false, authorFlakes: [] as string[][] };

  const now = ogonekNow();
  const state = await readOgonekState();
  const player = state.players.find((p) => p.userId === session.id);

  const flakesOpen = ogonekDebugAllOpen() || ogonekDayScheduleOpen(12, now);
  const authorFlakes = flakesOpen
    ? [...state.snowflakes, ...demoSnowflakes()].slice(-24).map((s) => s.pixels)
    : [];

  // Декор идёт с 1 декабря: до старта адвента нечего зажигать.
  const seasonOn = ogonekDebugAllOpen() || ogonekDayScheduleOpen(OGONEK_DAY_IDS[0]!, now);

  return {
    seasonOn,
    plugged: Boolean(player?.plugged),
    hat: Boolean(player?.hat),
    authorFlakes
  };
});
