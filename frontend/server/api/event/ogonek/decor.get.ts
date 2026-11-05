import { getVbiSessionChecked } from '../../../utils/session';
import { ogonekClock } from '../../../utils/ogonekClock';
import { readOgonekState } from '../../../utils/ogonekStore';
import { demoSnowflakes } from '../../../utils/ogonekDemo';
import { OGONEK_DAY_IDS, ogonekDayScheduleOpen } from '../../../../app/events/ogonek/timeline';
import { ogonekFlakeSprite } from '../../../../app/events/ogonek/snowflake';

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
  if (!session) return { seasonOn: false, plugged: false, hat: false, everPlugged: false, authorFlakes: [] as string[][] };

  const clock = ogonekClock(event);
  const state = await readOgonekState();
  const player = state.players.find((p) => p.userId === session.id);

  const flakesOpen = clock.debugAllOpen || ogonekDayScheduleOpen(12, clock.now);
  // Снегопад платформы рисует сетками палитры, поэтому четверть сразу
  // отражаем в полный рисунок.
  const authorFlakes = flakesOpen
    ? [...state.snowflakes, ...demoSnowflakes()].slice(-24).map((s) => ogonekFlakeSprite(s.pixels))
    : [];

  // Декор идёт с 1 декабря: до старта адвента нечего зажигать.
  const seasonOn = clock.debugAllOpen || ogonekDayScheduleOpen(OGONEK_DAY_IDS[0]!, clock.now);

  return {
    seasonOn,
    plugged: Boolean(player?.plugged),
    hat: Boolean(player?.hat),
    everPlugged: Boolean(player?.plugged || player?.done.includes(4)),
    authorFlakes
  };
});
