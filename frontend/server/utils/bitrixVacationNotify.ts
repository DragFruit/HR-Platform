import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { VacationRequest } from '../../app/composables/useVacations';
import { bitrixOAuthRequest } from './bitrixClient';
import {
  clearBitrixServiceAccessTokenCache,
  getBitrixServiceAccessToken,
  hasBitrixOAuthServiceToken
} from './bitrixOAuthServiceToken';
import { findEmployeeByName } from './employeesStore';

export type BitrixVacationNotifyStage = 'new' | 'director';

/**
 * Параметры im.notify.system.add
 * @see https://apidocs.bitrix24.ru/api-reference/chats/notifications/im-notify-system-add.html
 */
type BitrixSystemNotifyParams = {
  USER_ID: number;
  MESSAGE: string;
  TAG?: string;
  SUB_TAG?: string;
};

const formatDateRu = (iso: string): string => {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}.${m}.${y}` : iso;
};

const vacationApprovalUrl = (): string | null => {
  const candidates = [
    String(process.env.APP_PUBLIC_URL || '').trim(),
    String(process.env.BITRIX_REDIRECT_URI || '').trim()
  ];

  for (const raw of candidates) {
    if (!raw) continue;
    try {
      const origin = new URL(raw).origin;
      return `${origin}/vacations?tab=approval`;
    } catch {
      /* try next */
    }
  }

  return null;
};

const bitrixUserIdForApprover = async (approverName: string): Promise<number | null> => {
  const employee = await findEmployeeByName(approverName);
  if (!employee) return null;
  const id = employee.bitrix_user_id ?? employee.platform_user_id ?? employee.id;
  return typeof id === 'number' && id > 0 ? id : null;
};

const buildNotifyMessage = (
  request: VacationRequest,
  stage: BitrixVacationNotifyStage,
  approvalUrl: string
): string => {
  const headline =
    stage === 'director'
      ? 'Заявка на отпуск: согласование директора'
      : 'Новая заявка на отпуск в VBI HR';
  const dates = `${formatDateRu(request.start)} — ${formatDateRu(request.end)}`;
  const lines = [
    headline,
    '',
    `Сотрудник: ${request.employee}`,
    `Даты: ${dates}`
  ];

  const comment = request.comment?.trim();
  if (comment) lines.push(`Комментарий: ${comment}`);

  lines.push('', `[URL=${approvalUrl}]Открыть согласование в Vibe[/URL]`);
  return lines.join('\n');
};

/** TAG — уникальный в рамках приложения; повтор с тем же TAG удаляет предыдущее. */
const notifyTag = (requestId: number, stage: BitrixVacationNotifyStage): string =>
  `VBI_HR_VAC_${requestId}_${stage}`;

/** SUB_TAG — дополнительный тег без проверки уникальности. */
const notifySubTag = (requestId: number, stage: BitrixVacationNotifyStage): string =>
  `VBI_HR|vacation|${requestId}|${stage}`;

/**
 * result im.notify.*.add: ID уведомления или false.
 * На коробке crm.vbi.ru для части пользователей метод отвечает HTTP 200,
 * но result = unix timestamp ≈ time.start — уведомление НЕ создано.
 * У нормальных получателей — ID ~1e7 (как у Музыки Сергея).
 */
const isFakeTimestampNotifyResult = (result: unknown, timeStart?: number): boolean => {
  const n = typeof result === 'number' ? result : Number(result);
  if (!Number.isFinite(n) || n < 1_500_000_000 || n > 2_500_000_000) return false;
  if (typeof timeStart === 'number' && Math.abs(n - Math.floor(timeStart)) <= 2) return true;
  return Math.abs(n - Math.floor(Date.now() / 1000)) < 120;
};

const isNotifyCreated = (value: unknown, timeStart?: number): value is number => {
  if (isFakeTimestampNotifyResult(value, timeStart)) return false;
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) && n > 0 && n < 1_000_000_000;
};

const notifyLogPath = () => join(process.cwd(), 'server/data/bitrix-notify.log');

const appendNotifyLog = async (line: string) => {
  try {
    await mkdir(join(process.cwd(), 'server/data'), { recursive: true });
    await appendFile(notifyLogPath(), `${new Date().toISOString()} ${line}\n`, 'utf8');
  } catch {
    /* не мешаем основному сценарию */
  }
  console.error(`[bitrixVacationNotify] ${line}`);
};

/**
 * Только im.notify.system.add через OAuth (колокольчик).
 * Личный чат (im.message.add) не используем — требование продукта.
 */
const imNotifySystemAdd = async (
  params: BitrixSystemNotifyParams,
  accessToken: string
): Promise<{ ok: boolean; notifyId?: number; error?: string }> => {
  if (!params.USER_ID || params.USER_ID <= 0) {
    return { ok: false, error: 'USER_ID_EMPTY' };
  }
  if (!params.MESSAGE?.trim()) {
    return { ok: false, error: 'MESSAGE_EMPTY' };
  }

  try {
    const data = await bitrixOAuthRequest<number | false>(
      'im.notify.system.add',
      params,
      accessToken
    );

    if (data.error) {
      const detail = data.error_description || data.error;
      return { ok: false, error: detail };
    }

    const timeStart =
      data.time && typeof data.time.start === 'number' ? data.time.start : undefined;

    if (isFakeTimestampNotifyResult(data.result, timeStart)) {
      return {
        ok: false,
        error:
          `ложный result (timestamp ${String(data.result)}) — Bitrix не создал системное уведомление ` +
          `пользователю ${params.USER_ID}. Проверьте настройки уведомлений учётки в crm.vbi.ru ` +
          `(не шлём чат).`
      };
    }

    if (isNotifyCreated(data.result, timeStart)) {
      return { ok: true, notifyId: Number(data.result) };
    }

    if (data.result === false) {
      return { ok: false, error: 'im.notify.system.add вернул false' };
    }

    return { ok: false, error: `неожиданный result: ${String(data.result)}` };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, error: detail };
  }
};

/**
 * Типизированный колокольчик через PHP-мост на коробке (NOTIFY_MODULE=vbihr).
 * Появляется в настройках как «VBI HR → Заявки на отпуск», без «Неопознанные».
 * @see scripts/bitrix/vbi-hr/README.md
 */
const sendViaNotifyBridge = async (
  bitrixUserId: number,
  message: string,
  tag: string,
  subTag: string
): Promise<{ ok: boolean; method?: string; error?: string; notifyId?: number } | null> => {
  const url = String(process.env.BITRIX_VACATION_NOTIFY_BRIDGE_URL || '').trim();
  const secret = String(process.env.BITRIX_VACATION_NOTIFY_BRIDGE_SECRET || '').trim();
  if (!url || !secret) return null;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        secret,
        USER_ID: bitrixUserId,
        MESSAGE: message,
        TAG: tag,
        SUB_TAG: subTag
      })
    });
    const data = (await res.json().catch(() => null)) as {
      ok?: boolean;
      notifyId?: number;
      error?: string;
      result?: number;
    } | null;

    if (!data) {
      return { ok: false, error: `bridge HTTP ${res.status}: empty body` };
    }
    if (data.ok && typeof data.notifyId === 'number') {
      return {
        ok: true,
        method: 'vbihr.vacation-notify (CIMNotify)',
        notifyId: data.notifyId
      };
    }
    return {
      ok: false,
      error: data.error || `bridge HTTP ${res.status}`
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `bridge: ${detail}` };
  }
};

const sendBitrixSystemNotify = async (
  bitrixUserId: number,
  message: string,
  tag: string,
  subTag: string
): Promise<{ ok: boolean; method?: string; error?: string; notifyId?: number }> => {
  const bridge = await sendViaNotifyBridge(bitrixUserId, message, tag, subTag);
  if (bridge) {
    return bridge;
  }

  const params: BitrixSystemNotifyParams = {
    USER_ID: bitrixUserId,
    MESSAGE: message,
    TAG: tag,
    SUB_TAG: subTag
  };

  const tryOnce = async (forceRefresh: boolean) => {
    const accessToken = await getBitrixServiceAccessToken({ forceRefresh });
    if (!accessToken) {
      return {
        ok: false as const,
        error: 'нет OAuth refresh_token — админу нужен вход через Битрикс24 на платформе'
      };
    }
    return imNotifySystemAdd(params, accessToken);
  };

  let result = await tryOnce(false);
  if (result.ok) {
    return { ok: true, method: 'im.notify.system.add', notifyId: result.notifyId };
  }

  const err = result.error ?? 'unknown';
  const shouldRefresh =
    /insufficient_scope|expired_token|NO_AUTH_FOUND|invalid_token|ACCESS_DENIED/i.test(err);

  if (shouldRefresh) {
    await appendNotifyLog(
      `retry after ${err} (forceRefresh access_token) → user ${bitrixUserId}`
    );
    clearBitrixServiceAccessTokenCache();
    result = await tryOnce(true);
    if (result.ok) {
      return { ok: true, method: 'im.notify.system.add', notifyId: result.notifyId };
    }
  }

  const finalErr = result.error ?? err;
  if (/insufficient_scope/i.test(finalErr)) {
    await appendNotifyLog(
      `insufficient_scope — в crm.vbi.ru у «VBI HR Platform» нужно право «Чат и уведомления» (im), затем повторный вход админа`
    );
  }

  return { ok: false, error: finalErr };
};

/** Пуш в Битрикс текущему согласующему; только колокольчик. Ошибки не пробрасываются. */
export async function notifyBitrixVacationApprover(
  request: VacationRequest,
  approverName: string,
  stage: BitrixVacationNotifyStage = 'new'
): Promise<void> {
  if (request.status !== 'pending') return;

  const approvalUrl = vacationApprovalUrl();
  if (!approvalUrl) {
    await appendNotifyLog(
      `SKIP #${request.id}: нет APP_PUBLIC_URL / BITRIX_REDIRECT_URI`
    );
    return;
  }

  const bitrixUserId = await bitrixUserIdForApprover(approverName);
  if (!bitrixUserId) {
    await appendNotifyLog(
      `SKIP #${request.id}: у «${approverName}» нет bitrix_user_id`
    );
    return;
  }

  const message = buildNotifyMessage(request, stage, approvalUrl);
  const tag = notifyTag(request.id, stage);
  const subTag = notifySubTag(request.id, stage);

  const bridgeConfigured = Boolean(
    String(process.env.BITRIX_VACATION_NOTIFY_BRIDGE_URL || '').trim() &&
      String(process.env.BITRIX_VACATION_NOTIFY_BRIDGE_SECRET || '').trim()
  );
  const hasOAuth = await hasBitrixOAuthServiceToken();
  await appendNotifyLog(
    `#${request.id} → «${approverName}» (user ${bitrixUserId}), bridge=${bridgeConfigured}, oauth=${hasOAuth}, stage=${stage}`
  );

  if (!bridgeConfigured && !hasOAuth) {
    await appendNotifyLog(
      `SKIP #${request.id}: нет bridge и нет OAuth refresh_token — колокольчик недоступен`
    );
    return;
  }

  const notifyResult = await sendBitrixSystemNotify(bitrixUserId, message, tag, subTag);

  if (notifyResult.ok) {
    await appendNotifyLog(
      `OK #${request.id} → user ${bitrixUserId} via ${notifyResult.method} id=${notifyResult.notifyId ?? '?'}`
    );
    return;
  }

  await appendNotifyLog(
    `FAIL #${request.id} → user ${bitrixUserId}: ${notifyResult.error ?? 'unknown'}`
  );
}
