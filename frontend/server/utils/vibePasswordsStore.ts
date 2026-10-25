import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual
} from 'node:crypto';
import { getDeployAppEnv } from './appEnv';
import type { VibePasswordEntry } from '../profile/domains';
import type { KeyedListWriteContext } from '../db/repositories/keyedList';
import { vibePasswordsRepo } from './profileStore';

/**
 * Локальные пароли Vibe (не пароли Bitrix).
 * Хеш scrypt для входа (scrypt$N$r$p$saltB64$hashB64) + sealed plaintext
 * (aes-256-gcm: v1$iv$tag$cipher), чтобы владелец мог увидеть пароль в профиле.
 * Этап 6: DB_PROFILE=1 → profile.vibe_passwords (те же хеш и seal, без открытого текста),
 * иначе server/data/vibe-passwords.json. Аудит — только «пароль задан / снят» и кто.
 */

function sealSecret(): string {
  const dedicated = String(process.env.VBI_SESSION_SECRET || '').trim();
  if (dedicated) return dedicated;
  const bitrix = String(process.env.BITRIX_CLIENT_SECRET || '').trim();
  if (bitrix) return `vbi-session:${bitrix}`;
  if (getDeployAppEnv() === 'production') {
    throw createError({
      statusCode: 503,
      statusMessage: 'VBI_SESSION_SECRET или BITRIX_CLIENT_SECRET не задан'
    });
  }
  return 'vbi-dev-session-secret-not-for-production';
}

function sealKey(): Buffer {
  return createHash('sha256').update(`vibe-pw-reveal-v1:${sealSecret()}`).digest();
}

function sealPassword(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', sealKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    enc.toString('base64url')
  ].join('$');
}

