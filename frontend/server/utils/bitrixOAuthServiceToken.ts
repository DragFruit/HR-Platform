import { existsSync } from 'node:fs';
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

const DATA_CANDIDATES = (): string[] => {
  const fromEnv = String(process.env.BITRIX_OAUTH_SERVICE_FILE || '').trim();
  const paths = [
    fromEnv,
    '/etc/vbi-hr/bitrix-oauth-service.json',
    join(process.cwd(), 'server/data/bitrix-oauth-service.json')
  ].filter(Boolean);
  return [...new Set(paths)];
};

let cachedAccessToken: string | null = null;
let cachedExpiresAt = 0;
let resolvedDataFile: string | null = null;

const envRefreshToken = (): string | null => {
  const raw = String(process.env.BITRIX_SERVICE_REFRESH_TOKEN || '').trim();
  return raw || null;
};

const resolveDataFile = (): string => {
  if (resolvedDataFile) return resolvedDataFile;
  for (const path of DATA_CANDIDATES()) {
    if (existsSync(path)) {
      resolvedDataFile = path;
      return path;
    }
  }
  const fallback = DATA_CANDIDATES().at(-1)!;
  resolvedDataFile = fallback;
  return fallback;
};

async function readState(): Promise<BitrixOAuthServiceState | null> {
  const envToken = envRefreshToken();
  if (envToken) {
    return { refresh_token: envToken };
  }

  for (const path of DATA_CANDIDATES()) {
    if (!existsSync(path)) continue;
    try {
      const raw = await readFile(path, 'utf8');
      const parsed = JSON.parse(raw) as BitrixOAuthServiceState;
      if (parsed?.refresh_token?.trim()) {
        resolvedDataFile = path;
        return parsed;
      }
    } catch {
      /* try next path */
    }
  }

  return null;
}

async function writeState(state: BitrixOAuthServiceState) {
  const path = resolveDataFile();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(state, null, 2) + '\n', 'utf8');
  resolvedDataFile = path;
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
  if (!refresh) {
    console.error(
      `[bitrixOAuthService] вход user ${savedByUserId}: Bitrix не вернул refresh_token — im.notify недоступен`
    );
    return;
  }

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
    `[bitrixOAuthService] refresh_token сохранён (user ${savedByUserId}) → ${resolveDataFile()}`
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
    if (!envRefreshToken()) {
      await writeState(next);
    }
    cachedAccessToken = next.access_token || null;
    cachedExpiresAt = next.expires_at || 0;
    return cachedAccessToken;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[bitrixOAuthService] не удалось обновить access_token: ${detail}`);
    return null;
  }
}
