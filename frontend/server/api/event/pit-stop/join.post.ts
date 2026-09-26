import { requireVbiSession } from '../../../utils/session';
import {
  createPair,
  emptyPlayer,
  findPlayer,
  mutatePitStop
} from '../../../utils/pitStopStore';

/**
 * Временный join: если передан partnerUserId — создаём/находим пару.
 * Без партнёра — регистрируем игрока в пуле (админ сведёт позже).
 */
export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const body = await readBody<{ partnerUserId?: number; isRemote?: boolean }>(event).catch(() => ({}));

  return mutatePitStop((state) => {
    let me = findPlayer(state, session.id);
    if (!me) {
      me = emptyPlayer(session.id, session.name || 'Сотрудник');
      state.players.push(me);
    }
    me.name = session.name || me.name;
    if (typeof body.isRemote === 'boolean') me.isRemote = body.isRemote;

    const partnerId = Number(body.partnerUserId);
    if (Number.isFinite(partnerId) && partnerId > 0 && partnerId !== session.id) {
      let partner = findPlayer(state, partnerId);
      if (!partner) {
        partner = emptyPlayer(partnerId, `Игрок ${partnerId}`);
        state.players.push(partner);
      }
      if (me.pairId && partner.pairId && me.pairId === partner.pairId) {
        return { ok: true, pairId: me.pairId, already: true };
      }
      if (me.pairId || partner.pairId) {
        throw createError({
          statusCode: 409,
          statusMessage: 'Один из игроков уже в другой паре'
        });
      }
      const pair = createPair(
        { id: me.userId, name: me.name },
        { id: partner.userId, name: partner.name }
      );
      state.pairs.push(pair);
      me.pairId = pair.id;
      me.role = 'A';
      partner.pairId = pair.id;
      partner.role = 'B';
      return { ok: true, pairId: pair.id };
    }

    return { ok: true, pairId: me.pairId, waiting: !me.pairId };
  });
});
