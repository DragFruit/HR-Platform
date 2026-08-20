import { VPN_LIMITS } from '../../app/data/vpnLimits';

export type VpnKeyKind = 'wireguard' | 'amnezia';

export type WgEasyClient = {
  id: string;
  name: string;
  enabled: boolean;
  address?: string;
  createdAt?: string;
};

export type WgEasyPanel = 'wireguard' | 'amnezia';

type PanelConfig = {
  baseUrl: string;
  password: string;
};

function panelConfig(panel: WgEasyPanel): PanelConfig {
  if (panel === 'wireguard') {
    return {
      baseUrl: String(process.env.WG_EASY_URL || 'http://188.190.10.62:51831').replace(/\/$/, ''),
      password: String(process.env.WG_EASY_PASSWORD || '').trim()
    };
  }
  return {
    baseUrl: String(process.env.AWG_EASY_URL || 'http://188.190.10.62:51821').replace(/\/$/, ''),
    password: String(process.env.AWG_EASY_PASSWORD || '').trim()
  };
}

function assertConfigured(panel: WgEasyPanel, cfg: PanelConfig) {
  if (!cfg.password) {
    const envName = panel === 'wireguard' ? 'WG_EASY_PASSWORD' : 'AWG_EASY_PASSWORD';
    throw createError({
      statusCode: 503,
      statusMessage: `VPN-панель не настроена (${envName})`
    });
  }
}

async function withSession<T>(panel: WgEasyPanel, fn: (cookie: string, baseUrl: string) => Promise<T>): Promise<T> {
  const cfg = panelConfig(panel);
  assertConfigured(panel, cfg);

  const loginRes = await fetch(`${cfg.baseUrl}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ password: cfg.password })
  });
  if (!loginRes.ok) {
    throw createError({
      statusCode: 502,
      statusMessage: `Не удалось войти в панель ${panel} (${loginRes.status})`
    });
  }

  const rawCookie = loginRes.headers.getSetCookie?.() ?? [];
  const cookieHeader =
    rawCookie.map((c) => c.split(';')[0]).join('; ') ||
    (() => {
      const single = loginRes.headers.get('set-cookie');
      return single ? single.split(',').map((c) => c.split(';')[0].trim()).join('; ') : '';
    })();

  if (!cookieHeader) {
    throw createError({ statusCode: 502, statusMessage: `Панель ${panel} не вернула сессию` });
  }

  return fn(cookieHeader, cfg.baseUrl);
}

async function panelFetch(
  baseUrl: string,
  cookie: string,
  path: string,
  init?: RequestInit
): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Cookie: cookie,
      ...(init?.headers || {})
    }
  });
}

export function vpnLimitForKind(kind: VpnKeyKind): number {
  return kind === 'wireguard' ? VPN_LIMITS.wireguardPerUser : VPN_LIMITS.amneziaPerUser;
}

export function panelForKind(kind: VpnKeyKind): WgEasyPanel {
  return kind === 'wireguard' ? 'wireguard' : 'amnezia';
}

export async function listWgClients(panel: WgEasyPanel): Promise<WgEasyClient[]> {
  return withSession(panel, async (cookie, baseUrl) => {
    const res = await panelFetch(baseUrl, cookie, '/api/wireguard/client');
    if (!res.ok) {
      throw createError({
        statusCode: 502,
        statusMessage: `Не удалось получить клиентов ${panel} (${res.status})`
      });
    }
    const data = (await res.json()) as WgEasyClient[];
    return Array.isArray(data) ? data : [];
  });
}

/** Только создание. Удаление пиров — только при офбординге (удаление сотрудника из Vibe). */
export async function createWgClient(panel: WgEasyPanel, name: string): Promise<WgEasyClient> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw createError({ statusCode: 400, statusMessage: 'Пустое имя клиента VPN' });
  }

  return withSession(panel, async (cookie, baseUrl) => {
    const beforeRes = await panelFetch(baseUrl, cookie, '/api/wireguard/client');
    if (!beforeRes.ok) {
      throw createError({ statusCode: 502, statusMessage: `Не удалось прочитать клиентов (${beforeRes.status})` });
    }
    const before = (await beforeRes.json()) as WgEasyClient[];
    const beforeIds = new Set((Array.isArray(before) ? before : []).map((c) => c.id));

    const createRes = await panelFetch(baseUrl, cookie, '/api/wireguard/client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed })
    });
    if (!createRes.ok) {
      const text = await createRes.text().catch(() => '');
      throw createError({
        statusCode: 502,
        statusMessage: `Не удалось создать клиента VPN (${createRes.status})`,
        data: text.slice(0, 200)
      });
    }

    const afterRes = await panelFetch(baseUrl, cookie, '/api/wireguard/client');
    if (!afterRes.ok) {
      throw createError({ statusCode: 502, statusMessage: 'Клиент создан, но список не обновился' });
    }
    const after = (await afterRes.json()) as WgEasyClient[];
    const created = (Array.isArray(after) ? after : []).find((c) => !beforeIds.has(c.id) && c.name === trimmed);
    if (created) return created;
    const byName = (Array.isArray(after) ? after : []).find((c) => c.name === trimmed);
    if (byName) return byName;
    throw createError({ statusCode: 502, statusMessage: 'Клиент создан, но не найден в панели' });
  });
}

/**
 * Удаление пира в wg-easy.
 * Разрешено только при офбординге (сотрудник удалён из справочника Vibe) —
 * не использовать для «почистить старые ключи» без явной просьбы.
 */
export async function deleteWgClient(panel: WgEasyPanel, clientId: string): Promise<void> {
  const id = String(clientId || '').trim();
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Пустой id клиента VPN' });
  }

  return withSession(panel, async (cookie, baseUrl) => {
    const res = await panelFetch(baseUrl, cookie, `/api/wireguard/client/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    if (!res.ok && res.status !== 404) {
      const text = await res.text().catch(() => '');
      throw createError({
        statusCode: 502,
        statusMessage: `Не удалось удалить клиента VPN (${res.status})`,
        data: text.slice(0, 200)
      });
    }
  });
}

