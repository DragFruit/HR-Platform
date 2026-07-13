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

const notifyTag = (requestId: number, stage: BitrixVacationNotifyStage): string =>
  `VBI_HR_VAC_${requestId}_${stage}`;

const notifySubTag = (requestId: number, stage: BitrixVacationNotifyStage): string =>
  `VBI_HR|vacation|${requestId}|${stage}`;

/**
 * ID сущности Битрикса (уведомление/сообщение ~10⁷).
 * Через вебхук im.notify.* на коробке часто возвращает time.start (~10⁹).
 */
const isBitrixEntityId = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 && value < 1_000_000_000;

const bellAttempts = (
  bitrixUserId: number,
  message: string,
  tag: string,
  subTag: string
): Array<{ method: string; params: Record<string, unknown> }> => [
  {
    method: 'im.notify.personal.add',
    params: { USER_ID: bitrixUserId, MESSAGE: message, TAG: tag, SUB_TAG: subTag }
  },
  {
    method: 'im.notify.system.add',
    params: { USER_ID: bitrixUserId, MESSAGE: message, TAG: tag, SUB_TAG: subTag }
  },
  {
    method: 'im.notify',
    params: {
      USER_ID: bitrixUserId,
      MESSAGE: message,
      TYPE: 'USER',
      TAG: tag,
      SUB_TAG: subTag
    }
  }
];

const bitrixWebhookCall = async (
  method: string,
  params: Record<string, unknown>
): Promise<BitrixRestPayload> => {
  const base = getBitrixWebhookUrl();
  const response = await fetch(`${base}/${method}.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  return (await response.json()) as BitrixRestPayload;
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
    if (isBitrixEntityId(data.result)) {
      return { ok: true, method: 'im.message.add' };
    }
    return { ok: false, error: 'im.message.add: некорректный result' };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `im.message.add fetch failed: ${detail}` };
  }
};

const sendBitrixBellViaOAuth = async (
  bitrixUserId: number,
  message: string,
  tag: string,
  subTag: string
): Promise<{ ok: boolean; method?: string; error?: string }> => {
  const accessToken = await getBitrixServiceAccessToken();
  if (!accessToken) {
    return {
      ok: false,
      error: 'нет OAuth refresh_token — админу нужно один раз войти через Битрикс на проде'
    };
  }

  const errors: string[] = [];

  for (const attempt of bellAttempts(bitrixUserId, message, tag, subTag)) {
    try {
      const data = await bitrixOAuthRequest(attempt.method, attempt.params, accessToken);
      if (data.error) {
        const detail = data.error_description || data.error;
        errors.push(`${attempt.method}: ${detail}`);
        console.error(`[bitrixVacationNotify] OAuth ${attempt.method} error: ${detail}`);
        continue;
      }
      if (isBitrixEntityId(data.result)) {
        return { ok: true, method: `oauth:${attempt.method}` };
      }
      const bogus = String(data.result);
      errors.push(`${attempt.method}: result=${bogus}`);
      console.error(
        `[bitrixVacationNotify] OAuth ${attempt.method}: result не похож на ID (${bogus})`
      );
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      errors.push(`${attempt.method}: ${detail}`);
      console.error(`[bitrixVacationNotify] OAuth ${attempt.method} failed: ${detail}`);
    }
  }

  return { ok: false, error: errors.join('; ') || 'OAuth колокольчик недоступен' };
};

const sendBitrixNotify = async (
  bitrixUserId: number,
  message: string,
  tag: string,
  subTag: string
): Promise<{ ok: boolean; method?: string; error?: string }> => {
  const bellResult = await sendBitrixBellViaOAuth(bitrixUserId, message, tag, subTag);
  if (bellResult.ok) return bellResult;

  console.error(
    `[bitrixVacationNotify] колокольчик OAuth не доставлен (user ${bitrixUserId}): ${bellResult.error ?? 'unknown'}`
  );

  if (!chatFallbackEnabled()) {
    return bellResult;
  }

  const chatResult = await sendBitrixChatMessage(bitrixUserId, message);
  if (chatResult.ok) return chatResult;

  return {
    ok: false,
    error: [bellResult.error, chatResult.error].filter(Boolean).join(' | ')
  };
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
  if (!hasOAuth) {
    console.error(
      '[bitrixVacationNotify] Нет OAuth refresh_token — колокольчик недоступен; нужен вход админа через Битрикс'
    );
    if (!isBitrixWebhookConfigured()) return;
    const chatResult = await sendBitrixChatMessage(bitrixUserId, message);
    if (chatResult.ok) {
      console.error(
        `[bitrixVacationNotify] OK #${request.id} → user ${bitrixUserId} via ${chatResult.method} (oauth отсутствует)`
      );
    } else {
      console.error(
        `[bitrixVacationNotify] FAIL #${request.id} → user ${bitrixUserId}: ${chatResult.error ?? 'unknown'}`
      );
    }
    return;
  }

  if (chatFallbackEnabled() && !isBitrixWebhookConfigured()) {
    console.error('[bitrixVacationNotify] BITRIX_WEBHOOK_URL не задан — нет запасного чата');
  }

  console.error(
    `[bitrixVacationNotify] отправка #${request.id} → «${approverName}» (user ${bitrixUserId}), stage=${stage}, oauth=${hasOAuth}`
  );

  const result = await sendBitrixNotify(bitrixUserId, message, tag, subTag);
  if (result.ok) {
    console.error(
      `[bitrixVacationNotify] OK #${request.id} → user ${bitrixUserId} via ${result.method}`
    );
    return;
  }

  console.error(
    `[bitrixVacationNotify] FAIL #${request.id} → user ${bitrixUserId}: ${result.error ?? 'unknown'}`
  );
}
