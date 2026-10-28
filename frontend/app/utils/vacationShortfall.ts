import type { VacationRequest } from '~/composables/useVacations';
import { assessVacationBalance, type VacationBalanceAssessment } from '~/utils/vacationBalance';

/**
 * Нельзя подать заявку больше доступного остатка.
 * Одна функция для формы (клиент) и для API (сервер): нужные billable-дни периода
 * против «хватит ли дней» к дате начала (assessVacationBalance: начисления к дате,
 * минус approved и pending; при смене дат сама заявка исключается).
 */

/** 2.5 → «2,5», 3 → «3» (как в остальном UI отпусков). */
export const formatVacationDaysAmount = (value: number): string => {
  const rounded = Math.round(value * 10) / 10;
  return String(rounded).replace('.', ',');
};

/** Родительный падеж после «не хватает»: 1 дня, 21 дня, 0,5 дня; 2, 3, 5, 11 дней. */
export const vacationDaysGenitive = (value: number): string => {
  const rounded = Math.round(value * 10) / 10;
  if (!Number.isInteger(rounded)) return 'дня';
  const n = Math.abs(rounded);
  return n % 10 === 1 && n % 100 !== 11 ? 'дня' : 'дней';
};

export const vacationShortfallMessage = (shortfall: number): string =>
  `Не хватает ${formatVacationDaysAmount(shortfall)} ${vacationDaysGenitive(shortfall)} отпуска. Измените даты.`;

export type VacationShortfallInput = {
  employeeName: string;
  hireIso?: string | null;
  start: string;
  end: string;
  requests: VacationRequest[];
  primaryYear: number;
  /** При смене дат: id самой заявки, её старые дни не считаются занятыми. */
  excludeRequestId?: number;
  openingBalance?: number | null;
};

export type VacationShortfall = {
  /** Сколько дней не хватает (0,1 точность), 0 если хватает или посчитать нельзя. */
  shortfall: number;
  message: string;
  assessment: VacationBalanceAssessment;
};

export const assessVacationShortfall = (input: VacationShortfallInput): VacationShortfall => {
  const assessment = assessVacationBalance(
    input.employeeName,
    input.hireIso || undefined,
    input.start,
    input.end,
    input.requests,
    input.primaryYear,
    input.excludeRequestId,
    input.openingBalance
  );
  const shortfall = assessment.status === 'advance' ? assessment.deficit : 0;
  return { shortfall, message: shortfall > 0 ? vacationShortfallMessage(shortfall) : '', assessment };
};

/**
 * Блокировать ли нехватку: сотрудник подаёт / правит свою заявку — да.
 * HR/админ оформляют отпуск другому сотруднику — нет (исключения), только предупреждение.
 */
export const isVacationShortfallBlocking = (opts: { rosterWide: boolean; ownRequest: boolean }): boolean =>
  !opts.rosterWide || opts.ownRequest;
