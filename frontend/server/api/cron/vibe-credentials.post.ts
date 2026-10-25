import type { H3Event } from 'h3';
import { timingSafeEqual } from 'node:crypto';
import { readEmployees } from '../../utils/employeesStore';
import { issueVibeCredentials } from '../../utils/vibeCredentialsIssue';

/**
 * Выдача доступов Vibe (логин = email @vbi.ru + пароль) с отправкой от чат-бота Bitrix.
 * Только с сервера:
 * - заголовок X-Cron-Token = первый заданный из VIBE_CREDENTIALS_SECRET, CRON_SECRET,
 *   VACATION_PRE_REMINDER_CRON_SECRET (как у cron-напоминаний бота); ?token= не принимается;
 * - запрос напрямую на 127.0.0.1:<порт Node>, мимо nginx (есть X-Forwarded-For / X-Real-IP → 403).
 *
 * Тело: { employeeIds?: number[], bitrixUserIds?: number[], all?: boolean, dryRun?: boolean (по умолчанию true),
 *         overwriteExisting?: boolean, resendUndelivered?: boolean, actorEmployeeId?: number }.
 * Ответ: статусы по людям без паролей и текста сообщения.
 */

const sameSecret = (a: string, b: string): boolean => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

function assertServerSideCall(event: H3Event): void {
  const expected = String(
    process.env.VIBE_CREDENTIALS_SECRET || process.env.CRON_SECRET || process.env.VACATION_PRE_REMINDER_CRON_SECRET || ''
  ).trim();
  if (!expected) {
    throw createError({ statusCode: 503, statusMessage: 'VIBE_CREDENTIALS_SECRET / CRON_SECRET / VACATION_PRE_REMINDER_CRON_SECRET не задан' });
  }
  const forwarded = getHeader(event, 'x-forwarded-for') || getHeader(event, 'x-real-ip');
  const ip = getRequestIP(event, { xForwardedFor: false }) || '';
  const loopback = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
  if (forwarded || !loopback) {
    throw createError({ statusCode: 403, statusMessage: 'Только с сервера (127.0.0.1, мимо nginx)' });
  }
  const token = String(getHeader(event, 'x-cron-token') || '').trim();
  if (!token || !sameSecret(token, expected)) {
    throw createError({ statusCode: 401, statusMessage: 'Неверный cron token' });
  }
}

const flag = (v: unknown, fallback: boolean): boolean => {
  if (v === undefined || v === null || v === '') return fallback;
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toLowerCase();
  if (['1', 'true', 'yes'].includes(s)) return true;
  if (['0', 'false', 'no'].includes(s)) return false;
  return fallback;
};

export default defineEventHandler(async (event) => {
  assertServerSideCall(event);

  const body = (await readBody<Record<string, unknown>>(event).catch(() => null)) || {};
  const rawIds = body.employeeIds ?? body.employee_ids;
  const employeeIds = Array.isArray(rawIds) ? rawIds.map(Number) : [];
  const rawBitrix = body.bitrixUserIds ?? body.bitrix_user_ids;
  const bitrixUserIds = Array.isArray(rawBitrix) ? rawBitrix.map(Number) : [];

  let actorEmployeeId: number | null = null;
  const rawActor = Number(body.actorEmployeeId ?? body.actor_employee_id ?? 0);
  if (Number.isInteger(rawActor) && rawActor > 0) {
    if (!(await readEmployees()).some((e) => e.id === rawActor)) {
      throw createError({ statusCode: 400, statusMessage: 'actorEmployeeId нет в справочнике' });
    }
    actorEmployeeId = rawActor;
  }

  const result = await issueVibeCredentials({
    employeeIds,
    bitrixUserIds,
    all: flag(body.all, false),
    dryRun: flag(body.dryRun ?? body.dry_run, true),
    overwriteExisting: flag(body.overwriteExisting ?? body.overwrite_existing, false),
    resendUndelivered: flag(body.resendUndelivered ?? body.resend_undelivered, false),
    actorEmployeeId
  });
  return { ok: true, ...result };
});
