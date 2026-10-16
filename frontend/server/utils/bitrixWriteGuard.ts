import { resolveStand, type Stand } from './standEnvFiles';

/**
 * Стейдж и локалка не пишут в реальный Bitrix (crm.vbi.ru).
 *
 * У стейджа тот же BITRIX_WEBHOOK_URL, что у боя, и своё OAuth-приложение на том же портале;
 * в локальном .env тоже лежит боевой вебхук. Поэтому всё, что не чтение, на них не отправляется:
 * - production — пишем как раньше;
 * - staging — запись выключена всегда (флаг не помогает);
 * - development — выключена, пока не задан BITRIX_ALLOW_WRITES=1 (осознанный тест);
 * - стенд не определён — выключена (fail safe; бой всегда запекает appEnv=production в CI).
 *
 * Запрет по умолчанию: пропускаются только методы из BITRIX_READ_METHODS.
 * OAuth-обмен токенов (/oauth/token/) — не REST, гвардом не закрыт: вход работает.
 */

/** REST-методы только на чтение. Всё остальное на стейдже/локалке = запись = блок. */
export const BITRIX_READ_METHODS: ReadonlySet<string> = new Set([
  // используются в коде
  'user.current',
  'user.get',
  'user.admin',
  'department.get',
  'lists.get',
  'lists.element.get',
  // безопасные чтения на будущее/диагностику
  'user.search',
  'lists.field.get',
  'calendar.event.get',
  'profile',
  'app.info',
  'server.time',
  'scope',
  'methods',
  'method.get'
]);

/** Псевдо-метод для PHP-моста колокольчиков на коробке (BITRIX_VACATION_NOTIFY_BRIDGE_URL). */
export const BITRIX_NOTIFY_BRIDGE_METHOD = 'bridge:vbihr.vacation-notify';

const BLOCKED_SUFFIX = 'запись в Bitrix отключена';

export const isBitrixReadMethod = (method: string): boolean =>
  BITRIX_READ_METHODS.has(String(method || '').trim().toLowerCase());

const isTruthyFlag = (raw: unknown): boolean => {
  const v = String(raw ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
};

/** Можно ли вообще писать в Bitrix на этом стенде. */
export function bitrixWritesAllowed(stand: Stand | null, allowWritesFlag?: unknown): boolean {
  if (stand === 'production') return true;
  if (stand === 'development') return isTruthyFlag(allowWritesFlag);
  return false;
}

/** Решение по конкретному вызову: true — не отправлять. */
export function shouldBlockBitrixCall(
  method: string,
  stand: Stand | null,
  allowWritesFlag?: unknown
): boolean {
  if (isBitrixReadMethod(method)) return false;
  return !bitrixWritesAllowed(stand, allowWritesFlag);
}

/** Стенд как в load-bitrix-env: запечённый runtimeConfig.public.appEnv, затем NUXT_PUBLIC_APP_ENV. */
export function currentBitrixStand(): Stand | null {
  let baked: unknown = '';
  try {
    baked = useRuntimeConfig().public.appEnv;
  } catch {
    /* вне Nitro-контекста (юнит-тесты, скрипты) */
  }
  return resolveStand(baked) ?? resolveStand(process.env.NUXT_PUBLIC_APP_ENV);
}

export const bitrixWritesBlockedMessage = (stand: Stand | null = currentBitrixStand()): string =>
  `${stand ?? 'unknown'}: ${BLOCKED_SUFFIX}`;

/** Текст ошибки/статуса «запись заблокирована гвардом» (для любого стенда). */
export const isBitrixWritesBlockedMessage = (message: unknown): boolean =>
  String(message ?? '').endsWith(BLOCKED_SUFFIX);

export class BitrixWriteBlockedError extends Error {
  readonly method: string;
  readonly stand: Stand | null;

  constructor(method: string, stand: Stand | null) {
    super(bitrixWritesBlockedMessage(stand));
    this.name = 'BitrixWriteBlockedError';
    this.method = method;
    this.stand = stand;
  }
}

export const isBitrixWriteBlockedError = (err: unknown): boolean =>
  err instanceof BitrixWriteBlockedError ||
  (err instanceof Error && isBitrixWritesBlockedMessage(err.message));

/** На этом стенде запись в Bitrix выключена? (без лога) */
export const bitrixWritesBlockedNow = (): boolean =>
  !bitrixWritesAllowed(currentBitrixStand(), process.env.BITRIX_ALLOW_WRITES);

/**
 * Проверка перед вызовом: если метод — запись и стенд не боевой, пишет одну строку в лог
 * и возвращает true (вызов не отправлять).
 */
export function blockBitrixWriteIfNeeded(method: string): boolean {
  const stand = currentBitrixStand();
  if (!shouldBlockBitrixCall(method, stand, process.env.BITRIX_ALLOW_WRITES)) return false;
  console.warn(`[bitrix] ${stand ?? 'unknown'}: write blocked ${method}`);
  return true;
}

/** То же, но бросает BitrixWriteBlockedError — для низкоуровневого клиента. */
export function assertBitrixWriteAllowed(method: string): void {
  if (blockBitrixWriteIfNeeded(method)) {
    throw new BitrixWriteBlockedError(method, currentBitrixStand());
  }
}
