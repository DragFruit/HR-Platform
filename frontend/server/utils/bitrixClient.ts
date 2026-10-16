import { getBitrixConfig, getBitrixWebhookUrl, isBitrixWebhookConfigured } from './bitrixConfig';
import { redactSensitiveText } from './redactSensitive';
import { assertBitrixWriteAllowed } from './bitrixWriteGuard';

/** Таймаут внешних вызовов Bitrix — без него зависший портал держит mutateVacations. */
const BITRIX_FETCH_TIMEOUT_MS = 20_000;

const bitrixFetch = (url: string, init?: RequestInit): Promise<Response> =>
  fetch(url, { ...init, signal: AbortSignal.timeout(BITRIX_FETCH_TIMEOUT_MS) });

/** Понятная ошибка, если VPS не достучался до портала (firewall / DNS). */
function throwIfBitrixUnreachable(err: unknown, label: string): never {
  const cause = err && typeof err === 'object' && 'cause' in err ? (err as { cause?: unknown }).cause : err;
  const code =
    cause && typeof cause === 'object' && 'code' in cause
      ? String((cause as { code?: string }).code || '')
      : '';
  const msg = err instanceof Error ? err.message : String(err);
  const unreachable =
    code === 'UND_ERR_CONNECT_TIMEOUT' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    /Connect Timeout|fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i.test(msg);

  if (unreachable) {
    throw createError({
      statusCode: 503,
      statusMessage:
        'Сервер Vibe не достучался до crm.vbi.ru (таймаут сети). ' +
        'Пока исходящий HTTPS с 45.12.74.25 на портал закрыт — вход логин/пароль не работает. ' +
        'Используйте «Войти через Битрикс24» (браузер ходит на портал сам) или откройте сеть Vibe→Bitrix.'
    });
  }

  throw createError({
    statusCode: 502,
    statusMessage: redactSensitiveText(`${label}: ${msg}`)
  });
}

export type BitrixTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  member_id?: string;
  user_id?: number;
  scope?: string;
};

export type BitrixUser = {
  ID: string;
  NAME?: string;
  LAST_NAME?: string;
  SECOND_NAME?: string;
  EMAIL?: string;
  WORK_POSITION?: string;
  ACTIVE?: string | boolean;
  DATE_REGISTER?: string;
  UF_DEPARTMENT?: number[] | string[];
  IS_ONLINE?: string;
};

export type BitrixDepartment = {
  ID: string;
  NAME?: string;
  UF_HEAD?: string;
  PARENT?: string;
};

type BitrixRestResponse<T> = {
  result?: T;
  next?: number;
  total?: number;
  error?: string;
  error_description?: string;
  time?: { start?: number; finish?: number };
};

