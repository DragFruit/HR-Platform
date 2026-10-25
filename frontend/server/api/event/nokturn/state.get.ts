import { requireVbiSession } from '../../../utils/session';
import { nokturnNow } from '../../../utils/nokturnClock';
import {
  findOrCreatePlayer,
  mutateNokturn,
  playerPoints,
  readNokturnPlayers,
  NOKTURN_MINIGAME_ATTEMPTS,
  NOKTURN_THREAD_LIMIT
} from '../../../utils/nokturnStore';
import { buildStageViews, isStageOpen } from '../../../utils/nokturnGate';
import {
  NOKTURN_ART,
  NOKTURN_FIXTURES,
  NOKTURN_FIXTURE_SUSPECT,
  NOKTURN_INVESTIGATOR,
  NOKTURN_MECHANICS_OPTIONS,
  NOKTURN_MECHANICS_QUESTION,
  NOKTURN_MICRO,
  NOKTURN_REVEAL,
  NOKTURN_SUSPECTS,
  NOKTURN_SUSPECT_ROLES
} from '../../../../app/events/nokturn/content';
import {
  NOKTURN_DEADLINE_AT,
  NOKTURN_STAGE_IDS,
  nokturnDeadlinePassed
} from '../../../../app/events/nokturn/timeline';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const now = nokturnNow();

  // Первый заход создаёт игрока — доска должна сохраняться с первого перетаскивания.
  const player = await mutateNokturn((state) =>
    findOrCreatePlayer(state, session.id, session.name || 'Сотрудник')
  );

  const revealed = nokturnDeadlinePassed(now);
  const stages = buildStageViews(player, now);

  // Портрет Фёдора меняется на андроида, когда у игрока открыт этап с заключением
  // экспертизы — не по календарю, иначе догоняющий увидит разоблачение до улики.
  const suspects = NOKTURN_SUSPECTS.map((s) => {
    const swap = s.photoAfterStage;
    const photo =
      swap && isStageOpen(player, swap.stage, now) ? swap.photo : s.photo;
    return { id: s.id, name: s.name, role: s.role, photo };
  });

  // Обстановка доски: портрет Фёдора подменяется тем же правилом, что в бюллетене.
  const photoById = new Map(suspects.map((s) => [s.id, s.photo]));
  const fixtures = NOKTURN_FIXTURES.map((f) => {
    const suspectId = NOKTURN_FIXTURE_SUSPECT[f.id];
    return { ...f, photo: suspectId ? photoById.get(suspectId) ?? f.photo : f.photo };
  });

  let reveal: unknown = null;
  if (revealed) {
    const players = await readNokturnPlayers();
    const votesByStage = NOKTURN_STAGE_IDS.map((id) => {
      const counts: Record<string, number> = {};
      for (const s of NOKTURN_SUSPECTS) counts[s.id] = 0;
      for (const p of players) {
        const v = p.stages[String(id)]?.vote;
        if (v && counts[v.suspectId] !== undefined) counts[v.suspectId] += 1;
      }
      return { stage: id, counts };
    });
    const leaderboard = players
      .map((p) => ({ userId: p.userId, name: p.name, points: playerPoints(p) }))
      .filter((r) => r.points > 0)
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, 'ru'))
      .slice(0, 50);
    reveal = {
      text: NOKTURN_REVEAL,
      roles: NOKTURN_SUSPECT_ROLES,
      votesByStage,
      leaderboard
    };
  }

  return {
    serverNow: now.toISOString(),
    deadlineAt: NOKTURN_DEADLINE_AT,
    deadlinePassed: revealed,
    threadLimit: NOKTURN_THREAD_LIMIT,
    minigameAttempts: NOKTURN_MINIGAME_ATTEMPTS,
    micro: NOKTURN_MICRO,
    suspects,
    fixtures,
    art: NOKTURN_ART,
    investigator: NOKTURN_INVESTIGATOR,
    mechanics: {
      question: NOKTURN_MECHANICS_QUESTION,
      options: NOKTURN_MECHANICS_OPTIONS,
      answered: player.mechanics
        ? {
            optionId: player.mechanics.optionId,
            points: player.mechanics.points,
            at: player.mechanics.at
          }
        : null
    },
    player: {
      userId: player.userId,
      name: player.name,
      points: playerPoints(player),
      board: player.board
    },
    stages,
    reveal
  };
});
