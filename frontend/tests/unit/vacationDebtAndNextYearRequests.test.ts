import { describe, expect, it } from 'vitest';
import type { VacationRequest } from '../../app/composables/useVacations';
import {
  assessVacationBalance,
  calcAvailableOnDate,
  calcEmployeeBalance
} from '../../app/utils/vacationBalance';
import { requestsAroundYear } from '../../app/utils/vacationBookingYears';
import { applyVacationYearRollover } from '../../server/utils/vacationYearRollover';
import type { ServerEmployee } from '../../server/utils/employeesStore';
import type { VacationStoreState } from '../../server/utils/vacationsStore';

const NAME = 'Иванова Анна';
/** Приём 01.01.2020: начисление 2,3 дня 17-го числа (15-го в феврале), 28 дней в год. */
const HIRE = '2020-01-01';

const r = (
  id: number,
  start: string,
  end: string,
  status: VacationRequest['status'] = 'approved',
  employee_id: number | null = 2684
): VacationRequest => ({ id, employee: NAME, employee_id, start, end, status, comment: '', createdAt: '' });

describe('долг переносится на следующий год', () => {
  // 10 на 01.01.2026 + 28 начислено − 41 день отпуска = −3 на 31.12.2026
  const usage = [
    r(1, '2026-07-06', '2026-07-19'),
    r(2, '2026-08-03', '2026-08-16'),
    r(3, '2026-09-07', '2026-09-19', 'pending')
  ];

  it('31.12.2026 = −3, не 0', () => {
    expect(calcAvailableOnDate(NAME, HIRE, '2026-12-31', usage, 2026, 10)).toBe(-3);
  });

  it('январь 2027 = −3 + 2,3 = −0,7; апрель (30.04) = −3 + 9,3 = 6,3', () => {
    expect(calcAvailableOnDate(NAME, HIRE, '2027-01-31', usage, 2026, 10)).toBe(-0.7);
    expect(calcAvailableOnDate(NAME, HIRE, '2027-04-30', usage, 2026, 10)).toBe(6.3);
  });

  it('форма: отпуск 7 дней с 01.02.2027 при −0,7 → не хватает 7,7', () => {
    const a = assessVacationBalance(NAME, HIRE, '2027-02-01', '2027-02-07', usage, 2026, undefined, 10);
    expect(a.availableAtStart).toBe(-0.7);
    expect(a.deficit).toBe(7.7);
    expect(a.status).toBe('advance');
  });

  it('переход года записывает −3 в vacation_opening_balance, дальше считается от него', () => {
    const emp = { id: 2684, name: NAME, hired_at: HIRE, vacation_opening_balance: 10 } as ServerEmployee;
    const state: VacationStoreState = {
      primaryYear: 2026,
      requestsByYear: { '2026': usage },
      nextRequestId: 99,
      reservationsByYear: {},
      nextReservationId: 1
    };
    const rolled = applyVacationYearRollover([emp], state, 2026, 2027);
    expect(rolled.employees[0]!.vacation_opening_balance).toBe(-3);
    expect(calcAvailableOnDate(NAME, HIRE, '2027-01-31', usage, 2027, -3)).toBe(-0.7);
  });

  it('«Доступно» в панели тоже показывает долг отрицательным числом', () => {
    const b = calcEmployeeBalance(NAME, HIRE, usage, new Date('2026-12-31T12:00:00'), 2026, 10, 2684);
    expect(b.remain).toBe('-3');
  });
});

describe('заявки на 2027 видны и списываются, пока учётный год 2026 (баг со стейджа)', () => {
  // Как на стейдже: заявки сотрудника 2684 лежат в папке 2027.
  const byYear: Record<string, VacationRequest[]> = {
    '2026': [r(1, '2026-07-06', '2026-07-19')],
    '2027': [
      r(1024, '2027-07-05', '2027-07-11'),
      r(1025, '2027-07-19', '2027-07-25'),
      r(1029, '2027-02-22', '2027-02-28', 'pending'),
      r(1030, '2027-06-07', '2027-06-13', 'pending')
    ]
  };
  const around = requestsAroundYear(byYear, 2026);
  const asOf = new Date('2026-10-19T12:00:00');

  it('список заявок (папки 2025–2027) содержит заявки 2027', () => {
    expect(around.map((q) => q.id).sort((a, b) => a - b)).toEqual([1, 1024, 1025, 1029, 1030]);
  });

  it('«Доступно» уменьшается на billable-дни 2027 (7+7+5+5 = 24: 22–23.02 и 12.06 праздники), «План» растёт', () => {
    const only2026 = calcEmployeeBalance(NAME, HIRE, byYear['2026']!, asOf, 2026, 10, 2684);
    const all = calcEmployeeBalance(NAME, HIRE, around, asOf, 2026, 10, 2684);
    expect(Number(only2026.remain) - Number(all.remain)).toBe(24);
    expect(all.planned - only2026.planned).toBe(24);
  });

  it('«к дате» и форма на 2027 вычитают дни 2027 до этой даты', () => {
    // 2026: 10 + 28 − 14 = 24 на 31.12; к 30.06.2027: + 6 начислений (14) − 5 (февраль) − 5 (июнь) = 28
    expect(calcAvailableOnDate(NAME, HIRE, '2027-06-30', around, 2026, 10)).toBe(28);
    const a = assessVacationBalance(NAME, HIRE, '2027-06-30', '2027-06-30', around, 2026, undefined, 10);
    expect(a.availableAtStart).toBe(28);
  });
});
