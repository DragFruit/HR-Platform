import { getBitrixConfig } from './bitrixConfig';

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

  const response = await fetch(`${bitrixPortalUrl}/oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  const data = (await response.json()) as BitrixTokenResponse & { error?: string; error_description?: string };
  if (!response.ok || !data.access_token) {
    const message = data.error_description || data.error || `HTTP ${response.status}`;
    throw createError({ statusCode: 502, statusMessage: `Bitrix OAuth: ${message}` });
  }
  return data;
}

export async function bitrixRest<T>(
  method: string,
  params: Record<string, unknown>,
  accessToken: string
): Promise<T> {
  const { bitrixPortalUrl } = getBitrixConfig();
  const response = await fetch(`${bitrixPortalUrl}/rest/${method}.json`, {
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
  const items: T[] = [];
  let start = 0;

  for (;;) {
    const { bitrixPortalUrl } = getBitrixConfig();
    const response = await fetch(`${bitrixPortalUrl}/rest/${method}.json`, {
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

export async function fetchCurrentBitrixUser(accessToken: string): Promise<BitrixUser> {
  return bitrixRest<BitrixUser>('user.current', {}, accessToken);
}

export function formatBitrixUserName(user: BitrixUser): string {
  return [user.LAST_NAME, user.NAME, user.SECOND_NAME]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}
