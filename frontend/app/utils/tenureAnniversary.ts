/**
 * Юбилеи в компании: 1 / 5 / 10 / 15 лет от hired_at.
 * Подарки/ачивки/купоны — для порогов 5 / 10 / 15.
 */

export const TENURE_ANNIVERSARY_YEARS = [1, 5, 10, 15] as const;
export type TenureAnniversaryYears = (typeof TENURE_ANNIVERSARY_YEARS)[number];

/** Пороги с юбилейным набором (медаль + вино + премия). */
export const TENURE_GIFT_YEARS = [5, 10, 15] as const;
export type TenureGiftYears = (typeof TENURE_GIFT_YEARS)[number];

export const TENURE_NOTIFY_DAYS_BEFORE = 5;

export type TenureGiftSet = {
  years: TenureGiftYears;
  medalLabel: string;
  wineYears: number;
  bonusRub: number;
  couponTitle: string;
  shopSku: string;
};

export const TENURE_GIFT_SETS: Record<TenureGiftYears, TenureGiftSet> = {
  5: {
    years: 5,
    medalLabel: '5 лет',
    wineYears: 5,
    bonusRub: 5000,
    couponTitle: 'Купон: юбилейный набор 5 лет',
    shopSku: 'tenure-gift-5'
  },
  10: {
    years: 10,
    medalLabel: '10 лет',
    wineYears: 10,
    bonusRub: 10000,
    couponTitle: 'Купон: юбилейный набор 10 лет',
    shopSku: 'tenure-gift-10'
  },
  15: {
    years: 15,
    medalLabel: '15 лет',
    wineYears: 15,
    bonusRub: 15000,
    couponTitle: 'Купон: юбилейный набор 15 лет',
    shopSku: 'tenure-gift-15'
  }
};

const parseHire = (hiredAt: string): Date | null => {
  const d = new Date(`${hiredAt}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Дата юбилея N лет (тот же день/месяц, что hired_at). */
export const anniversaryDateIso = (hiredAt: string, years: number): string | null => {
  const hire = parseHire(hiredAt);
  if (!hire) return null;
  const a = new Date(hire);
  a.setFullYear(hire.getFullYear() + years);
  return ymd(a);
};

export const isAnniversaryToday = (
  hiredAt: string,
  years: TenureAnniversaryYears,
  asOf: Date = new Date()
): boolean => anniversaryDateIso(hiredAt, years) === ymd(asOf);

/** За сколько дней до юбилея (0 = день юбилея, null = не в окне). */
export const daysUntilAnniversary = (
  hiredAt: string,
  years: TenureAnniversaryYears,
  asOf: Date = new Date()
): number | null => {
  const iso = anniversaryDateIso(hiredAt, years);
  if (!iso) return null;
  const target = new Date(`${iso}T12:00:00`);
  const today = new Date(`${ymd(asOf)}T12:00:00`);
  const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  return diff;
};

export const dueAnniversaryReminders = (
  hiredAt: string,
  asOf: Date = new Date()
): Array<{ years: TenureAnniversaryYears; daysUntil: number; kind: 'd5' | 'day' }> => {
  const out: Array<{ years: TenureAnniversaryYears; daysUntil: number; kind: 'd5' | 'day' }> = [];
  for (const years of TENURE_ANNIVERSARY_YEARS) {
    const daysUntil = daysUntilAnniversary(hiredAt, years, asOf);
    if (daysUntil === null) continue;
    if (daysUntil === TENURE_NOTIFY_DAYS_BEFORE) out.push({ years, daysUntil, kind: 'd5' });
    if (daysUntil === 0) out.push({ years, daysUntil, kind: 'day' });
  }
  return out;
};

export const tenureAnniversaryNotifyKey = (
  employeeId: number,
  years: number,
  kind: 'd5' | 'day' | 'claim'
) => `tenure-anniversary-${employeeId}-${years}y-${kind}`;

export const formatHiredAtRu = (hiredAt: string): string => {
  const d = parseHire(hiredAt);
  if (!d) return hiredAt;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
};

/** Полных лет стажа от hired_at (0, если меньше года). */
export const yearsOfService = (hiredAt: string, asOf: Date = new Date()): number => {
  const hire = parseHire(hiredAt);
  if (!hire) return 0;
  let years = asOf.getFullYear() - hire.getFullYear();
  const md = asOf.getMonth() - hire.getMonth();
  if (md < 0 || (md === 0 && asOf.getDate() < hire.getDate())) years -= 1;
  return Math.max(0, years);
};

export const yearsOfServiceLabel = (hiredAt: string, asOf: Date = new Date()): string => {
  const years = yearsOfService(hiredAt, asOf);
  if (!parseHire(hiredAt)) return '—';
  if (years === 0) return 'меньше года';
  const mod10 = years % 10;
  const mod100 = years % 100;
  if (mod10 === 1 && mod100 !== 11) return `${years} год`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${years} года`;
  return `${years} лет`;
};
