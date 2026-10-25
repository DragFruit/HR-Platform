import type { UserNotification } from './types';

/** Строка notifications.user_notifications в виде, который принимает/отдаёт Drizzle. */
export type UserNotificationRow = {
  id: string;
  kind: string;
  recipientUserId: number;
  vacationRequestId: number | null;
  employeeName: string;
  startDate: string | null;
  endDate: string | null;
  stageLabel: string | null;
  ideaId: string | null;
  ideaTitle: string | null;
  statusComment: string | null;
  createdAt: Date;
  seen: boolean;
  seenAt: Date | null;
  hiddenFromBell: boolean;
  hiddenAt: Date | null;
  extra: Record<string, unknown> | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID_RE.test(value);

const KNOWN_KEYS = new Set([
  'id',
  'kind',
  'recipient_user_id',
  'vacation_request_id',
  'employee_name',
  'start',
  'end',
  'stage_label',
  'idea_id',
  'idea_title',
  'status_comment',
  'created_at',
  'seen',
  'hidden_from_bell'
]);

const optText = (value: unknown): string | null =>
  value === undefined || value === null ? null : String(value);

const optInt = (value: unknown): number | null => {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
};

/**
 * JSON-запись → строка БД. null — запись нельзя положить без выдумывания данных
 * (нет валидного id / получателя / даты создания); такие считаются skipped при импорте.
 * Нестандартные поля и значения, не влезающие в колонку, уходят в `extra`, а не теряются.
 */
export function notificationToRow(item: Record<string, unknown>): UserNotificationRow | null {
  if (!isUuid(item.id)) return null;
  const recipient = optInt(item.recipient_user_id);
  if (recipient === null) return null;
  const created = new Date(String(item.created_at ?? ''));
  if (!item.created_at || Number.isNaN(created.getTime())) return null;
  if (typeof item.kind !== 'string' || !item.kind) return null;

  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(item)) {
    if (!KNOWN_KEYS.has(key)) extra[key] = value;
  }

  const dateOrExtra = (key: 'start' | 'end'): string | null => {
    const value = item[key];
    if (value === undefined || value === null) return null;
    if (typeof value === 'string' && ISO_DATE_RE.test(value)) return value;
    extra[key] = value;
    return null;
  };

  let vacationRequestId: number | null = null;
  if (item.vacation_request_id !== undefined && item.vacation_request_id !== null) {
    vacationRequestId = optInt(item.vacation_request_id);
    if (vacationRequestId === null) extra.vacation_request_id = item.vacation_request_id;
  }

  return {
    id: item.id.toLowerCase(),
    kind: item.kind,
    recipientUserId: recipient,
    vacationRequestId,
    employeeName: optText(item.employee_name) ?? '',
    startDate: dateOrExtra('start'),
    endDate: dateOrExtra('end'),
    stageLabel: optText(item.stage_label),
    ideaId: optText(item.idea_id),
    ideaTitle: optText(item.idea_title),
    statusComment: optText(item.status_comment),
    createdAt: created,
    seen: item.seen === true,
    seenAt: null,
    hiddenFromBell: item.hidden_from_bell === true,
    hiddenAt: null,
    extra: Object.keys(extra).length ? extra : null
  };
}

/** Строка БД → тот же JSON-формат, что отдавал API раньше (необязательные поля без null). */
export function rowToNotification(row: UserNotificationRow): UserNotification {
  const out: Record<string, unknown> = { ...(row.extra ?? {}) };
  out.id = row.id;
  out.kind = row.kind;
  out.recipient_user_id = row.recipientUserId;
  if (row.vacationRequestId !== null) out.vacation_request_id = row.vacationRequestId;
  out.employee_name = row.employeeName;
  if (row.startDate !== null) out.start = row.startDate;
  if (row.endDate !== null) out.end = row.endDate;
  if (row.stageLabel !== null) out.stage_label = row.stageLabel;
  if (row.ideaId !== null) out.idea_id = row.ideaId;
  if (row.ideaTitle !== null) out.idea_title = row.ideaTitle;
  if (row.statusComment !== null) out.status_comment = row.statusComment;
  out.created_at = new Date(row.createdAt).toISOString();
  out.seen = row.seen;
  out.hidden_from_bell = row.hiddenFromBell;
  return out as UserNotification;
}
