import { randomInt } from 'node:crypto';
import { isQaTestEmployeeRow } from '../../app/data/qaTestDepartment';
import { isAccessRevokedForIdentity } from './employeeAccessDenylist';
import { readEmployees, type ServerEmployee } from './employeesStore';
import { isBitrixImbotConfigured, sendBitrixImbotMessage } from './bitrixImbot';
import {
  bitrixWritesBlockedMessage,
  bitrixWritesBlockedNow,
  isBitrixWriteBlockedError
} from './bitrixWriteGuard';
import { findEmployeeByVibeLogin } from './vibeLogin';
import {
  checkVibePassword,
  getVibePasswordPlain,
  markVibeCredentialsSent,
  readVibeCredentialsStates,
  setVibePassword,
  type VibeCredentialsState
} from './vibePasswordsStore';

/**
 * Выдача доступов Vibe «логин + пароль» с отправкой сотруднику от чат-бота Bitrix.
 *
 * Порядок на человека: пароль → запись (scrypt-хеш + seal, как у админки) → проверка
 * тем же поиском и checkVibePassword, что у POST /api/auth/vibe-login, и глаз в профиле
 * (seal открывается) → imbot.message.add → отметка credentials_sent_at.
 * Отправка упала → пароль остаётся, статус set_not_delivered; повтор (resendUndelivered)
 * шлёт ТОТ ЖЕ пароль из seal, новый не генерируется.
 *
 * Пароли и текст сообщения никогда не логируются и не возвращаются.
 */

/** Без похожих символов: нет 0/O/o и 1/l/I, символы только простые с клавиатуры. */
export const VIBE_PASSWORD_UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const VIBE_PASSWORD_LOWER = 'abcdefghijkmnpqrstuvwxyz';
export const VIBE_PASSWORD_DIGITS = '23456789';
export const VIBE_PASSWORD_SYMBOLS = '!@#%+=?';
export const VIBE_PASSWORD_LENGTH = 16;

const ALL_CHARS = VIBE_PASSWORD_UPPER + VIBE_PASSWORD_LOWER + VIBE_PASSWORD_DIGITS + VIBE_PASSWORD_SYMBOLS;

const pick = (alphabet: string): string => alphabet[randomInt(alphabet.length)]!;

/** Криптостойкий пароль: каждый класс символов минимум один раз, перемешан Фишером–Йетсом. */
export function generateVibePassword(length = VIBE_PASSWORD_LENGTH): string {
  if (length < 12) throw new Error('Длина пароля не меньше 12');
  const chars = [
    pick(VIBE_PASSWORD_UPPER),
    pick(VIBE_PASSWORD_LOWER),
    pick(VIBE_PASSWORD_DIGITS),
    pick(VIBE_PASSWORD_SYMBOLS)
  ];
  while (chars.length < length) chars.push(pick(ALL_CHARS));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join('');
}

const VBI_EMAIL_RE = /^[a-z0-9][a-z0-9._%+-]*@vbi\.ru$/;
const ANY_EMAIL_RE = /^[a-z0-9][a-z0-9._%+-]*@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;

/**
 * Логин для выдачи: email справочника в нижнем регистре. Приоритет у @vbi.ru;
 * нет такого, берём имеющийся корректный email (например @vbi.kz). Пусто или мусор: null.
 */
export function vibeLoginEmail(email: unknown): string | null {
  const e = String(email ?? '').trim().toLowerCase();
  if (VBI_EMAIL_RE.test(e)) return e;
  return ANY_EMAIL_RE.test(e) ? e : null;
}

/** Текст сообщения сотруднику (утверждён заказчиком дословно). */
export function vibeCredentialsMessage(login: string, password: string): string {
  return [
    'Привет!',
    'А ты знаешь, что теперь в Вайбе http://45.12.74.25/profile доступен вход не только через Битрикс, но и по логину паролю?',
    '',
    'Твои доступы:',
    `Логин: ${login}`,
    `Пароль: ${password}`
  ].join('\n');
}

export type VibeCredentialsStatus =
  | 'would_issue'
  | 'would_overwrite'
  | 'would_resend'
  | 'sent'
  | 'resent'
  | 'set_not_delivered'
  | 'skipped'
  | 'failed';

export type VibeCredentialsRow = {
  employee_id: number;
  name: string;
  email: string;
  bitrix_user_id: number | null;
  status: VibeCredentialsStatus;
  reason?: string;
};

export type IssueVibeCredentialsOptions = {
  employeeIds?: number[];
  /** То же по Bitrix ID (как в ссылке на профиль портала). */
  bitrixUserIds?: number[];
  all?: boolean;
  /** По умолчанию true: только список «кому и почему нет», без генерации и отправки. */
  dryRun?: boolean;
  /** Перезаписать уже существующий пароль Vibe (по умолчанию нет). */
  overwriteExisting?: boolean;
  /** Только повторная отправка «задан, не доставлен» тем же паролем; новых паролей не выдаёт. */
  resendUndelivered?: boolean;
  /** Кто запустил (id справочника) для аудита; null — система. */
  actorEmployeeId?: number | null;
};

