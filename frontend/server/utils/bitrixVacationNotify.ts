import type { VacationRequest } from '../../app/composables/useVacations';
import { bitrixOAuthRequest } from './bitrixClient';
import { getBitrixWebhookUrl, isBitrixWebhookConfigured } from './bitrixConfig';
import {
  getBitrixServiceAccessToken,
  hasBitrixOAuthServiceToken
} from './bitrixOAuthServiceToken';
import { findEmployeeByName } from './employeesStore';

export type BitrixVacationNotifyStage = 'new' | 'director';

type BitrixRestPayload = {
  error?: string;
  error_description?: string;
  result?: unknown;
};

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

/** Запасной личный чат только при явном BITRIX_VACATION_NOTIFY_CHAT_FALLBACK=true. */
const chatFallbackEnabled = (): boolean =>
  String(process.env.BITRIX_VACATION_NOTIFY_CHAT_FALLBACK || 'false').trim() === 'true';

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
 * result im.notify.*.add: ID уведомления (integer) или false.
 * Отсекаем unix-timestamp (~1e9), который вебхук иногда отдаёт как ложный «успех».
 */
const isNotifyCreated = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value > 0 &&
  value < 1_000_000_000;

const bitrixWebhookCall = async (
  method: string,
  params: Record<string, unknown>
): Promise<BitrixRestPayload> => {
  const base = getBitrixWebhookUrl();
  const response = await fetch(`${base}/${method}.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(params)
  });
  return (await response.json()) as BitrixRestPayload;
};

/**
 * im.notify.system.add через OAuth-приложение (колокольчик от системы).
 * MESSAGE_OUT не передаём — иначе Bitrix может слать во внешние каналы (email/SMS).
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

    if (isNotifyCreated(data.result)) {
      return { ok: true, notifyId: data.result };
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

const sendBitrixChatMessage = async (
  bitrixUserId: number,
  message: string
): Promise<{ ok: boolean; method?: string; error?: string }> => {
  try {
    const data = await bitrixWebhookCall('im.message.add', {
      DIALOG_ID: bitrixUserId,
      MESSAGE: message
    });
    if (data.error) {
      const detail = data.error_description || data.error;
      return { ok: false, error: `${detail} (im.message.add)` };
    }
    if (typeof data.result === 'number' && data.result > 0) {
      return { ok: true, method: 'im.message.add' };
    }
    return { ok: false, error: 'im.message.add: некорректный result' };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `im.message.add fetch failed: ${detail}` };
  }
};

const sendBitrixSystemNotify = async (
  bitrixUserId: number,
  message: string,
  tag: string,
  subTag: string
): Promise<{ ok: boolean; method?: string; error?: string }> => {
  const accessToken = await getBitrixServiceAccessToken();
  if (!accessToken) {
    return {
      ok: false,
      error: 'нет OAuth refresh_token — админу нужен вход через Битрикс24 на платформе'
    };
  }

  const params: BitrixSystemNotifyParams = {
    USER_ID: bitrixUserId,
    MESSAGE: message,
    TAG: tag,
    SUB_TAG: subTag
  };

  const result = await imNotifySystemAdd(params, accessToken);
  if (result.ok) {
    return { ok: true, method: 'im.notify.system.add' };
  }

  console.error(
    `[bitrixVacationNotify] im.notify.system.add error (user ${bitrixUserId}): ${result.error ?? 'unknown'}`
  );
  return { ok: false, error: result.error };
};

/** Пуш в Битрикс текущему согласующему; ошибки не пробрасываются. */
export async function notifyBitrixVacationApprover(
  request: VacationRequest,
  approverName: string,
  stage: BitrixVacationNotifyStage = 'new'
): Promise<void> {
  if (request.status !== 'pending') return;

  const approvalUrl = vacationApprovalUrl();
  if (!approvalUrl) {
    console.error(
      '[bitrixVacationNotify] Не задан APP_PUBLIC_URL или BITRIX_REDIRECT_URI — пропуск'
    );
    return;
  }

  const bitrixUserId = await bitrixUserIdForApprover(approverName);
  if (!bitrixUserId) {
    console.error(
      `[bitrixVacationNotify] У согласующего «${approverName}» нет bitrix_user_id — пропуск`
    );
    return;
  }

  const message = buildNotifyMessage(request, stage, approvalUrl);
  const tag = notifyTag(request.id, stage);
  const subTag = notifySubTag(request.id, stage);

  const hasOAuth = await hasBitrixOAuthServiceToken();

  console.error(
    `[bitrixVacationNotify] #${request.id} → «${approverName}» (user ${bitrixUserId}), oauth=${hasOAuth}`
  );

  if (!hasOAuth) {
    console.error(
      '[bitrixVacationNotify] OAuth-токен не задан — im.notify.system.add недоступен, чат не шлём'
    );
    return;
  }

  const notifyResult = await sendBitrixSystemNotify(bitrixUserId, message, tag, subTag);

  if (notifyResult.ok) {
    logResult(request.id, bitrixUserId, notifyResult);
    return;
  }

  // Личный чат — только явный opt-in; по умолчанию только колокольчик.
  if (chatFallbackEnabled() && isBitrixWebhookConfigured()) {
    const chatResult = await sendBitrixChatMessage(bitrixUserId, message);
    logResult(request.id, bitrixUserId, chatResult, 'fallback после system.add');
    return;
  }

  logResult(request.id, bitrixUserId, notifyResult);
}

const logResult = (
  requestId: number,
  bitrixUserId: number,
  result: { ok: boolean; method?: string; error?: string },
  note?: string
) => {
  const suffix = note ? ` (${note})` : '';
  if (result.ok) {
    console.error(
      `[bitrixVacationNotify] OK #${requestId} → user ${bitrixUserId} via ${result.method}${suffix}`
    );
    return;
  }
  console.error(
    `[bitrixVacationNotify] FAIL #${requestId} → user ${bitrixUserId}: ${result.error ?? 'unknown'}${suffix}`
  );
};
