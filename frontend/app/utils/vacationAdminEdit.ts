/**
 * Правка уже созданной заявки админом / HR (даты, комментарий) без смены статуса.
 * Общие правила для UI (`/admin/vacations`) и сервера (`patchVacationRequest`).
 */

export type VacationAdminEditorRole = 'admin' | 'hr';

/** Запись истории правки, хранится в самой заявке (`admin_edits`, в Postgres уходит в `extra`). */
export type VacationAdminEditEntry = {
  /** ISO-время правки. */
  at: string;
  by_employee_id: number | null;
  by_name: string;
  by_role: VacationAdminEditorRole;
  start_before: string;
  end_before: string;
  start_after: string;
  end_after: string;
  comment_changed?: boolean;
  /** Готовая строка «изменено админом …: было …, стало …». */
  summary: string;
};

/** Сколько последних правок держим в заявке. */
export const VACATION_ADMIN_EDITS_MAX = 20;

export const VACATION_COMMENT_MAX_LENGTH = 500;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const isVacationAdminEditorRole = (role: unknown): role is VacationAdminEditorRole =>
  role === 'admin' || role === 'hr';

/** Админ/HR правит заявку «на согласовании» или «согласован» (отклонённые не трогаем). */
export const canAdminEditVacationRequest = (
  role: unknown,
  request: { status: string } | null | undefined
): boolean =>
  isVacationAdminEditorRole(role) &&
  Boolean(request) &&
  (request!.status === 'pending' || request!.status === 'approved');

const isRealIsoDate = (iso: string): boolean => {
  if (!ISO_DATE_RE.test(iso)) return false;
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};

/** Базовая проверка дат правки (год/остаток/пересечения проверяет сервер тем же кодом, что при создании). */
export function validateVacationEditDates(start: string, end: string): string | null {
  const s = String(start || '').trim();
  const e = String(end || '').trim();
  if (!s || !e) return 'Укажите даты начала и окончания.';
  if (!isRealIsoDate(s) || !isRealIsoDate(e)) return 'Некорректная дата.';
  if (e < s) return 'Дата окончания не может быть раньше даты начала.';
  return null;
}

/** 2026-12-05 → 05.12.2026 (без Date, не зависит от пояса). */
export const formatIsoDateRu = (iso: string): string => {
  const [y, m, d] = String(iso || '').split('-');
  return y && m && d ? `${d}.${m}.${y}` : String(iso || '');
};

export const formatVacationRangeRu = (start: string, end: string): string =>
  start === end ? formatIsoDateRu(start) : `${formatIsoDateRu(start)}–${formatIsoDateRu(end)}`;

const actorWord = (role: VacationAdminEditorRole) => (role === 'hr' ? 'HR' : 'админом');

export function formatAdminEditHistoryLine(input: {
  actorName: string;
  actorRole: VacationAdminEditorRole;
  before: { start: string; end: string };
  after: { start: string; end: string };
  commentChanged?: boolean;
}): string {
  const who = `изменено ${actorWord(input.actorRole)} ${input.actorName.trim() || 'без имени'}`;
  const datesChanged =
    input.before.start !== input.after.start || input.before.end !== input.after.end;
  const parts: string[] = [];
  if (datesChanged) {
    parts.push(
      `было ${formatVacationRangeRu(input.before.start, input.before.end)}, стало ${formatVacationRangeRu(
        input.after.start,
        input.after.end
      )}`
    );
  }
  if (input.commentChanged) parts.push('комментарий');
  return parts.length ? `${who}: ${parts.join('; ')}` : who;
}

export function buildVacationAdminEditEntry(input: {
  at?: string;
  actorEmployeeId: number | null | undefined;
  actorName: string;
  actorRole: VacationAdminEditorRole;
  before: { start: string; end: string; comment?: string };
  after: { start: string; end: string; comment?: string };
}): VacationAdminEditEntry | null {
  const datesChanged =
    input.before.start !== input.after.start || input.before.end !== input.after.end;
  const commentChanged = (input.before.comment ?? '') !== (input.after.comment ?? '');
  if (!datesChanged && !commentChanged) return null;
  const entry: VacationAdminEditEntry = {
    at: input.at ?? new Date().toISOString(),
    by_employee_id: Number(input.actorEmployeeId) > 0 ? Number(input.actorEmployeeId) : null,
    by_name: input.actorName.trim(),
    by_role: input.actorRole,
    start_before: input.before.start,
    end_before: input.before.end,
    start_after: input.after.start,
    end_after: input.after.end,
    summary: formatAdminEditHistoryLine({
      actorName: input.actorName,
      actorRole: input.actorRole,
      before: input.before,
      after: input.after,
      commentChanged
    })
  };
  if (commentChanged) entry.comment_changed = true;
  return entry;
}

/** Добавить правку в историю заявки, держим последние `max`. */
export const appendVacationAdminEdit = (
  list: VacationAdminEditEntry[] | undefined | null,
  entry: VacationAdminEditEntry,
  max = VACATION_ADMIN_EDITS_MAX
): VacationAdminEditEntry[] => [...(Array.isArray(list) ? list : []), entry].slice(-max);
