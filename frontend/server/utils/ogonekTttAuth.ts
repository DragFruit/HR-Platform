import type { H3Event } from 'h3';
import { requireVbiSession } from './session';
import { ogonekClock } from './ogonekClock';
import { readOgonekState } from './ogonekStore';
import { requireUnlockedDay } from './ogonekGate';
import { OGONEK_DAYS } from '../../app/events/ogonek/content';
import type { TttPlayer } from './ogonekTtt';

const TTT_DAY = OGONEK_DAYS.find((d) => d.kind === 'tictactoe')!.id;

/**
 * Игрок крестиков-ноликов: сотрудник из сессии платформы, у которого окно
 * с игрой уже открыто. Имя и отдел — как в адвенте.
 */
export async function requireOgonekTttPlayer(event: H3Event): Promise<TttPlayer> {
  const session = await requireVbiSession(event);
  const state = await readOgonekState();
  const player = state.players.find((p) => p.userId === session.id);
  if (!player) throw createError({ statusCode: 403, statusMessage: 'Сначала откройте адвент' });
  requireUnlockedDay(player, TTT_DAY, ogonekClock(event));
  return { uid: session.id, name: player.name, department: player.department };
}
