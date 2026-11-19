import { requireOgonekTttPlayer } from '../../../../utils/ogonekTttAuth';
import { ogonekTttLeaders, tttActiveRoom, tttLobby, tttView } from '../../../../utils/ogonekTtt';
import { readOgonekState } from '../../../../utils/ogonekStore';

/** Экран игры: моя активная комната, открытые комнаты коллег и лидеры. */
export default defineEventHandler(async (event) => {
  const me = await requireOgonekTttPlayer(event);
  const [active, lobby, state] = await Promise.all([tttActiveRoom(me.uid), tttLobby(me.uid), readOgonekState()]);
  const nameOf = (uid: string) => state.players.find((p) => String(p.userId) === uid)?.name;
  const leaders = ogonekTttLeaders(state.ttt?.matches ?? [], nameOf);
  return {
    me: { name: me.name },
    active: active ? tttView(active, me.uid) : null,
    lobby,
    leaders: leaders.slice(0, 10).map((r, i) => ({ place: i + 1, name: r.name, wins: r.wins, draws: r.draws, losses: r.losses, mine: r.uid === String(me.uid) })),
    myPlace: (() => {
      const i = leaders.findIndex((r) => r.uid === String(me.uid));
      return i >= 0 ? { place: i + 1, ...leaders[i]! } : null;
    })()
  };
});