export async function exchangeBitrixCode(code: string, redirectUri: string): Promise<BitrixTokenResponse> {
  const { bitrixPortalUrl, bitrixClientId, bitrixClientSecret } = getBitrixConfig();
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: bitrixClientId,
    client_secret: bitrixClientSecret,
    code,
    redirect_uri: redirectUri
  });

  let response: Response;
  try {
    response = await bitrixFetch(`${bitrixPortalUrl}/oauth/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
  } catch (err) {
    throwIfBitrixUnreachable(err, 'Bitrix OAuth');
  }

  const data = (await response.json()) as BitrixTokenResponse & { error?: string; error_description?: string };
  if (!response.ok || !data.access_token) {
    let message = data.error_description || data.error || `HTTP ${response.status}`;
    if (data.error === 'invalid_client') {
      message =
        'invalid_client — неверный CLIENT_ID или CLIENT_SECRET. ' +
        'Откройте dev-приложение в Битриксе, скопируйте ключи заново в frontend/.env (без кавычек и пробелов). ' +
        `Client ID в запросе: ${bitrixClientId}`;
    }
    throw createError({
      statusCode: 502,
      statusMessage: redactSensitiveText(`Bitrix OAuth: ${message}`)
    });
  }
  return data;
}

/**
 * Вход логин/пароль портала без редиректа и без PHP на коробке.
 * Только HTTP к уже существующему /oauth/token/ (правки Bitrix не нужны).
 * Если портал не отдаёт grant_type=password — вернётся понятная ошибка.
 */
export async function exchangeBitrixPassword(
  username: string,
  password: string
): Promise<BitrixTokenResponse> {
  const { bitrixPortalUrl, bitrixClientId, bitrixClientSecret } = getBitrixConfig();
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: bitrixClientId,
    client_secret: bitrixClientSecret,
    username: username.trim(),
    password
  });

  let response: Response;
  try {
    response = await bitrixFetch(`${bitrixPortalUrl}/oauth/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
  } catch (err) {
    throwIfBitrixUnreachable(err, 'Bitrix OAuth password');
  }

  const data = (await response.json()) as BitrixTokenResponse & { error?: string; error_description?: string };
  if (!response.ok || !data.access_token) {
    const err = String(data.error || '');
    const desc = String(data.error_description || data.error || `HTTP ${response.status}`);
    if (err === 'unsupported_grant_type' || /unsupported_grant_type/i.test(desc)) {
      throw createError({
        statusCode: 501,
        statusMessage:
          'Портал Bitrix не принимает вход по паролю для этого приложения (grant_type=password). ' +
          'Без правок на crm.vbi.ru остаётся только «Войти через Битрикс24».'
      });
    }
    if (err === 'invalid_grant' || /invalid_grant|wrong/i.test(desc)) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Неверный логин или пароль Bitrix'
      });
    }
    throw createError({
      statusCode: 502,
      statusMessage: redactSensitiveText(`Bitrix OAuth password: ${desc}`)
    });
  }
  return data;
}

export async function refreshBitrixToken(refreshToken: string): Promise<BitrixTokenResponse> {
  const { bitrixPortalUrl, bitrixClientId, bitrixClientSecret } = getBitrixConfig();
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: bitrixClientId,
    client_secret: bitrixClientSecret,
    refresh_token: refreshToken
  });

  const response = await bitrixFetch(`${bitrixPortalUrl}/oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  const data = (await response.json()) as BitrixTokenResponse & { error?: string; error_description?: string };
  if (!response.ok || !data.access_token) {
    const message = data.error_description || data.error || `HTTP ${response.status}`;
    throw createError({
      statusCode: 502,
      statusMessage: redactSensitiveText(`Bitrix OAuth refresh: ${message}`)
    });
  }
  return data;
}

export async function bitrixOAuthRequest<T>(
  method: string,
  params: Record<string, unknown>,
  accessToken: string
): Promise<BitrixRestResponse<T>> {
  // Стейдж/локалка: запись в реальный портал не отправляем (см. bitrixWriteGuard.ts)
  assertBitrixWriteAllowed(method);
  const { bitrixPortalUrl } = getBitrixConfig();
  const response = await bitrixFetch(`${bitrixPortalUrl}/rest/${method}.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, auth: accessToken })
  });
  return (await response.json()) as BitrixRestResponse<T>;
}

export async function bitrixRest<T>(
  method: string,
  params: Record<string, unknown>,
  accessToken: string
): Promise<T> {
  // Стейдж/локалка: запись в реальный портал не отправляем (см. bitrixWriteGuard.ts)
  assertBitrixWriteAllowed(method);
  const { bitrixPortalUrl } = getBitrixConfig();
  const response = await bitrixFetch(`${bitrixPortalUrl}/rest/${method}.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, auth: accessToken })
  });

  const data = (await response.json()) as BitrixRestResponse<T>;
  if (!response.ok || data.error) {
    const message = data.error_description || data.error || `HTTP ${response.status}`;
    throw createError({ statusCode: 502, statusMessage: `Bitrix REST ${method}: ${message}` });
  }
  if (data.result === undefined) {
    throw createError({ statusCode: 502, statusMessage: `Bitrix REST ${method}: пустой ответ` });
  }
  return data.result;
}

export async function bitrixRestAll<T extends Record<string, unknown>>(
  method: string,
  params: Record<string, unknown>,
  accessToken: string
): Promise<T[]> {
  // Стейдж/локалка: запись в реальный портал не отправляем (см. bitrixWriteGuard.ts)
  assertBitrixWriteAllowed(method);
  const items: T[] = [];
  let start = 0;

  for (;;) {
    const { bitrixPortalUrl } = getBitrixConfig();
    const response = await bitrixFetch(`${bitrixPortalUrl}/rest/${method}.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...params, auth: accessToken, start })
    });

    const data = (await response.json()) as BitrixRestResponse<T[]>;
    if (!response.ok || data.error) {
      const message = data.error_description || data.error || `HTTP ${response.status}`;
      throw createError({ statusCode: 502, statusMessage: `Bitrix REST ${method}: ${message}` });
    }

    const batch = Array.isArray(data.result) ? data.result : [];
    items.push(...batch);

    if (data.next === undefined || batch.length === 0) break;
    start = data.next;
  }

  return items;
}

