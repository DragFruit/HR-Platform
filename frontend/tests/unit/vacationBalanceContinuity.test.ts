import { describe, expect, it } from 'vitest';
import type { VacationRequest } from '../../app/composables/useVacations';
import {
  assessVacationBalance,
  calcAvailableOnDate,
  projectedAccruedVacationToDate
} from '../../app/utils/vacationBalance';
import { isRuHoliday } from '../../app/utils/vacationCalendar';
import { applyVacationYearRollover } from '../../server/utils/vacationYearRollover';
import type { ServerEmployee } from '../../server/utils/employeesStore';
import type { VacationStoreState } from '../../server/utils/vacationsStore';

const r = (
  employee: string,
  id: number,
  start: string,
  end: string,
  status: VacationRequest['status'] = 'approved'
): VacationRequest => ({ id, employee, start, end, status, comment: '', createdAt: '' });

type Fixture = { name: string; hire: string; opening: number | null; requests: VacationRequest[] };

const fixtures: Fixture[] = [
  {
    // пример заказчика: 10 + 28 − 33 = 5 дней на 29.12.2026
    name: 'Пять Дней',
    hire: '2020-01-01',
    opening: 10,
    requests: [
      r('Пять Дней', 1, '2026-07-06', '2026-07-19'),
      r('Пять Дней', 2, '2026-08-03', '2026-08-16'),
      r('Пять Дней', 3, '2026-11-09', '2026-11-13', 'pending')
    ]
  },
  {
    name: 'Без Остатка',
    hire: '2018-03-17',
    opening: null,
    requests: [
      r('Без Остатка', 10, '2026-05-12', '2026-05-25'),
      r('Без Остатка', 11, '2027-01-11', '2027-01-15', 'pending')
    ]
  },
  {
    name: 'Новичок',
    hire: '2026-05-20',
    opening: null,
    requests: [r('Новичок', 20, '2026-09-07', '2026-09-11')]
  },
  {
    name: 'Через Год',
    hire: '2021-11-03',
    opening: 4.6,
    requests: [r('Через Год', 30, '2026-12-21', '2027-01-20', 'pending')]
  },
  {
    name: 'Отклонённый',
    hire: '2015-02-28',
    opening: 31.5,
    requests: [
      r('Отклонённый', 40, '2026-06-01', '2026-06-28'),
      r('Отклонённый', 41, '2026-10-01', '2026-10-30', 'rejected')
    ]
  }
];

const tenth = (x: number) => Math.round(x * 10) / 10;

/** «Рассчитать доступные дни к дате» в aside (учётный год 2026). */
const shown = (f: Fixture, iso: string) =>
  calcAvailableOnDate(f.name, f.hire, iso, f.requests, 2026, f.opening)!;
/** Форма заявки: доступно на дату начала. */
const form = (f: Fixture, iso: string) =>
  assessVacationBalance(f.name, f.hire, iso, iso, f.requests, 2026, undefined, f.opening).availableAtStart;
/** Стандартное помесячное начисление ЗУП между датами. */
const accrual = (f: Fixture, fromIso: string, toIso: string) =>
  tenth(
    (projectedAccruedVacationToDate(f.hire, new Date(`${toIso}T12:00:00`), 2026) ?? 0) -
      (projectedAccruedVacationToDate(f.hire, new Date(`${fromIso}T12:00:00`), 2026) ?? 0)
  );
/** Дни отпуска (без праздников) в 2027 по дату включительно. */
const used2027 = (f: Fixture, iso: string) =>
  f.requests
    .filter((q) => q.status !== 'rejected')
    .reduce((n, q) => {
      const s = q.start < '2027-01-01' ? '2027-01-01' : q.start;
      const e = q.end > iso ? iso : q.end;
      let d = 0;
      for (let c = new Date(`${s}T00:00:00`); c <= new Date(`${e}T00:00:00`); c.setDate(c.getDate() + 1)) {
        const day = `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, '0')}-${String(c.getDate()).padStart(2, '0')}`;
        if (!isRuHoliday(day)) d += 1;
      }
      return n + d;
    }, 0);

describe('остаток непрерывен через Новый год', () => {
  it('пример заказчика: 29.12.2026 = 5 → 05.04.2027 = 5 + 7 = 12, 30.04.2027 = 5 + 9,3 = 14,3', () => {
    const f = fixtures[0]!;
    expect(shown(f, '2026-12-29')).toBe(5);
    expect(shown(f, '2026-12-31')).toBe(5);
    expect(form(f, '2027-04-05')).toBe(12);
    expect(shown(f, '2027-04-05')).toBe(12);
    expect(form(f, '2027-04-30')).toBe(14.3);
    expect(shown(f, '2027-04-30')).toBe(14.3);
  });

  for (const f of fixtures) {
    it(`${f.name}: 31.12.2026 + начисление января − январские дни отпуска = 31.01.2027`, () => {
      const dec31 = shown(f, '2026-12-31');
      const jan = Math.max(0, tenth(dec31 + accrual(f, '2026-12-31', '2027-01-31') - used2027(f, '2027-01-31')));
      expect(form(f, '2027-01-31')).toBe(jan);
      expect(shown(f, '2027-01-31')).toBe(jan);
      const apr = Math.max(0, tenth(dec31 + accrual(f, '2026-12-31', '2027-04-30') - used2027(f, '2027-04-30')));
      expect(form(f, '2027-04-30')).toBe(apr);
      expect(shown(f, '2027-04-30')).toBe(apr);
    });

    it(`${f.name}: переход года записывает то, что UI показывал на 31.12 (+ начисление 1 января, если оно на 1-е)`, () => {
      const emp = { id: 1, name: f.name, hired_at: f.hire, vacation_opening_balance: f.opening } as ServerEmployee;
      const state: VacationStoreState = {
        primaryYear: 2026,
        requestsByYear: { '2026': f.requests },
        nextRequestId: 99,
        reservationsByYear: {},
        nextReservationId: 1
      };
      const rolled = applyVacationYearRollover([emp], state, 2026, 2027);
      const opening2027 = rolled.employees[0]!.vacation_opening_balance;
      expect(opening2027).toBe(tenth(shown(f, '2026-12-31') + accrual(f, '2026-12-31', '2027-01-01')));
      expect(opening2027).toBe(shown(f, '2027-01-01'));
      expect(calcAvailableOnDate(f.name, f.hire, '2027-04-30', f.requests, 2027, opening2027)).toBe(
        form(f, '2027-04-30')
      );
    });
  }
});
