import { notifyBitrixSystemUser } from './bitrixVacationNotify';
import {
  findEmployeeByPlatformUserId,
  findEmployeeByName,
  type ServerEmployee
} from './employeesStore';
import { createUserNotification } from './userNotificationsStore';

export type IdeaNotifyStatus = 'review' | 'implementation' | 'done' | 'rejected';

const STATUS_LABELS: Record<IdeaNotifyStatus, string> = {
  review: 'На рассмотрении',
  implementation: 'Реализация',
  done: 'Реализовано',
  rejected: 'Отклонено'
};

const STATUS_TITLES: Record<IdeaNotifyStatus, string> = {
  review: 'Идея на рассмотрении',
  implementation: 'Идея взята в работу',
  done: 'Идея реализована',
  rejected: 'Идея отклонена'
};

const ideasUrl = (): string | null => {
  const candidates = [
    String(process.env.APP_PUBLIC_URL || '').trim(),
    String(process.env.BITRIX_REDIRECT_URI || '').trim()
  ];
  for (const raw of candidates) {
    if (!raw) continue;
    try {
      return `${new URL(raw).origin}/ideas`;
    } catch {
      /* next */
    }
  }
  return null;
};

const resolveAuthorEmployee = async (
  authorUserId: number,
  authorName: string
): Promise<ServerEmployee | null> => {
  const byId = await findEmployeeByPlatformUserId(authorUserId);
  if (byId) return byId;
  if (authorName.trim()) return findEmployeeByName(authorName.trim());
  return null;
};

const bitrixUserIdOf = (employee: ServerEmployee): number | null => {
  const id = employee.bitrix_user_id ?? employee.platform_user_id ?? employee.id;
  return typeof id === 'number' && id > 0 ? id : null;
};

const buildBitrixMessage = (
  ideaTitle: string,
  status: IdeaNotifyStatus,
  comment: string | undefined,
  url: string
): string => {
  const lines = [
    STATUS_TITLES[status],
    '',
    `Идея: «${ideaTitle}»`,
    `Этап: ${STATUS_LABELS[status]}`
  ];
  const trimmed = comment?.trim();
  if (trimmed) lines.push(`Комментарий: ${trimmed}`);
  lines.push('', `[URL=${url}]Открыть банк идей в Vibe[/URL]`);
  return lines.join('\n');
};

export async function notifyIdeaAuthorStatusChanged(input: {
  author_user_id: number;
  author_name: string;
  idea_id: string;
  idea_title: string;
  status: IdeaNotifyStatus;
  comment?: string;
}): Promise<{ ok: true }> {
  const status = input.status;
  const stageLabel = STATUS_LABELS[status];
  const comment = input.comment?.trim() || undefined;

  await createUserNotification({
    kind: 'idea_status_changed',
    recipient_user_id: input.author_user_id,
    employee_name: input.author_name,
    idea_id: input.idea_id,
    idea_title: input.idea_title,
    stage_label: stageLabel,
    status_comment: comment
  });

  const employee = await resolveAuthorEmployee(input.author_user_id, input.author_name);
  const bitrixUserId = employee ? bitrixUserIdOf(employee) : input.author_user_id;
  const url = ideasUrl();
  if (!bitrixUserId || !url) return { ok: true };

  await notifyBitrixSystemUser({
    bitrixUserId,
    message: buildBitrixMessage(input.idea_title, status, comment, url),
    tag: `VBI_HR_IDEA_${input.idea_id}_${status}`,
    subTag: `VBI_HR|idea|${input.idea_id}|${status}`,
    logLabel: `idea ${input.idea_id} status=${status}`
  });

  return { ok: true };
}

export { STATUS_LABELS as IDEA_STATUS_LABELS, STATUS_TITLES as IDEA_STATUS_TITLES };
