import { vpnKeys, vpnState } from '../db/schema';
import { isInt, isoTimestamp, isStr } from '../db/fieldMapping';
import { arrayPart, isPlainObject, type KeyedStateDef } from '../db/repositories/keyedState';
import { dbFlag, flatListDef } from '../db/repositories/stateFile';

/**
 * Этап 8: учёт VPN-ключей (server/data/vpn-keys.json) → схема vpn. Только метаданные
 * (id пира, kind, userId, userEmail, clientName, createdAt). Сами ключи и конфиги живут в wg-easy.
 */

/** DB_VPN=1 и задан DATABASE_URL → Postgres. Флаг стоит только на стейдже. */
export const vpnDbFlag = dbFlag('DB_VPN');

export const VPN_KEYS_LOCK_KEY = 72_461_030;

/** Поля, которые vpnKeysStore пишет в файл. Всё остальное в записи: повод остановиться. */
export const VPN_KEY_KNOWN_FIELDS = ['id', 'kind', 'userId', 'userEmail', 'clientName', 'createdAt'] as const;

/** Похоже на секрет: приватный/общий ключ, конфиг, пароль, токен. */
const SECRET_NAME = /(private|preshared|psk|secret|password|passwd|token|config|conf$|wg_?conf|qr|key$)/i;

/**
 * Проверка перед импортом и записью в базу: в записях только метаданные. Нашлось поле, похожее
 * на секрет (или любое неизвестное поле на верхнем уровне файла/записи) → ошибка с именами полей,
 * без значений; домен остаётся на файле, данные в базу не попадают.
 */
export function assertVpnMetadataOnly(raw: unknown): void {
  if (!isPlainObject(raw)) return;
  const topSuspicious = Object.keys(raw).filter((k) => k !== 'keys' && SECRET_NAME.test(k));
  const fields = new Set<string>();
  const keys = Array.isArray(raw.keys) ? raw.keys : [];
  for (const item of keys) {
    if (!isPlainObject(item)) continue;
    for (const k of Object.keys(item)) {
      if (!(VPN_KEY_KNOWN_FIELDS as readonly string[]).includes(k)) fields.add(k);
    }
  }
  const bad = [...topSuspicious, ...[...fields].map((k) => `keys[].${k}`)];
  if (bad.length) {
    throw new Error(`vpn-keys.json: поля вне метаданных (${bad.join(', ')}): в базу не переносим, остаёмся на файле`);
  }
}

export const VPN_KEY_DEF = flatListDef({
  table: vpnKeys,
  keyField: 'id',
  keyOk: (v) => typeof v === 'string' && v.length > 0,
  fields: {
    kind: { col: 'kind', ok: isStr },
    userId: { col: 'userId', ok: isInt },
    userEmail: { col: 'userEmail', ok: isStr },
    clientName: { col: 'clientName', ok: isStr },
    createdAt: isoTimestamp('createdAt')
  },
  lockKey: VPN_KEYS_LOCK_KEY,
  auditEntity: 'vpn.key',
  logTag: 'vpn-keys',
  touchUpdatedAt: true
});

export const VPN_KEYS_STATE_DEF: Omit<KeyedStateDef, 'normalize'> = {
  lockKey: VPN_KEYS_LOCK_KEY,
  logTag: 'vpn-keys',
  auditEntity: 'vpn.state',
  metaTable: vpnState,
  metaFields: {},
  parts: [arrayPart('keys', VPN_KEY_DEF)]
};
