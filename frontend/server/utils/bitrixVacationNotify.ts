import type { VacationRequest } from '../../app/composables/useVacations';
import { getBitrixConfig, getBitrixWebhookUrl, isBitrixWebhookConfigured } from './bitrixConfig';
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
 * На коробке im.notify.* иногда возвращает time.start (~10⁹) — это не доставка.
 */
const isBitrixEntityId = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 && value < 1_000_000_000;

const bitrixNotifyClientId = (): string => {
  const fromEnv = String(process.env.BITRIX_CLIENT_ID || '').trim();
  if (fromEnv) return fromEnv;
  return String(getBitrixConfig().bitrixClientId || '').trim();
};

const bitrixWebhookCall = async (
  method: string,
  params: Record<string, unknown>
): Promise<BitrixRestPayload> => {
  const base = getBitrixWebhookUrl();
  const clientId = bitrixNotifyClientId();
  const url = clientId
    ? `${base}/${method}.json?CLIENT_ID=${encodeURIComponent(clientId)}`
    : `${base}/${method}.json`;
  const response = await fetch(url, {
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

const sendBitrixBellNotify = async (
  bitrixUserId: number,
  message: string,
  tag: string,
  subTag: string
): Promise<{ ok: boolean; method?: string; error?: string }> => {
  const attempts: Array<{ method: string; params: Record<string, unknown> }> = [
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
    },
    {
      method: 'im.notify',
      params: {
        USER_ID: bitrixUserId,
        MESSAGE: message,
        TYPE: 'SYSTEM',
        TAG: tag,
        SUB_TAG: subTag
      }
    }
  ];

  const errors: string[] = [];

  for (const attempt of attempts) {
    try {
      const data = await bitrixWebhookCall(attempt.method, attempt.params);
      if (data.error) {
        const detail = data.error_description || data.error;
        errors.push(`${attempt.method}: ${detail}`);
        console.error(`[bitrixVacationNotify] ${attempt.method} error: ${detail}`);
        continue;
      }
      if (isBitrixEntityId(data.result)) {
        return { ok: true, method: attempt.method };
      }
      const bogus = String(data.result);
      errors.push(`${attempt.method}: result=${bogus}`);
      console.error(
        `[bitrixVacationNotify] ${attempt.method}: result не похож на ID уведомления (${bogus})`
      );
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      errors.push(`${attempt.method}: ${detail}`);
      console.error(`[bitrixVacationNotify] ${attempt.method} fetch failed: ${detail}`);
    }
  }

  return { ok: false, error: errors.join('; ') || 'колокольчик недоступен' };
};

const sendBitrixNotify = async (
  bitrixUserId: number,
  message: string,
  tag: string,
  subTag: string
): Promise<{ ok: boolean; method?: string; error?: string }> => {
  const bellResult = await sendBitrixBellNotify(bitrixUserId, message, tag, subTag);
  if (bellResult.ok) return bellResult;

  console.error(
    `[bitrixVacationNotify] колокольчик не доставлен (user ${bitrixUserId}), пробуем личный чат`
  );

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
  if (!isBitrixWebhookConfigured()) {
    console.error('[bitrixVacationNotify] BITRIX_WEBHOOK_URL не задан — пропуск');
    return;
  }
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

  console.error(
    `[bitrixVacationNotify] отправка #${request.id} → «${approverName}» (user ${bitrixUserId}), stage=${stage}`
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
