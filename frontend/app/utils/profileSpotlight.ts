import type { VacationRequest } from '~/composables/useVacations';

const MS_DAY = 86_400_000;

export function daysUntilDate(isoDate: string, from = new Date()): number {
  const start = new Date(`${isoDate}T12:00:00`);
  const today = new Date(from);
  today.setHours(12, 0, 0, 0);
  start.setHours(12, 0, 0, 0);
  return Math.round((start.getTime() - today.getTime()) / MS_DAY);
}

/** Ближайший отпуск, который начнётся в течение maxDays дней (включительно). */
export function findUpcomingVacationWithinDays(
  requests: VacationRequest[],
  maxDays: number,
  todayIso = new Date().toISOString().slice(0, 10)
): VacationRequest | null {
  const upcoming = requests
    .filter((request) => {
      // Для spotlight показываем только реально подтвержденные (approved) отпуска,
      // чтобы не отображать "заявка на отпуск".
      if (request.status !== 'approved') return false;
      if (request.end < todayIso) return false;
      const days = daysUntilDate(request.start, new Date(`${todayIso}T12:00:00`));
      return days >= 0 && days <= maxDays;
    })
    .sort((a, b) => a.start.localeCompare(b.start));

  return upcoming[0] ?? null;
}

/** Дата начала отпуска для плитки «Скоро в отпуск»: «2026-02-23» → «23.02.26». */
export function formatVacationStartDdMmYy(startIso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(startIso);
  if (!m) return startIso;
  return `${m[3]}.${m[2]}.${m[1]!.slice(2)}`;
}
