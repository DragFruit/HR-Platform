import { requireVbiSession } from '../../utils/session';
import {
  appendVpnKey,
  buildVpnClientName
} from '../../utils/vpnKeysStore';
import { listLiveUserVpnKeys } from '../../utils/vpnLiveKeys';
import { sessionActorEmployeeId } from '../../utils/employeesStore';
import {
  createWgClient,
  getWgClientBundle,
  panelForKind,
  vpnLimitForKind
} from '../../utils/wgEasyClient';

type Body = {
  kind?: string;
};

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const body = (await readBody<Body>(event).catch(() => ({}))) || {};
  const kind = body.kind === 'amnezia' ? 'amnezia' : body.kind === 'wireguard' ? 'wireguard' : null;

  if (!kind) {
    throw createError({ statusCode: 400, statusMessage: 'Укажите kind: wireguard или amnezia' });
  }

  const live = await listLiveUserVpnKeys(session.id, kind);
  const limit = vpnLimitForKind(kind);

  if (live.length >= limit) {
    const latest = live[live.length - 1];
    return {
      ok: true,
      created: false,
      atLimit: true,
      limit,
      message:
        kind === 'wireguard'
          ? 'Ваш WireGuard-ключ — скачайте конфиг или отсканируйте QR.'
          : 'Ваши AmneziaWG-ключи — скачайте конфиг или отсканируйте QR.',
      key: latest,
      keys: live
    };
  }

  const slot = live.length + 1;
  const clientName = buildVpnClientName(
    session.id,
    kind,
    slot,
    session.name,
    session.auth_source
  );
  const createdClient = await createWgClient(panelForKind(kind), clientName);
  const stored = await appendVpnKey({
    id: createdClient.id,
    kind,
    userId: session.id,
    userEmail: session.email,
    clientName: createdClient.name || clientName,
    createdAt: new Date().toISOString()
  }, { actorEmployeeId: await sessionActorEmployeeId(session), reason: 'vpn:issue' });
  const bundle = await getWgClientBundle(panelForKind(kind), stored.id);
  const key = {
    ...stored,
    configuration: bundle.configuration,
    qrcodeSvg: bundle.qrcodeSvg
  };

  return {
    ok: true,
    created: true,
    atLimit: false,
    limit,
    message:
      kind === 'wireguard'
        ? 'WireGuard-ключ готов — скачайте конфиг или отсканируйте QR.'
        : 'AmneziaWG-ключ готов — скачайте конфиг или отсканируйте QR.',
    key,
    keys: [...live, key]
  };
});
