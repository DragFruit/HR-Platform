import { requireVbiSession } from '../../utils/session';
import { listLiveUserVpnKeys } from '../../utils/vpnLiveKeys';
import { vpnLimitForKind, type VpnKeyKind } from '../../utils/wgEasyClient';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const query = getQuery(event);
  const kindRaw = typeof query.kind === 'string' ? query.kind : '';
  const kind = (kindRaw === 'wireguard' || kindRaw === 'amnezia' ? kindRaw : undefined) as
    | VpnKeyKind
    | undefined;

  const keys = await listLiveUserVpnKeys(session.id, kind);

  return {
    ok: true,
    limits: {
      wireguard: vpnLimitForKind('wireguard'),
      amnezia: vpnLimitForKind('amnezia')
    },
    keys
  };
});
