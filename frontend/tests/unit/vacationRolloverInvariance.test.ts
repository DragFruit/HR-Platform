import { describe, expect, it } from 'vitest';
import type { VacationRequest } from '../../app/composables/useVacations';
import {
  assessVacationBalance,
  calcAvailableOnDate,
  calcEmployeeBalance
} from '../../app/utils/vacationBalance';
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

type Fixture = { id: number; name: string; hire: string; opening: number | null; requests: VacationRequest[] };

const fixtures: Fixture[] = [
  {
    id: 1,
    name: 'Обычная Сотрудница',
    hire: '2023-11-09',
    opening: 19.6,
    requests: [
      r('Обычная Сотрудница', 1, '2026-02-24', '2026-03-01'),
      r('Обычная Сотрудница', 2, '2026-06-01', '2026-06-11'),
      r('Обычная Сотрудница', 3, '2027-02-22', '2027-02-28', 'pending'),
      r('Обычная Сотрудница', 4, '2027-07-05', '2027-07-11')
    ]
  },
  {
    id: 2,
    name: 'Должник',
    hire: '2020-01-01',
    opening: 10,
    // 10 + 28 − 41 = −3 на 31.12.2026
    requests: [
      r('Должник', 10, '2026-07-06', '2026-07-19'),
      r('Должник', 11, '2026-08-03', '2026-08-16'),
      r('Должник', 12, '2026-09-07', '2026-09-19', 'pending')
    ]
  },
  {
    id: 3,
    name: 'Через Новый Год',
    hire: '2021-11-03',
    opening: 12,
    requests: [r('Через Новый Год', 20, '2026-12-21', '2027-01-20')]
  },
  {
    id: 4,
    name: 'Начисление Первого',
    hire: '2018-03-17',
    opening: 15,
    requests: [r('Начисление Первого', 30, '2026-11-09', '2026-11-20', 'pending')]
  }
];

/** Всё, что видит пользователь, на момент asOf. */
const displayed = (f: Fixture, primaryYear: number, opening: number | null | undefined, asOf: Date) => ({
  panel: calcEmployeeBalance(f.name, f.hire, f.requests, asOf, primaryYear, opening, f.id),
  toDate: ['2027-01-31', '2027-02-15', '2027-06-30', '2027-12-31', '2028-03-31'].map((d) =>
    calcAvailableOnDate(f.name, f.hire, d, f.requests, primaryYear, opening)
  ),
  form: assessVacationBalance(f.name, f.hire, '2027-03-01', '2027-03-14', f.requests, primaryYear, undefined, opening)
});

const rollover = (f: Fixture) => {
  const emp = { id: f.id, name: f.name, hired_at: f.hire, vacation_opening_balance: f.opening } as ServerEmployee;
  const state: VacationStoreState = {
    primaryYear: 2026,
    requestsByYear: {
      '2026': f.requests.filter((q) => q.start < '2027-01-01'),
      '2027': f.requests.filter((q) => q.start >= '2027-01-01')
    },
    nextRequestId: 99,
    reservationsByYear: {},
    nextReservationId: 1
  };
  return applyVacationYearRollover([emp], state, 2026, 2027).employees[0]!.vacation_opening_balance;
};

describe('смена года = обычная смена месяца: переход года не меняет ни одной цифры', () => {
  for (const f of fixtures) {
    for (const at of ['2027-01-01T00:10:00', '2027-01-15T12:00:00']) {
      it(`${f.name}, ${at}`, () => {
        const asOf = new Date(at);
        const before = displayed(f, 2026, f.opening, asOf);
        const after = displayed(f, 2027, rollover(f), asOf);
        expect(after).toEqual(before);
      });
    }
  }

  it('долг: переход записывает −3, «Доступно» 01.01.2027 = −3 (1 января начисления нет)', () => {
    const f = fixtures[1]!;
    expect(rollover(f)).toBe(-3);
    expect(displayed(f, 2026, f.opening, new Date('2027-01-01T00:10:00')).panel.remain).toBe('-3');
  });
});

describe('форма: отпуск через Новый год считается целиком', () => {
  it('28.12.2026–14.01.2027: нужно 7 дней (28–30.12 + 11–14.01; 31.12–10.01 праздники), а не только декабрьские 3', () => {
    const a = assessVacationBalance('Тест Тестов', '2020-01-01', '2026-12-28', '2027-01-14', [], 2026, undefined, 10);
    expect(a.neededDays).toBe(7);
  });
});

describe('будущий отпуск в 2027 списывается так же, как будущий отпуск в 2026', () => {
  const name = 'Тест Тестов';
  const hire = '2020-01-01';
  const asOf = new Date('2026-10-19T12:00:00');
  const base = calcEmployeeBalance(name, hire, [], asOf, 2026, 10, 5);

  it('декабрь 2026 (7–11.12, 5 дн.) и февраль 2027 (8–12.02, 5 дн.) уменьшают «Доступно» одинаково и идут в «План»', () => {
    const dec = calcEmployeeBalance(name, hire, [r(name, 1, '2026-12-07', '2026-12-11')], asOf, 2026, 10, 5);
    const feb = calcEmployeeBalance(name, hire, [r(name, 2, '2027-02-08', '2027-02-12')], asOf, 2026, 10, 5);
    expect(Number(base.remain) - Number(dec.remain)).toBeCloseTo(5, 6);
    expect(Number(base.remain) - Number(feb.remain)).toBeCloseTo(5, 6);
    expect(dec.planned).toBe(5);
    expect(feb.planned).toBe(5);
    expect(dec.taken).toBe(0);
  });

  it('«Отгулял» — прошедшие дни согласованных отпусков любых лет, «План» — будущие дни и заявки на согласовании', () => {
    const b = calcEmployeeBalance(
      name,
      hire,
      [
        r(name, 1, '2025-08-04', '2025-08-08'),
        r(name, 2, '2026-10-12', '2026-10-23'),
        r(name, 3, '2026-03-02', '2026-03-06', 'pending')
      ],
      asOf,
      2026,
      10,
      5
    );
    // 5 (2025) + 12–19.10.2026 (8 дней без праздников) ; будущее 20–23.10 = 4
    expect(b.taken).toBe(5 + 8);
    expect(b.planned).toBe(4 + 5);
  });
});
