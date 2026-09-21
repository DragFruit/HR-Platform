import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual
} from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createMutationQueue, writeJsonAtomic } from './atomicJson';
import { getDeployAppEnv } from './appEnv';

/**
 * Локальные пароли Vibe (не пароли Bitrix).
 * Хеш scrypt для входа + sealed plaintext, чтобы владелец мог увидеть пароль в профиле.
 */
type VibePasswordEntry = {
  employee_id: number;
  /** scrypt$N$r$p$saltB64$hashB64 */
  password_hash: string;
  /** aes-256-gcm: v1$iv$tag$cipher — только для показа себе в профиле */
  password_seal?: string;
  updated_at: string;
};

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

type VibePasswordsState = {
  entries: VibePasswordEntry[];
};

const FILE = join(process.cwd(), 'server/data/vibe-passwords.json');
const queue = createMutationQueue();

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEYLEN = 32;

async function readState(): Promise<VibePasswordsState> {
  try {
    const raw = await readFile(FILE, 'utf8');
    const parsed = JSON.parse(raw) as VibePasswordsState;
    if (!parsed || !Array.isArray(parsed.entries)) return { entries: [] };
    return { entries: parsed.entries };
  } catch {
    return { entries: [] };
  }
}

async function writeState(state: VibePasswordsState): Promise<void> {
  await mkdir(dirname(FILE), { recursive: true });
  await writeJsonAtomic(FILE, state);
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
  const state = await readState();
  return state.entries.some((e) => e.employee_id === employeeId && e.password_hash);
}

export async function setVibePassword(employeeId: number, password: string): Promise<void> {
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

  await queue(async () => {
    const state = await readState();
    const next: VibePasswordEntry = {
      employee_id: employeeId,
      password_hash: hashPassword(trimmed),
      password_seal: sealPassword(trimmed),
      updated_at: new Date().toISOString()
    };
    const idx = state.entries.findIndex((e) => e.employee_id === employeeId);
    if (idx >= 0) state.entries[idx] = next;
    else state.entries.push(next);
    await writeState(state);
  });
}

/** Plaintext для показа владельцу в профиле; null если пароля нет или старая запись без seal. */
export async function getVibePasswordPlain(employeeId: number): Promise<string | null> {
  const state = await readState();
  const entry = state.entries.find((e) => e.employee_id === employeeId);
  if (!entry?.password_hash) return null;
  return openPassword(entry.password_seal);
}

/**
 * После успешной проверки пароля дописывает seal, если его ещё нет
 * (старые записи были только с хешем — глаз в профиле не мог открыть текст).
 */
export async function ensureVibePasswordSeal(
  employeeId: number,
  password: string
): Promise<void> {
  const trimmed = String(password || '');
  if (!trimmed || !Number.isFinite(employeeId) || employeeId <= 0) return;

  await queue(async () => {
    const state = await readState();
    const entry = state.entries.find((e) => e.employee_id === employeeId);
    if (!entry?.password_hash) return;
    if (!verifyVibePassword(trimmed, entry.password_hash)) return;
    if (openPassword(entry.password_seal) === trimmed) return;
    entry.password_seal = sealPassword(trimmed);
    entry.updated_at = new Date().toISOString();
    await writeState(state);
  });
}

export async function clearVibePassword(employeeId: number): Promise<void> {
  await queue(async () => {
    const state = await readState();
    state.entries = state.entries.filter((e) => e.employee_id !== employeeId);
    await writeState(state);
  });
}

/** Проверка пароля сотрудника; false если пароля нет или не совпал. */
export async function checkVibePassword(
  employeeId: number,
  password: string
): Promise<boolean> {
  const state = await readState();
  const entry = state.entries.find((e) => e.employee_id === employeeId);
  if (!entry?.password_hash) return false;
  return verifyVibePassword(password, entry.password_hash);
}

export async function listVibePasswordEmployeeIds(): Promise<number[]> {
  const state = await readState();
  return state.entries.map((e) => e.employee_id);
}
