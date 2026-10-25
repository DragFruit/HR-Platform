/**
 * Годы, на которые можно оформлять новые заявки и брони: текущий учётный (`primaryYear`)
 * и следующий. Старые заявки прошлых лет правятся и удаляются как раньше.
 */

export const isBookableVacationYear = (year: number, primaryYear: number): boolean =>
  Number.isInteger(year) && (year === primaryYear || year === primaryYear + 1);

export const vacationRequestYearMessage = (primaryYear: number): string =>
  `Отпуск можно оформить только на ${primaryYear} или ${primaryYear + 1} год. Следующий год откроется после смены учётного года 1 января.`;

export const vacationReservationYearMessage = (primaryYear: number): string =>
  `Бронь можно поставить только на ${primaryYear} или ${primaryYear + 1} год. Следующий год откроется после смены учётного года 1 января.`;

export const vacationEndYearMessage = 'Отпуск может переходить через Новый год не больше чем на один год вперёд.';

const isoYear = (iso: string): number => Number(String(iso || '').slice(0, 4));

/**
 * Ошибка для новой заявки или новых дат (null — всё ок).
 * previousStart — дата начала до правки: если год начала не меняется, старая заявка
 * прошлого года правится как раньше (без ограничения по году).
 */
export function vacationBookingYearError(
  start: string,
  end: string,
  primaryYear: number,
  previousStart?: string
): string | null {
  const startYear = isoYear(start);
  const endYear = isoYear(end);
  if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) return null;
  const keepsOldYear =
    previousStart !== undefined && isoYear(previousStart) === startYear && startYear < primaryYear;
  if (!keepsOldYear && !isBookableVacationYear(startYear, primaryYear)) {
    return vacationRequestYearMessage(primaryYear);
  }
  if (endYear > startYear + 1) return vacationEndYearMessage;
  return null;
}

/**
 * Заявки из папок year-1, year, year+1 без дублей: отпуск через Новый год лежит в папке года начала,
 * поэтому для календаря и проверок пересечений года нужны соседние папки.
 */
export function requestsAroundYear<T extends { id: number }>(
  requestsByYear: Record<string, T[] | undefined>,
  year: number
): T[] {
  const byId = new Map<number, T>();
  for (const y of [year - 1, year, year + 1]) {
    for (const req of requestsByYear[String(y)] ?? []) byId.set(req.id, req);
  }
  return [...byId.values()];
}