function openPassword(sealed: string | undefined): string | null {
  if (!sealed) return null;
  const parts = String(sealed).split('$');
  if (parts.length !== 4 || parts[0] !== 'v1') return null;
  try {
    const iv = Buffer.from(parts[1], 'base64url');
    const tag = Buffer.from(parts[2], 'base64url');
    const data = Buffer.from(parts[3], 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', sealKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEYLEN = 32;

async function readEntries(): Promise<VibePasswordEntry[]> {
  return (await vibePasswordsRepo()).read();
}

function hashPassword(password: string, salt?: Buffer): string {
  const saltBuf = salt ?? randomBytes(16);
  const hash = scryptSync(password, saltBuf, KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P
  });
  return [
    'scrypt',
    String(SCRYPT_N),
    String(SCRYPT_R),
    String(SCRYPT_P),
    saltBuf.toString('base64url'),
    hash.toString('base64url')
  ].join('$');
}

export function verifyVibePassword(password: string, stored: string): boolean {
  const parts = String(stored || '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = Buffer.from(parts[4], 'base64url');
  const expected = Buffer.from(parts[5], 'base64url');
  if (!salt.length || !expected.length) return false;
  try {
    const actual = scryptSync(password, salt, expected.length, { N: n, r, p });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export async function hasVibePassword(employeeId: number): Promise<boolean> {
  const entries = await readEntries();
  return entries.some((e) => e.employee_id === employeeId && e.password_hash);
}

export async function setVibePassword(
  employeeId: number,
  password: string,
  ctx: KeyedListWriteContext = {},
  meta: Pick<VibePasswordEntry, 'credentials_issued_at'> = {}
): Promise<void> {
  const trimmed = String(password || '');
  if (trimmed.length < 8) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Пароль не короче 8 символов'
    });
  }
  if (!Number.isFinite(employeeId) || employeeId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректный employee_id' });
  }

  const password_hash = hashPassword(trimmed);
  const password_seal = sealPassword(trimmed);
  await (await vibePasswordsRepo()).mutate(
    (entries) => {
      const next: VibePasswordEntry = {
        employee_id: employeeId,
        password_hash,
        password_seal,
        updated_at: new Date().toISOString(),
        ...(meta.credentials_issued_at ? { credentials_issued_at: meta.credentials_issued_at } : {})
      };
      const idx = entries.findIndex((e) => e.employee_id === employeeId);
      if (idx >= 0) entries[idx] = next;
      else entries.push(next);
    },
    { reason: 'vibe-password-set', ...ctx }
  );
}

/** Plaintext для показа владельцу в профиле; null если пароля нет или старая запись без seal. */
export async function getVibePasswordPlain(employeeId: number): Promise<string | null> {
  const entry = (await readEntries()).find((e) => e.employee_id === employeeId);
  if (!entry?.password_hash) return null;
  return openPassword(entry.password_seal);
}

/**
 * После успешной проверки пароля дописывает seal, если его ещё нет
 * (старые записи были только с хешем — глаз в профиле не мог открыть текст).
 */
export async function ensureVibePasswordSeal(
  employeeId: number,
  password: string,
  ctx: KeyedListWriteContext = {}
): Promise<void> {
  const trimmed = String(password || '');
  if (!trimmed || !Number.isFinite(employeeId) || employeeId <= 0) return;

  await (await vibePasswordsRepo()).mutate(
    (entries) => {
      const entry = entries.find((e) => e.employee_id === employeeId);
      if (!entry?.password_hash) return;
      if (!verifyVibePassword(trimmed, entry.password_hash)) return;
      if (openPassword(entry.password_seal) === trimmed) return;
      entry.password_seal = sealPassword(trimmed);
      entry.updated_at = new Date().toISOString();
    },
    { reason: 'vibe-login-seal', ...ctx }
  );
}

export async function clearVibePassword(employeeId: number, ctx: KeyedListWriteContext = {}): Promise<void> {
  await (await vibePasswordsRepo()).mutate(
    (entries) => {
      const kept = entries.filter((e) => e.employee_id !== employeeId);
      if (kept.length !== entries.length) entries.splice(0, entries.length, ...kept);
    },
    { reason: 'vibe-password-clear', ...ctx }
  );
}

/** Проверка пароля сотрудника; false если пароля нет или не совпал. */
export async function checkVibePassword(
  employeeId: number,
  password: string
): Promise<boolean> {
  const entry = (await readEntries()).find((e) => e.employee_id === employeeId);
  if (!entry?.password_hash) return false;
  return verifyVibePassword(password, entry.password_hash);
}

export type VibeCredentialsState = {
  employee_id: number;
  has_password: boolean;
  /** seal открывается (глаз в профиле и повторная отправка работают). */
  has_seal: boolean;
  credentials_issued_at: string | null;
  credentials_sent_at: string | null;
};

/** Статусы паролей для выдачи доступов: без хешей и текста. */
export async function readVibeCredentialsStates(): Promise<Map<number, VibeCredentialsState>> {
  const out = new Map<number, VibeCredentialsState>();
  for (const e of await readEntries()) {
    if (!e?.password_hash) continue;
    out.set(e.employee_id, {
      employee_id: e.employee_id,
      has_password: true,
      has_seal: openPassword(e.password_seal) !== null,
      credentials_issued_at: e.credentials_issued_at || null,
      credentials_sent_at: e.credentials_sent_at || null
    });
  }
  return out;
}

/** Отметка «доступы доставлены ботом» (аудит: credentials_sent + actor, без значений). */
export async function markVibeCredentialsSent(
  employeeId: number,
  ctx: KeyedListWriteContext = {}
): Promise<void> {
  await (await vibePasswordsRepo()).mutate(
    (entries) => {
      const entry = entries.find((e) => e.employee_id === employeeId);
      if (!entry?.password_hash) return;
      entry.credentials_sent_at = new Date().toISOString();
    },
    { ...ctx, reason: 'vibe-credentials-sent' }
  );
}

export async function listVibePasswordEmployeeIds(): Promise<number[]> {
  return (await readEntries()).map((e) => e.employee_id);
}