export type IssueVibeCredentialsResult = {
  dry_run: boolean;
  mode: 'issue' | 'resend';
  delivery: { bot_configured: boolean; bitrix_writes_blocked: boolean; blocked_reason: string | null };
  counts: Record<string, number>;
  rows: VibeCredentialsRow[];
};

const REASON = {
  notFound: 'нет в справочнике (или удалён / в denylist)',
  qa: 'тестовый сотрудник QA-отдела',
  revoked: 'доступ закрыт (denylist)',
  noBitrix: 'нет Bitrix ID: бот не сможет написать',
  noEmail: 'нет email в справочнике',
  badEmail: 'email в справочнике некорректный',
  loginConflict: 'по этому email вход находит другого сотрудника',
  hasPassword: 'пароль Vibe уже задан (overwriteExisting не включён)',
  undelivered: 'пароль выдан, но не доставлен: повторить через resendUndelivered',
  notUndelivered: 'нет выданного и недоставленного пароля',
  noSeal: 'сохранённый пароль не открывается (seal), повтор невозможен без нового пароля',
  verifyFailed: 'проверка входа не прошла, сообщение не отправлено'
} as const;

/** Ошибка отправки без секретов: пароль вырезается, длина ограничена. */
function safeError(err: unknown, secret: string): string {
  let msg = '';
  if (err && typeof err === 'object' && 'statusMessage' in err) {
    msg = String((err as { statusMessage?: string }).statusMessage || '');
  }
  if (!msg) msg = err instanceof Error ? err.message : String(err);
  if (secret) msg = msg.split(secret).join('***');
  return msg.slice(0, 300) || 'ошибка отправки';
}

type Eligible = { emp: ServerEmployee; email: string; bitrixUserId: number };

async function checkEligible(
  emp: ServerEmployee,
  roster: ServerEmployee[]
): Promise<{ ok: Eligible } | { skip: string; email: string }> {
  const rawEmail = String(emp.email || '').trim().toLowerCase();
  if (isQaTestEmployeeRow(emp)) return { skip: REASON.qa, email: rawEmail };
  if (!rawEmail) return { skip: REASON.noEmail, email: '' };
  const email = vibeLoginEmail(rawEmail);
  if (!email) return { skip: REASON.badEmail, email: rawEmail };
  const bitrixUserId = Number(emp.bitrix_user_id || 0);
  if (!Number.isFinite(bitrixUserId) || bitrixUserId <= 0) return { skip: REASON.noBitrix, email };
  if (findEmployeeByVibeLogin(roster, email)?.id !== emp.id) return { skip: REASON.loginConflict, email };
  if (await isAccessRevokedForIdentity({ bitrix_user_id: bitrixUserId, id: bitrixUserId, email })) {
    return { skip: REASON.revoked, email };
  }
  return { ok: { emp, email, bitrixUserId } };
}

/** Проверка как у POST /api/auth/vibe-login: тот же поиск по логину + scrypt, плюс глаз в профиле. */
async function verifyLogin(emp: ServerEmployee, email: string, password: string): Promise<boolean> {
  const roster = await readEmployees();
  const found = findEmployeeByVibeLogin(roster, email);
  if (!found || found.id !== emp.id) return false;
  if (!(await checkVibePassword(emp.id, password))) return false;
  return (await getVibePasswordPlain(emp.id)) === password;
}

let running = false;

