import { readFile, mkdir } from 'node:fs/promises';
import { writeJsonAtomic } from './atomicJson';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createError } from 'h3';
import { firstWorkingDayOfMonth, toIso } from '../../app/utils/vacationCalendar';

export type SalesBestAward = {
  id: string;
  /** Месяц, за который выбран лучший: YYYY-MM */
  period: string;
  employee_id: number;
  employee_name: string;
  selected_at: string;
  selected_by?: number;
  /** Первый рабочий день следующего месяца — с этой даты ачивка видна */
  reveal_on: string;
  /** Запись в ленте активности после reveal */
  activity_id?: string;
};

type SalesBestState = {
  awards: SalesBestAward[];
};

const DATA_FILE = join(process.cwd(), 'server/data/sales-best-awards.json');

const emptyState = (): SalesBestState => ({ awards: [] });

async function ensureFile() {
  await mkdir(dirname(DATA_FILE), { recursive: true });
  try {
    await readFile(DATA_FILE, 'utf8');
  } catch {
    await writeJsonAtomic(DATA_FILE, emptyState());
  }
}

async function readState(): Promise<SalesBestState> {
  await ensureFile();
  try {
    const raw = await readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<SalesBestState>;
    return { awards: Array.isArray(parsed.awards) ? parsed.awards : [] };
  } catch {
    return emptyState();
  }
}

async function writeState(state: SalesBestState): Promise<void> {
  await ensureFile();
  await writeJsonAtomic(DATA_FILE, state);
}

export function periodLabelRu(period: string): string {
  const [y, m] = period.split('-').map(Number);
  if (!y || !m) return period;
  const names = [
    'январь',
    'февраль',
    'март',
    'апрель',
    'май',
    'июнь',
    'июль',
    'август',
    'сентябрь',
    'октябрь',
    'ноябрь',
    'декабрь'
  ];
  return `${names[m - 1] || period} ${y}`;
}

/** Период YYYY-MM для календарной даты (МСК-день). */
export function periodFromDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Дата «сейчас» в Europe/Moscow как локальные Y/M/D. */
export function moscowCalendarDate(now = new Date()): { year: number; month: number; day: number; date: Date } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  return { year, month, day, date: new Date(year, month - 1, day) };
}

/** Reveal = первый рабочий день месяца, следующего за period. */
export function revealOnForPeriod(period: string): string {
  const [y, m] = period.split('-').map(Number);
  if (!y || !m) throw new Error(`Некорректный period: ${period}`);
  let nextY = y;
  let nextM = m + 1;
  if (nextM > 12) {
    nextM = 1;
    nextY += 1;
  }
  return firstWorkingDayOfMonth(nextY, nextM);
}

export async function listSalesBestAwards(): Promise<SalesBestAward[]> {
  const state = await readState();
  return [...state.awards].sort((a, b) => b.period.localeCompare(a.period));
}

export async function getSalesBestAwardForPeriod(period: string): Promise<SalesBestAward | null> {
  const state = await readState();
  return state.awards.find((row) => row.period === period) || null;
}

export function isAwardRevealed(award: SalesBestAward, todayIsoDate: string): boolean {
  return award.reveal_on <= todayIsoDate;
}

export async function countRevealedSalesBestForEmployee(
  employeeId: number,
  todayIsoDate = toIso(new Date())
): Promise<number> {
  const state = await readState();
  return state.awards.filter(
    (row) => row.employee_id === employeeId && isAwardRevealed(row, todayIsoDate)
  ).length;
}

export async function listRevealedSalesBestForEmployee(
  employeeId: number,
  todayIsoDate = toIso(new Date())
): Promise<SalesBestAward[]> {
  const state = await readState();
  return state.awards
    .filter((row) => row.employee_id === employeeId && isAwardRevealed(row, todayIsoDate))
    .sort((a, b) => b.period.localeCompare(a.period));
}

/** Выбор / перевыбор лучшего за period. */
export async function upsertSalesBestAward(input: {
  period: string;
  employee_id: number;
  employee_name: string;
  selected_by?: number;
}): Promise<SalesBestAward> {
  const period = String(input.period || '').trim();
  if (!/^\d{4}-\d{2}$/.test(period)) {
    throw createError({ statusCode: 400, statusMessage: 'period должен быть YYYY-MM' });
  }

  const state = await readState();
  const reveal_on = revealOnForPeriod(period);
  const now = new Date().toISOString();
  const existingIdx = state.awards.findIndex((row) => row.period === period);
  const previous = existingIdx >= 0 ? state.awards[existingIdx] : null;

  const award: SalesBestAward = {
    id: previous?.id || randomUUID(),
    period,
    employee_id: input.employee_id,
    employee_name: input.employee_name,
    selected_at: now,
    selected_by: input.selected_by,
    reveal_on,
    // если уже публиковали — обновим текст при следующем publish; до reveal id пустой
    activity_id: previous?.reveal_on === reveal_on ? previous.activity_id : undefined
  };

  if (existingIdx >= 0) {
    state.awards[existingIdx] = award;
  } else {
    state.awards.push(award);
  }
  await writeState(state);

  // если reveal уже наступил (редкий перевыбор) — сразу обновить ленту
  await publishRevealedSalesBestActivities();

  return award;
}

/**
 * Ачивка + лента: в день reveal_on (и позже) публикуем событие в profile-activity.
 * Идемпотентно. Не создаём раньше — интрига до первого рабочего дня.
 */
export async function publishRevealedSalesBestActivities(
  todayIsoDate?: string
): Promise<{ published: number }> {
  const { upsertAutoProfileActivity } = await import('./profileActivityStore');
  const { year, month, day } = moscowCalendarDate();
  const today =
    todayIsoDate ||
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const state = await readState();
  let published = 0;

  for (const award of state.awards) {
    if (!isAwardRevealed(award, today)) continue;

    const activityId = `sales-best-${award.period}`;
    const label = periodLabelRu(award.period);
    await upsertAutoProfileActivity({
      id: activityId,
      employee_id: award.employee_id,
      kind: 'achievement',
      text: `${award.employee_name} получил(а) ачивку «Лучший специалист продаж» (${label})`,
      occurred_at: award.reveal_on
    });

    if (award.activity_id !== activityId) {
      award.activity_id = activityId;
      published += 1;
    }
  }

  if (published) await writeState(state);
  return { published };
}
