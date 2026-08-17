import type { VacationRequest } from '~/composables/useVacations';
import { toIso } from '~/utils/vacationCalendar';
import {
  POST_VACATION_MEMO_MIN_DAYS,
  POST_VACATION_MEMO_WINDOW_DAYS
} from '~/data/postVacationMemoSlides';

export const addDaysIso = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toIso(d);
};

export const inclusiveDays = (start: string, end: string): number => {
  const a = new Date(`${start}T00:00:00`);
  const b = new Date(`${end}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
};

export function findPostVacationMemoRequest(
  requests: VacationRequest[],
  employeeName: string,
  todayIso: string,
  seenIds: ReadonlySet<number>
): VacationRequest | null {
  const name = employeeName.trim();
  if (!name) return null;

  const eligible = requests.filter((row) => {
    if (row.status !== 'approved') return false;
    if (row.employee.trim() !== name) return false;
    if (seenIds.has(row.id)) return false;
    if (inclusiveDays(row.start, row.end) < POST_VACATION_MEMO_MIN_DAYS) return false;
    if (todayIso <= row.end) return false;
    const lastShow = addDaysIso(row.end, POST_VACATION_MEMO_WINDOW_DAYS);
    return todayIso <= lastShow;
  });

  if (!eligible.length) return null;
  return [...eligible].sort((a, b) => b.end.localeCompare(a.end) || b.id - a.id)[0] ?? null;
}
