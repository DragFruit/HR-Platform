import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { BitrixTokenResponse } from './bitrixClient';
import { refreshBitrixToken } from './bitrixClient';

export type BitrixOAuthServiceState = {
  refresh_token: string;
  access_token?: string;
  /** Unix ms */
  expires_at?: number;
  updated_at?: string;
  saved_by_user_id?: number;
};

const DATA_FILE = join(process.cwd(), 'server/data/bitrix-oauth-service.json');

let cachedAccessToken: string | null = null;
let cachedExpiresAt = 0;

const emptyState = (): BitrixOAuthServiceState | null => {
  const fromEnv = String(process.env.BITRIX_SERVICE_REFRESH_TOKEN || '').trim();
  if (fromEnv) return { refresh_token: fromEnv };
  return null;
};

async function ensureFile() {
  await mkdir(dirname(DATA_FILE), { recursive: true });
  try {
    await readFile(DATA_FILE, 'utf8');
  } catch {
    const seed = emptyState();
    if (seed) {
      await writeFile(DATA_FILE, JSON.stringify(seed, null, 2) + '\n', 'utf8');
    }
  }
}

async function readState(): Promise<BitrixOAuthServiceState | null> {
  const envSeed = emptyState();
  if (envSeed && !envSeed.access_token) {
    return envSeed;
  }

  await ensureFile();
  try {
    const raw = await readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw) as BitrixOAuthServiceState;
    if (parsed?.refresh_token?.trim()) return parsed;
  } catch {
    /* fall through */
  }

  return envSeed;
}

async function writeState(state: BitrixOAuthServiceState) {
  await mkdir(dirname(DATA_FILE), { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

export async function hasBitrixOAuthServiceToken(): Promise<boolean> {
  const state = await readState();
  return Boolean(state?.refresh_token?.trim());
}

/** Сохранить refresh_token после входа админа через OAuth. */
export async function saveBitrixServiceOAuthFromLogin(
  token: BitrixTokenResponse,
  savedByUserId: number
): Promise<void> {
  const refresh = String(token.refresh_token || '').trim();
  if (!refresh) return;

  const expiresIn = Number(token.expires_in || 3600);
  const state: BitrixOAuthServiceState = {
    refresh_token: refresh,
    access_token: token.access_token,
    expires_at: Date.now() + expiresIn * 1000,
    updated_at: new Date().toISOString(),
    saved_by_user_id: savedByUserId
  };

  await writeState(state);
  cachedAccessToken = state.access_token || null;
  cachedExpiresAt = state.expires_at || 0;

  console.error(
    `[bitrixOAuthService] refresh_token сохранён (user ${savedByUserId}) для im.notify`
  );
}

/** Access token приложения для server-side im.notify (не вебхук). */
export async function getBitrixServiceAccessToken(): Promise<string | null> {
  if (cachedAccessToken && cachedExpiresAt > Date.now() + 60_000) {
    return cachedAccessToken;
  }

  const state = await readState();
  const refresh = state?.refresh_token?.trim();
  if (!refresh) return null;

  if (state?.access_token && state.expires_at && state.expires_at > Date.now() + 60_000) {
    cachedAccessToken = state.access_token;
    cachedExpiresAt = state.expires_at;
    return state.access_token;
  }

  try {
    const refreshed = await refreshBitrixToken(refresh);
    const expiresIn = Number(refreshed.expires_in || 3600);
    const next: BitrixOAuthServiceState = {
      refresh_token: String(refreshed.refresh_token || refresh).trim(),
      access_token: refreshed.access_token,
      expires_at: Date.now() + expiresIn * 1000,
      updated_at: new Date().toISOString(),
      saved_by_user_id: state?.saved_by_user_id
    };
    await writeState(next);
    cachedAccessToken = next.access_token || null;
    cachedExpiresAt = next.expires_at || 0;
    return cachedAccessToken;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[bitrixOAuthService] не удалось обновить access_token: ${detail}`);
    return null;
  }
}