export async function issueVibeCredentials(
  opts: IssueVibeCredentialsOptions
): Promise<IssueVibeCredentialsResult> {
  const dryRun = opts.dryRun !== false;
  const resendMode = opts.resendUndelivered === true;
  const overwrite = opts.overwriteExisting === true;
  const actorEmployeeId = opts.actorEmployeeId ?? null;

  const ids = (opts.employeeIds || []).map(Number).filter((n) => Number.isInteger(n) && n > 0);
  const bitrixIds = (opts.bitrixUserIds || []).map(Number).filter((n) => Number.isInteger(n) && n > 0);
  if (!opts.all && !ids.length && !bitrixIds.length) {
    throw createError({ statusCode: 400, statusMessage: 'Укажите employeeIds, bitrixUserIds или all: true' });
  }

  const writesBlocked = bitrixWritesBlockedNow();
  const botConfigured = isBitrixImbotConfigured();
  const delivery = {
    bot_configured: botConfigured,
    bitrix_writes_blocked: writesBlocked,
    blocked_reason: writesBlocked ? bitrixWritesBlockedMessage() : null
  };
  // Бой без бота: не задаём пароли, которые некому доставить.
  if (!dryRun && !writesBlocked && !botConfigured) {
    throw createError({
      statusCode: 503,
      statusMessage: 'BITRIX_IMBOT_ID не задан: доставить доступы нечем, пароли не задавались'
    });
  }

  if (!dryRun) {
    if (running) throw createError({ statusCode: 409, statusMessage: 'Выдача доступов уже идёт' });
    running = true;
  }

  try {
    const roster = await readEmployees();
    const states = await readVibeCredentialsStates();
    const byId = new Map(roster.map((e) => [e.id, e]));
    const byBitrix = new Map(
      roster.filter((e) => Number(e.bitrix_user_id) > 0).map((e) => [Number(e.bitrix_user_id), e])
    );
    type Missing = { missing: 'id' | 'bitrix'; value: number };
    const targets: Array<ServerEmployee | Missing> = [];
    if (opts.all) targets.push(...roster);
    else {
      const seen = new Set<number>();
      const add = (t: ServerEmployee | Missing) => {
        if ('missing' in t) return targets.push(t);
        if (!seen.has(t.id)) {
          seen.add(t.id);
          targets.push(t);
        }
      };
      for (const id of new Set(ids)) add(byId.get(id) ?? { missing: 'id', value: id });
      for (const b of new Set(bitrixIds)) add(byBitrix.get(b) ?? { missing: 'bitrix', value: b });
    }

    const rows: VibeCredentialsRow[] = [];
    for (const target of targets) {
      if ('missing' in target) {
        rows.push({
          employee_id: target.missing === 'id' ? target.value : 0,
          name: '',
          email: '',
          bitrix_user_id: target.missing === 'bitrix' ? target.value : null,
          status: 'skipped',
          reason: REASON.notFound
        });
        continue;
      }
      const emp = target;
      const base = {
        employee_id: emp.id,
        name: emp.name,
        bitrix_user_id: Number(emp.bitrix_user_id || 0) > 0 ? Number(emp.bitrix_user_id) : null
      };
      const check = await checkEligible(emp, roster);
      if ('skip' in check) {
        rows.push({ ...base, email: check.email, status: 'skipped', reason: check.skip });
        continue;
      }
      const { email, bitrixUserId } = check.ok;
      const state: VibeCredentialsState | undefined = states.get(emp.id);
      const undelivered = Boolean(state?.credentials_issued_at && !state.credentials_sent_at);

      if (resendMode) {
        if (!undelivered) {
          rows.push({ ...base, email, status: 'skipped', reason: REASON.notUndelivered });
          continue;
        }
        if (!state?.has_seal) {
          rows.push({ ...base, email, status: dryRun ? 'skipped' : 'failed', reason: REASON.noSeal });
          continue;
        }
        if (dryRun) {
          rows.push({ ...base, email, status: 'would_resend', reason: writesBlocked ? `не будет доставлено: ${delivery.blocked_reason}` : undefined });
          continue;
        }
        const password = await getVibePasswordPlain(emp.id);
        if (!password) {
          rows.push({ ...base, email, status: 'failed', reason: REASON.noSeal });
          continue;
        }
        rows.push({ ...base, email, ...(await deliver(emp.id, bitrixUserId, email, password, 'resent', actorEmployeeId)) });
        continue;
      }

      if (state?.has_password && !overwrite) {
        rows.push({ ...base, email, status: 'skipped', reason: undelivered ? REASON.undelivered : REASON.hasPassword });
        continue;
      }
      if (dryRun) {
        rows.push({
          ...base,
          email,
          status: state?.has_password ? 'would_overwrite' : 'would_issue',
          reason: writesBlocked ? `пароль задастся, но не будет доставлен: ${delivery.blocked_reason}` : undefined
        });
        continue;
      }

      const password = generateVibePassword();
      await setVibePassword(
        emp.id,
        password,
        { actorEmployeeId, reason: 'vibe-credentials-issued' },
        { credentials_issued_at: new Date().toISOString() }
      );
      if (!(await verifyLogin(emp, email, password))) {
        rows.push({ ...base, email, status: 'failed', reason: REASON.verifyFailed });
        continue;
      }
      rows.push({ ...base, email, ...(await deliver(emp.id, bitrixUserId, email, password, 'sent', actorEmployeeId)) });
    }

    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.status] = (counts[r.status] || 0) + 1;
    const result: IssueVibeCredentialsResult = {
      dry_run: dryRun,
      mode: resendMode ? 'resend' : 'issue',
      delivery,
      counts,
      rows
    };
    // В лог: только счётчики (ни паролей, ни текста сообщения).
    console.info('[vibe-credentials]', JSON.stringify({ dry_run: dryRun, mode: result.mode, counts }));
    return result;
  } finally {
    if (!dryRun) running = false;
  }
}

async function deliver(
  employeeId: number,
  bitrixUserId: number,
  email: string,
  password: string,
  okStatus: 'sent' | 'resent',
  actorEmployeeId: number | null
): Promise<{ status: VibeCredentialsStatus; reason?: string }> {
  try {
    await sendBitrixImbotMessage({ bitrixUserId, message: vibeCredentialsMessage(email, password) });
  } catch (err) {
    if (isBitrixWriteBlockedError(err)) {
      return { status: 'set_not_delivered', reason: `не доставлено: ${bitrixWritesBlockedMessage()}` };
    }
    return { status: 'set_not_delivered', reason: `не доставлено: ${safeError(err, password)}` };
  }
  try {
    await markVibeCredentialsSent(employeeId, { actorEmployeeId });
  } catch (err) {
    // Сообщение ушло; отметка не записалась — честно говорим, повтор не нужен.
    return { status: okStatus, reason: `отправлено, но отметка не сохранилась: ${safeError(err, password)}` };
  }
  return { status: okStatus };
}
