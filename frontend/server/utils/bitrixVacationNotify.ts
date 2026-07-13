import type { VacationRequest } from '../../app/composables/useVacations';
import { getBitrixWebhookUrl, isBitrixWebhookConfigured } from './bitrixConfig';
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
  `VBI_HR_VAC_${requestId}_${stage}_${Date.now()}`;

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

const sendBitrixNotify = async (
  bitrixUserId: number,
  message: string,
  tag: string
): Promise<{ ok: boolean; method?: string; error?: string }> => {
  const attempts: Array<{ method: string; params: Record<string, unknown> }> = [
    {
      method: 'im.notify.system.add',
      params: { USER_ID: bitrixUserId, MESSAGE: message, TAG: tag }
    },
    {
      method: 'im.notify',
      params: { USER_ID: bitrixUserId, MESSAGE: message, TYPE: 'SYSTEM', TAG: tag }
    }
  ];

  for (const attempt of attempts) {
    try {
      const data = await bitrixWebhookCall(attempt.method, attempt.params);
      if (data.error) {
        const detail = data.error_description || data.error;
        console.error(`[bitrixVacationNotify] ${attempt.method} error: ${detail}`);
        continue;
      }
      if (data.result !== undefined && data.result !== null) {
        return { ok: true, method: attempt.method };
      }
      console.error(`[bitrixVacationNotify] ${attempt.method}: пустой result`);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error(`[bitrixVacationNotify] ${attempt.method} fetch failed: ${detail}`);
    }
  }

  return { ok: false, error: 'не удалось отправить im.notify' };
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
      '[bitrixVacationNotify] Не задан APP_PUBLIC_URL или BITRIX_REDIRECT_URI — пропуск im.notify'
    );
    return;
  }

  const bitrixUserId = await bitrixUserIdForApprover(approverName);
  if (!bitrixUserId) {
    console.error(
      `[bitrixVacationNotify] У согласующего «${approverName}» нет bitrix_user_id — пропуск im.notify`
    );
    return;
  }

  const message = buildNotifyMessage(request, stage, approvalUrl);
  const tag = notifyTag(request.id, stage);

  console.error(
    `[bitrixVacationNotify] отправка #${request.id} → «${approverName}» (user ${bitrixUserId}), stage=${stage}`
  );

  const result = await sendBitrixNotify(bitrixUserId, message, tag);
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
