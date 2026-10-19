import { randomUUID } from 'node:crypto';
import { createError } from 'h3';
import { firstWorkingDayOfMonth, toIso } from '../../app/utils/vacationCalendar';
import type { SalesBestAwardRaw } from '../profile/domains';
import type { KeyedListWriteContext } from '../db/repositories/keyedList';
import { salesBestAwardsRepo } from './profileStore';

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

/**
 * Награды «Лучший специалист продаж». Этап 6: DB_PROFILE=1 → profile.sales_best_awards,
 * иначе server/data/sales-best-awards.json. API не менялся; правки — через repo().mutate.
 */
async function readAwards(): Promise<SalesBestAward[]> {
  return (await (await salesBestAwardsRepo()).read()) as unknown as SalesBestAward[];
}

async function mutateAwards<R>(fn: (awards: SalesBestAward[]) => R, ctx: KeyedListWriteContext): Promise<R> {
  return (await salesBestAwardsRepo()).mutate((raw: SalesBestAwardRaw[]) => fn(raw as unknown as SalesBestAward[]), ctx);
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
  return [...(await readAwards())].sort((a, b) => b.period.localeCompare(a.period));
}

export async function getSalesBestAwardForPeriod(period: string): Promise<SalesBestAward | null> {
  return (await readAwards()).find((row) => row.period === period) || null;
}

export function isAwardRevealed(award: SalesBestAward, todayIsoDate: string): boolean {
  return award.reveal_on <= todayIsoDate;
}

export async function countRevealedSalesBestForEmployee(
  employeeId: number,
  todayIsoDate = toIso(new Date())
): Promise<number> {
  return (await readAwards()).filter(
    (row) => row.employee_id === employeeId && isAwardRevealed(row, todayIsoDate)
  ).length;
}

export async function listRevealedSalesBestForEmployee(
  employeeId: number,
  todayIsoDate = toIso(new Date())
): Promise<SalesBestAward[]> {
  return (await readAwards())
    .filter((row) => row.employee_id === employeeId && isAwardRevealed(row, todayIsoDate))
    .sort((a, b) => b.period.localeCompare(a.period));
}

/** Выбор / перевыбор лучшего за period. */
export async function upsertSalesBestAward(
  input: {
    period: string;
    employee_id: number;
    employee_name: string;
    selected_by?: number;
  },
  ctx: KeyedListWriteContext = {}
): Promise<SalesBestAward> {
  const period = String(input.period || '').trim();
  if (!/^\d{4}-\d{2}$/.test(period)) {
    throw createError({ statusCode: 400, statusMessage: 'period должен быть YYYY-MM' });
  }

  const reveal_on = revealOnForPeriod(period);
  const award = await mutateAwards(
    (awards) => {
      const now = new Date().toISOString();
      const existingIdx = awards.findIndex((row) => row.period === period);
      const previous = existingIdx >= 0 ? awards[existingIdx] : null;

      const next: SalesBestAward = {
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
        awards[existingIdx] = next;
      } else {
        awards.push(next);
      }
      return next;
    },
    { reason: 'sales-best-pick', ...ctx }
  );

  // если reveal уже наступил (редкий перевыбор) — сразу обновить ленту
  await publishRevealedSalesBestActivities();

  return award;
}

/**
 * Ачивка + лента: в день reveal_on (и позже) публикуем событие в profile-activity.
 * Идемпотентно. Не создаём раньше — интрига до первого рабочего дня.
 * Порядок как раньше: сначала запись в ленте (upsert по стабильному id), потом отметка
 * activity_id у награды. Если между ними сбой — следующий вызов доделает (оба шага идемпотентны),
 * поэтому ленте и наградам не нужна общая транзакция и они могут жить на разных бэкендах.
 */
export async function publishRevealedSalesBestActivities(
  todayIsoDate?: string
): Promise<{ published: number }> {
  const { upsertAutoProfileActivity } = await import('./profileActivityStore');
  const { year, month, day } = moscowCalendarDate();
  const today =
    todayIsoDate ||
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const revealed = (await readAwards()).filter((award) => isAwardRevealed(award, today));
  if (!revealed.length) return { published: 0 };

  for (const award of revealed) {
    const label = periodLabelRu(award.period);
    await upsertAutoProfileActivity(
      {
        id: `sales-best-${award.period}`,
        employee_id: award.employee_id,
        kind: 'achievement',
        text: `${award.employee_name} стал(а) Лучшим специалистом отдела продаж за ${label}`,
        occurred_at: award.reveal_on
      },
      { reason: 'sales-best-publish' }
    );
  }

  // Отметку ставим на свежем списке (под очередью/блокировкой), только тем, чья запись в ленте уже есть.
  const done = new Set(revealed.map((a) => `${a.id}|${a.period}|${a.reveal_on}`));
  const published = await mutateAwards(
    (awards) => {
      let n = 0;
      for (const award of awards) {
        if (!done.has(`${award.id}|${award.period}|${award.reveal_on}`)) continue;
        const activityId = `sales-best-${award.period}`;
        if (award.activity_id !== activityId) {
          award.activity_id = activityId;
          n += 1;
        }
      }
      return n;
    },
    { reason: 'sales-best-publish' }
  );
  return { published };
}
