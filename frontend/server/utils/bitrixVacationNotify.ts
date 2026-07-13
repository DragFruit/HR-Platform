import type { VacationRequest } from '../../app/composables/useVacations';
import { bitrixWebhookRest } from './bitrixClient';
import { isBitrixWebhookConfigured } from './bitrixConfig';
import { findEmployeeByName } from './employeesStore';

export type BitrixVacationNotifyStage = 'new' | 'director';

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
      return `${origin}/vacations`;
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

/** Пуш в Битрикс текущему согласующему; ошибки не пробрасываются. */
export async function notifyBitrixVacationApprover(
  request: VacationRequest,
  approverName: string,
  stage: BitrixVacationNotifyStage = 'new'
): Promise<void> {
  if (!isBitrixWebhookConfigured() || request.status !== 'pending') return;

  const approvalUrl = vacationApprovalUrl();
  if (!approvalUrl) {
    console.warn(
      '[bitrixVacationNotify] Не задан APP_PUBLIC_URL или BITRIX_REDIRECT_URI — пропуск im.notify'
    );
    return;
  }

  const bitrixUserId = await bitrixUserIdForApprover(approverName);
  if (!bitrixUserId) {
    console.warn(
      `[bitrixVacationNotify] У согласующего «${approverName}» нет bitrix_user_id — пропуск im.notify`
    );
    return;
  }

  const message = buildNotifyMessage(request, stage, approvalUrl);

  try {
    await bitrixWebhookRest<boolean>('im.notify', {
      to: bitrixUserId,
      message,
      type: 'SYSTEM'
    });
  } catch (err) {
    const detail =
      err && typeof err === 'object' && 'statusMessage' in err
        ? String((err as { statusMessage?: string }).statusMessage || '')
        : err instanceof Error
          ? err.message
          : String(err);
    console.warn(
      `[bitrixVacationNotify] im.notify для «${approverName}» (user ${bitrixUserId}): ${detail}`
    );
  }
}