export async function getWgClientConfiguration(panel: WgEasyPanel, clientId: string): Promise<string> {
  return withSession(panel, async (cookie, baseUrl) => {
    const res = await panelFetch(baseUrl, cookie, `/api/wireguard/client/${clientId}/configuration`);
    if (!res.ok) {
      throw createError({
        statusCode: 502,
        statusMessage: `Не удалось скачать конфиг (${res.status})`
      });
    }
    return res.text();
  });
}

export async function getWgClientQrSvg(panel: WgEasyPanel, clientId: string): Promise<string> {
  return withSession(panel, async (cookie, baseUrl) => {
    const res = await panelFetch(baseUrl, cookie, `/api/wireguard/client/${clientId}/qrcode.svg`, {
      headers: { Accept: 'image/svg+xml' }
    });
    if (!res.ok) {
      throw createError({
        statusCode: 502,
        statusMessage: `Не удалось получить QR (${res.status})`
      });
    }
    return res.text();
  });
}

export async function getWgClientBundle(panel: WgEasyPanel, clientId: string) {
  return withSession(panel, async (cookie, baseUrl) => {
    const [configRes, qrRes] = await Promise.all([
      panelFetch(baseUrl, cookie, `/api/wireguard/client/${clientId}/configuration`),
      panelFetch(baseUrl, cookie, `/api/wireguard/client/${clientId}/qrcode.svg`, {
        headers: { Accept: 'image/svg+xml' }
      })
    ]);
    if (!configRes.ok) {
      throw createError({ statusCode: 502, statusMessage: `Не удалось скачать конфиг (${configRes.status})` });
    }
    if (!qrRes.ok) {
      throw createError({ statusCode: 502, statusMessage: `Не удалось получить QR (${qrRes.status})` });
    }
    return {
      configuration: await configRes.text(),
      qrcodeSvg: await qrRes.text()
    };
  });
}
