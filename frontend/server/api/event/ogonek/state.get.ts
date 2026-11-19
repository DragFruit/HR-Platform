import { ogonekTttLeaders } from '../../../utils/ogonekTtt';
import { requireVbiSession } from '../../../utils/session';
import { getDeployAppEnv } from '../../../utils/appEnv';
import { ogonekClock } from '../../../utils/ogonekClock';
import {
  findOrCreateOgonekPlayer,
  mutateOgonek,
  readOgonekState,
  OGONEK_TOY_SIZE
} from '../../../utils/ogonekStore';
import { buildDayViews, ogonekSubmitOpen } from '../../../utils/ogonekGate';
import {
  demoFeed,
  demoOpenedToday,
  demoRecipes,
  demoSnowflakes,
  demoToys,
  ogonekDemoAllowed
} from '../../../utils/ogonekDemo';
import {
  OGONEK_AWAITING_LABEL,
  OGONEK_MICRO,
  OGONEK_RANKS,
  ogonekRankFor
} from '../../../../app/events/ogonek/content';
import {
  OGONEK_LETTER_DELIVERY_AT,
  OGONEK_PARTY_AT,
  ogonekDayScheduleOpen,
  ogonekTodayDayId,
  ogonekSantaOpen
} from '../../../../app/events/ogonek/timeline';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const clock = ogonekClock(event);
  const now = clock.now;

  // Файл пишем, только если игрок новый. Раньше запись шла на каждом
  // открытии экрана — полная перезапись файла со всей ёлкой и лентой.
  let state = await readOgonekState();
  let player = state.players.find((p) => p.userId === session.id);
  if (!player) {
    player = await mutateOgonek((s) =>
      findOrCreateOgonekPlayer(s, session.id, session.name || 'Сотрудник', session.department || '')
    );
    state = await readOgonekState();
  }

  const days = buildDayViews(player, clock);
  const todayId = ogonekTodayDayId(now);

  const recipes = [...state.recipes, ...demoRecipes()]
    .map((r) => ({
      id: r.id,
      name: r.name,
      department: r.department,
      title: r.title,
      text: r.text,
      votes: r.votes,
      mine: r.userId === session.id,
      myVote: player.recipeVote === r.id,
      demo: r.demo
    }))
    .sort((a, b) => b.votes - a.votes || a.title.localeCompare(b.title, 'ru'));

  const letter = state.letters.find((l) => l.id === player.letterId);

  // Социальная заметность вместо наград (спека, раздел 4a): сколько человек
  // уже открыли сегодняшнее окно. Имён тут нет, только число.
  const openedTodayReal = todayId
    ? state.players.filter((p) => p.opened.includes(todayId)).length
    : 0;

  const feed = [...state.feed, ...demoFeed(now)]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 30);

  // Сколько человек выбрали каждый образ: видно, не оденутся ли все одинаково.
  const dresscodeCounts: Record<string, number> = {};
  for (const p of state.players) {
    if (p.dresscode) dresscodeCounts[p.dresscode] = (dresscodeCounts[p.dresscode] ?? 0) + 1;
  }

  const toys = [...state.toys, ...demoToys()];
  const snowflakes = [...state.snowflakes, ...demoSnowflakes()];

  return {
    serverNow: now.toISOString(),
    partyAt: OGONEK_PARTY_AT,
    letterDeliveryAt: OGONEK_LETTER_DELIVERY_AT,
    debugAllOpen: clock.debugAllOpen,
    submitOpen: ogonekSubmitOpen(clock),
    // Тайный Санта: регистрация до конца 11 декабря и сколько уже записалось
    // Крестики-нолики: ссылка с токеном и таблица лидеров онлайн-партий
    ttt: (() => {
      const nameOf = (uid: string) => state.players.find((p) => String(p.userId) === uid)?.name;
      const leaders = ogonekTttLeaders(state.ttt?.matches ?? [], nameOf);
      const myIndex = leaders.findIndex((r) => r.uid === String(session.id));
      return {
        url: '/event/ogonek/ttt',
        games: state.ttt?.matches.length ?? 0,
        top: leaders.slice(0, 5).map((r) => ({ name: r.name, wins: r.wins, games: r.games, mine: r.uid === String(session.id) })),
        me: myIndex >= 0 ? { place: myIndex + 1, wins: leaders[myIndex]!.wins, games: leaders[myIndex]!.games } : null
      };
    })(),
    santaOpen: clock.debugAllOpen || ogonekSantaOpen(now),
    santaCount: state.players.filter((p) => p.santa).length,
    santaCounts: {
      classic: state.players.filter((p) => p.santa === 'classic').length,
      elephant: state.players.filter((p) => p.santa === 'elephant').length
    },
    devDay: clock.devDay,
    // Панель отладки показываем только вне боя.
    devTools: getDeployAppEnv() !== 'production',
    demo: ogonekDemoAllowed(),
    micro: OGONEK_MICRO,
    awaitingLabel: OGONEK_AWAITING_LABEL,
    ranks: OGONEK_RANKS,
    toySize: OGONEK_TOY_SIZE,
    todayId,
    openedToday: openedTodayReal + demoOpenedToday(),
    headcount: Math.max(state.players.length, demoOpenedToday() ? 70 : state.players.length),
    days,
    feed,
    recipes,
    dresscodeCounts,
    treeCount: toys.length,
    snowflakeCount: snowflakes.length,
    // Авторские снежинки для снегопада над календарём — с 16 декабря (окно 12),
    // как и в снегопаде платформы. Своя идёт первой и подсвечена.
    snowflakes:
      clock.debugAllOpen || ogonekDayScheduleOpen(12, now)
        ? [...snowflakes]
            .sort((a, b) => Number(b.userId === session.id) - Number(a.userId === session.id))
            .slice(0, 24)
            .map((f) => ({ name: f.name, pixels: f.pixels, mine: f.userId === session.id }))
        : [],
    player: {
      userId: player.userId,
      name: player.name,
      department: player.department,
      opened: player.opened,
      done: player.done,
      rank: ogonekRankFor(player.opened.length),
      plugged: player.plugged,
      hat: player.hat,
      song: player.song ?? '',
      skating: Boolean(player.skating),
      santa: player.santa ?? '',
      dresscode: player.dresscode ?? '',
      toy: toys.find((t) => t.id === player.toyId) ?? null,
      snowflake: snowflakes.find((s) => s.id === player.snowflakeId) ?? null,
      // Текст письма не отдаём никогда: оно запечатано до 30 июня.
      letter: letter ? { sealedAt: letter.createdAt, deliverAt: letter.deliverAt } : null,
      recipeId: player.recipeId ?? '',
      recipeVote: player.recipeVote ?? '',
      thanksSent: player.thanksSent
    }
  };
});