export async function bitrixWebhookRest<T>(
  method: string,
  params: Record<string, unknown>
): Promise<T> {
  if (!isBitrixWebhookConfigured()) {
    throw createError({ statusCode: 500, statusMessage: 'BITRIX_WEBHOOK_URL не задан' });
  }

  const data = await bitrixWebhookRequest<T>(method, params);
  if (data.error) {
    const message = data.error_description || data.error;
    throw createError({ statusCode: 502, statusMessage: `Bitrix webhook ${method}: ${message}` });
  }
  if (data.result === undefined) {
    throw createError({ statusCode: 502, statusMessage: `Bitrix webhook ${method}: пустой ответ` });
  }
  return data.result;
}

async function bitrixWebhookRequest<T>(method: string, params: Record<string, unknown>): Promise<BitrixRestResponse<T>> {
  assertBitrixWriteAllowed(method);
  const base = getBitrixWebhookUrl();
  const response = await bitrixFetch(`${base}/${method}.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  return (await response.json()) as BitrixRestResponse<T>;
}

export async function bitrixWebhookAll<T extends Record<string, unknown>>(
  method: string,
  params: Record<string, unknown>
): Promise<T[]> {
  if (!isBitrixWebhookConfigured()) {
    throw createError({ statusCode: 500, statusMessage: 'BITRIX_WEBHOOK_URL не задан' });
  }

  const items: T[] = [];
  let start = 0;

  for (;;) {
    const data = await bitrixWebhookRequest<T[]>(method, { ...params, start });
    if (data.error) {
      const message = data.error_description || data.error;
      throw createError({ statusCode: 502, statusMessage: `Bitrix webhook ${method}: ${message}` });
    }

    const batch = Array.isArray(data.result) ? data.result : [];
    items.push(...batch);

    if (data.next === undefined || batch.length === 0) break;
    start = data.next;
  }

  return items;
}

function isWebhookCredentialsError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('invalid request credentials') ||
    m.includes('invalid_credentials') ||
    m.includes('no_auth_found')
  );
}

function errorStatusMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'statusMessage' in err) {
    return String((err as { statusMessage?: string }).statusMessage || '');
  }
  return err instanceof Error ? err.message : String(err);
}

export async function bitrixFetchAll<T extends Record<string, unknown>>(
  method: string,
  params: Record<string, unknown>,
  accessToken?: string
): Promise<T[]> {
  if (isBitrixWebhookConfigured()) {
    try {
      return await bitrixWebhookAll<T>(method, params);
    } catch (err) {
      if (!accessToken || !isWebhookCredentialsError(errorStatusMessage(err))) throw err;
      // Битый/устаревший вебхук — синк при OAuth-входе через токен пользователя
    }
  }
  if (!accessToken) {
    throw createError({ statusCode: 500, statusMessage: 'Нет OAuth-токена для Bitrix REST' });
  }
  return bitrixRestAll<T>(method, params, accessToken);
}

export async function fetchCurrentBitrixUser(accessToken: string): Promise<BitrixUser> {
  return bitrixRest<BitrixUser>('user.current', {}, accessToken);
}

export function formatBitrixUserName(user: BitrixUser): string {
  return [user.LAST_NAME, user.NAME]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}
