/** Юбилеи стажа: начисление внутренней валюты (кошелёк). */

export const TENURE_MILESTONE_YEARS = [5, 10, 15, 20] as const;

export type TenureMilestoneYears = (typeof TENURE_MILESTONE_YEARS)[number];

/**
 * Сколько монет за каждый юбилей.
 * `null` — сумму ещё не утвердили: начисление не делается.
 * Когда посчитаете баланс — просто проставьте числа.
 */
export const TENURE_MILESTONE_AMOUNTS: Record<TenureMilestoneYears, number | null> = {
  5: null,
  10: null,
  15: null,
  20: null
};

/** Полных лет в компании на дату `asOf` (по anniversary от hired_at). */
export const yearsOfService = (hiredAt: string, asOf: Date = new Date()): number => {
  const hire = new Date(`${hiredAt}T12:00:00`);
  if (Number.isNaN(hire.getTime())) return 0;
  let years = asOf.getFullYear() - hire.getFullYear();
  const monthDiff = asOf.getMonth() - hire.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && asOf.getDate() < hire.getDate())) {
    years -= 1;
  }
  return Math.max(0, years);
};

export const tenureMilestoneIdempotencyKey = (userId: number, years: TenureMilestoneYears) =>
  `tenure-milestone-${userId}-${years}y`;

export const tenureMilestoneReason = (years: TenureMilestoneYears) =>
  `Юбилей стажа: ${years} лет в компании`;

/** Достигнутые юбилеи с положительной суммой (готовы к начислению). */
export const dueTenureMilestones = (
  hiredAt: string,
  asOf: Date = new Date()
): Array<{ years: TenureMilestoneYears; amount: number }> => {
  const serviceYears = yearsOfService(hiredAt, asOf);
  const due: Array<{ years: TenureMilestoneYears; amount: number }> = [];
  for (const years of TENURE_MILESTONE_YEARS) {
    if (serviceYears < years) continue;
    const amount = TENURE_MILESTONE_AMOUNTS[years];
    if (typeof amount === 'number' && amount > 0) {
      due.push({ years, amount });
    }
  }
  return due;
};
