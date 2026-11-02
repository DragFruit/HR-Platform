import { requireVbiSession } from '../../../utils/session';
import { ogonekNow } from '../../../utils/ogonekClock';
import {
  findOrCreateOgonekPlayer,
  mutateOgonek,
  readOgonekState,
  OGONEK_SNOWFLAKE_SIZE,
  OGONEK_TOY_SIZE
} from '../../../utils/ogonekStore';
import { buildDayViews, ogonekDebugAllOpen } from '../../../utils/ogonekGate';
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
  ogonekTodayDayId
} from '../../../../app/events/ogonek/timeline';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const now = ogonekNow();

  // Первый заход заводит игрока: состояние вилки и открытых окон должно
  // сохраняться с первого же действия.
  const player = await mutateOgonek((state) =>
    findOrCreateOgonekPlayer(state, session.id, session.name || 'Сотрудник', session.department || '')
  );

  const state = await readOgonekState();
  const days = buildDayViews(player, now);
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

  // Открытки приходят адресату; отправителя не знает даже получатель.
  const myThanks = state.thanks
    .filter((t) => t.toUserId === session.id)
    .map((t) => ({ id: t.id, text: t.text, createdAt: t.createdAt }));

  const letter = state.letters.find((l) => l.id === player.letterId);

  // Социальная заметность вместо наград (спека, раздел 4a): сколько человек
  // уже открыли сегодняшнее окно. Имён тут нет, только число.
  const openedTodayReal = todayId
    ? state.players.filter((p) => p.opened.includes(todayId)).length
    : 0;

  const feed = [...state.feed, ...demoFeed(now)]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 30);

  const toys = [...state.toys, ...demoToys()];
  const snowflakes = [...state.snowflakes, ...demoSnowflakes()];

  return {
    serverNow: now.toISOString(),
    partyAt: OGONEK_PARTY_AT,
    letterDeliveryAt: OGONEK_LETTER_DELIVERY_AT,
    debugAllOpen: ogonekDebugAllOpen(),
    demo: ogonekDemoAllowed(),
    micro: OGONEK_MICRO,
    awaitingLabel: OGONEK_AWAITING_LABEL,
    ranks: OGONEK_RANKS,
    toySize: OGONEK_TOY_SIZE,
    snowflakeSize: OGONEK_SNOWFLAKE_SIZE,
    todayId,
    openedToday: openedTodayReal + demoOpenedToday(),
    headcount: Math.max(state.players.length, demoOpenedToday() ? 70 : state.players.length),
    days,
    feed,
    recipes,
    thanks: myThanks,
    treeCount: toys.length,
    snowflakeCount: snowflakes.length,
    player: {
      userId: player.userId,
      name: player.name,
      department: player.department,
      opened: player.opened,
      rank: ogonekRankFor(player.opened.length),
      plugged: player.plugged,
      hat: player.hat,
      song: player.song ?? '',
      skating: Boolean(player.skating),
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
