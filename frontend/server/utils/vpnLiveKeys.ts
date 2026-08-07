import {
  listUserVpnKeys,
  removeVpnKeysByIds,
  type StoredVpnKey
} from './vpnKeysStore';
import {
  getWgClientBundle,
  panelForKind,
  type VpnKeyKind
} from './wgEasyClient';

export type LiveVpnKey = StoredVpnKey & {
  configuration: string;
  qrcodeSvg: string;
};

/**
 * Ключи пользователя, которые ещё есть в wg-easy.
 * Записи по удалённым в админке пирам снимаем только из нашего учёта (панель не трогаем).
 */
export async function listLiveUserVpnKeys(
  userId: number,
  kind?: VpnKeyKind
): Promise<LiveVpnKey[]> {
  const stored = await listUserVpnKeys(userId, kind);
  const live: LiveVpnKey[] = [];
  const deadIds: string[] = [];

  for (const row of stored) {
    try {
      const bundle = await getWgClientBundle(panelForKind(row.kind), row.id);
      live.push({
        ...row,
        configuration: bundle.configuration,
        qrcodeSvg: bundle.qrcodeSvg
      });
    } catch {
      deadIds.push(row.id);
    }
  }

  if (deadIds.length) {
    await removeVpnKeysByIds(deadIds);
  }

  return live;
}
