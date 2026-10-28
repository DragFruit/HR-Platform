import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VacationStoreState } from '../../server/utils/vacationsStore';
import type { VacationRequest } from '../../app/composables/useVacations';
import { calcAvailableOnDate } from '../../app/utils/vacationBalance';
import { countVacationBillableDays } from '../../app/utils/vacationCalendar';
import {
  assessVacationShortfall,
  formatVacationDaysAmount,
  isVacationShortfallBlocking,
  vacationDaysGenitive,
  vacationShortfallMessage
} from '../../app/utils/vacationShortfall';

const store = vi.hoisted(() => ({ state: null as unknown as VacationStoreState }));
const people = vi.hoisted(() => ({
  employee: {
    id: 7,
    name: 'Петров Пётр',
    department: 'SEO',
    manager: 'Руководитель Р',
    hired_at: '2020-01-01',
    vacation_opening_balance: 10 as number | null
  },
  admin: { id: 9, name: 'Админов Админ', department: 'HR', manager: '', hired_at: '2020-01-01' },
  sessionIsAdmin: false
}));

vi.mock('../../server/utils/vacationsStore', () => ({
  mutateVacations: async (mutator: (s: VacationStoreState) => VacationStoreState | Promise<VacationStoreState>) => {
    const draft = JSON.parse(JSON.stringify(store.state)) as VacationStoreState;
    store.state = await mutator(draft);
    return store.state;
  }
}));
vi.mock('../../server/utils/employeesStore', () => ({
  findEmployeeForSession: async () => (people.sessionIsAdmin ? people.admin : people.employee),
  findEmployeeByName: async (name: string) => (name === people.admin.name ? people.admin : people.employee),
  readEmployees: async () => [people.employee, people.admin]
}));
vi.mock('../../server/utils/vacationNotifications', () => ({
  notifyVacationRequestCreated: vi.fn(async () => {}),
  notifyVacationRequestDeleted: vi.fn(async () => {}),
  notifyVacationRequestPatched: vi.fn(async () => {})
}));
vi.mock('../../server/utils/bitrixVacationAbsence', () => ({
  syncApprovedVacationsToBitrix: vi.fn(async (_prev: unknown, next: unknown) => next),
  removeVacationAbsenceFromBitrix: vi.fn(async () => {})
}));
vi.mock('../../server/utils/adminNotificationsStore', () => ({
  createBitrixVacationSyncFailedNotification: vi.fn(async () => {})
}));
vi.mock('../../server/utils/vacationReservationCapMutations', () => ({
  assertVacationRequestGroupCap: vi.fn(async () => {}),
  assertReservationGroupCap: vi.fn(async () => {})
}));

vi.stubGlobal('createError', (opts: { statusCode: number; statusMessage: string }) =>
  Object.assign(new Error(opts.statusMessage), opts)
);

import { createVacationRequest, patchVacationRequest } from '../../server/utils/vacationRequestMutations';
import type { SessionUser } from '../../server/utils/credentials';

const employeeSession = { id: 1, role: 'employee', name: people.employee.name } as unknown as SessionUser;
const adminSession = { id: 2, role: 'admin', name: people.admin.name } as unknown as SessionUser;

const START = '2026-12-01';
const PRIMARY = 2026;

const availableAt = (opening: number, requests: VacationRequest[] = []) =>
  calcAvailableOnDate(people.employee.name, people.employee.hired_at, START, requests, PRIMARY, opening)!;

/** Подобрать opening так, чтобы доступно к START имело нужную дробную часть (0 или 0,5). */
const openingWithFraction = (frac: number) => {
  for (let k = 0; k < 40; k += 1) {
    const opening = Math.round((8 + k / 10) * 10) / 10;
    const a = availableAt(opening);
    if (Math.abs(a - Math.floor(a) - frac) < 1e-6) return { opening, available: a };
  }
  throw new Error('не подобрался opening');
};

/** Конец периода от START ровно на `days` billable-дней. */
const endForDays = (days: number) => {
  const d = new Date(`${START}T12:00:00`);
  for (let i = 0; i < 120; i += 1) {
    const iso = d.toISOString().slice(0, 10);
    if (countVacationBillableDays(START, iso) === days) return iso;
    d.setDate(d.getDate() + 1);
  }
  throw new Error('не подобралась дата');
};

const shortfallFor = (opening: number, end: string, requests: VacationRequest[] = [], excludeRequestId?: number) =>
  assessVacationShortfall({
    employeeName: people.employee.name,
    hireIso: people.employee.hired_at,
    start: START,
    end,
    requests,
    primaryYear: PRIMARY,
    excludeRequestId,
    openingBalance: opening
  });

describe('нехватка дней: формат и склонение', () => {
  it('склоняет «не хватает N дня/дней»', () => {
    expect(vacationShortfallMessage(3)).toBe('Не хватает 3 дней отпуска. Измените даты.');
    expect(vacationShortfallMessage(1)).toBe('Не хватает 1 дня отпуска. Измените даты.');
    expect(vacationShortfallMessage(0.5)).toBe('Не хватает 0,5 дня отпуска. Измените даты.');
    expect(vacationShortfallMessage(21)).toBe('Не хватает 21 дня отпуска. Измените даты.');
    expect(vacationShortfallMessage(11)).toBe('Не хватает 11 дней отпуска. Измените даты.');
    expect(vacationShortfallMessage(2)).toBe('Не хватает 2 дней отпуска. Измените даты.');
    expect(vacationDaysGenitive(2.3)).toBe('дня');
    expect(formatVacationDaysAmount(4.7)).toBe('4,7');
  });

  it('блокирует только сотрудника для себя, HR/админ за другого могут', () => {
    expect(isVacationShortfallBlocking({ rosterWide: false, ownRequest: true })).toBe(true);
    expect(isVacationShortfallBlocking({ rosterWide: true, ownRequest: true })).toBe(true);
    expect(isVacationShortfallBlocking({ rosterWide: true, ownRequest: false })).toBe(false);
  });
});

describe('нехватка дней: расчёт как в форме', () => {
  it('ровно столько, сколько доступно: можно', () => {
    const { opening, available } = openingWithFraction(0);
    const r = shortfallFor(opening, endForDays(available));
    expect(r.shortfall).toBe(0);
    expect(r.message).toBe('');
    const over = shortfallFor(opening, endForDays(available + 1));
    expect(over.shortfall).toBe(1);
    expect(over.message).toBe('Не хватает 1 дня отпуска. Измените даты.');
  });

  it('дробный остаток: не хватает 0,5', () => {
    const { opening, available } = openingWithFraction(0.5);
    const r = shortfallFor(opening, endForDays(Math.ceil(available)));
    expect(r.shortfall).toBe(0.5);
    expect(r.message).toBe('Не хватает 0,5 дня отпуска. Измените даты.');
    expect(shortfallFor(opening, endForDays(Math.floor(available))).shortfall).toBe(0);
  });

  it('смена дат: старые дни самой заявки не считаются', () => {
    const { opening, available } = openingWithFraction(0);
    const own: VacationRequest = {
      id: 5,
      employee: people.employee.name,
      employee_id: 7,
      start: '2026-11-02',
      end: '2026-11-06',
      status: 'pending',
      comment: '',
      createdAt: ''
    };
    const end = endForDays(available);
    expect(shortfallFor(opening, end, [own]).shortfall).toBeGreaterThan(0);
    expect(shortfallFor(opening, end, [own], own.id).shortfall).toBe(0);
  });
});

describe('сервер: заявка больше остатка', () => {
  beforeEach(() => {
    people.sessionIsAdmin = false;
    const { opening } = openingWithFraction(0);
    people.employee.vacation_opening_balance = opening;
    store.state = {
      primaryYear: PRIMARY,
      requestsByYear: { '2026': [] },
      nextRequestId: 1,
      reservationsByYear: {},
      nextReservationId: 1
    };
  });

  const available = () => availableAt(people.employee.vacation_opening_balance!);

  it('сотрудник: ровно доступное создаётся, на день больше 400', async () => {
    const a = available();
    await expect(
      createVacationRequest(employeeSession, {
        year: 2026,
        employee: people.employee.name,
        start: START,
        end: endForDays(a + 1)
      })
    ).rejects.toMatchObject({ statusCode: 400, statusMessage: 'Не хватает 1 дня отпуска. Измените даты.' });
    expect(store.state.requestsByYear['2026']).toHaveLength(0);

    const state = await createVacationRequest(employeeSession, {
      year: 2026,
      employee: people.employee.name,
      start: START,
      end: endForDays(a)
    });
    expect(state.requestsByYear['2026']).toHaveLength(1);
  });

  it('сотрудник: смена дат на больший период отклоняется, свои старые дни не мешают', async () => {
    const a = available();
    await createVacationRequest(employeeSession, {
      year: 2026,
      employee: people.employee.name,
      start: START,
      end: endForDays(a - 2)
    });
    const id = store.state.requestsByYear['2026']![0]!.id;
    await patchVacationRequest(employeeSession, id, { start: START, end: endForDays(a) });
    expect(store.state.requestsByYear['2026']![0]!.end).toBe(endForDays(a));
    await expect(
      patchVacationRequest(employeeSession, id, { start: START, end: endForDays(a + 3) })
    ).rejects.toMatchObject({ statusCode: 400, statusMessage: 'Не хватает 3 дней отпуска. Измените даты.' });
    expect(store.state.requestsByYear['2026']![0]!.end).toBe(endForDays(a));
  });

  it('админ за другого сотрудника: создаётся с нехваткой (исключение)', async () => {
    people.sessionIsAdmin = true;
    const state = await createVacationRequest(adminSession, {
      year: 2026,
      employee: people.employee.name,
      start: START,
      end: endForDays(available() + 5)
    });
    expect(state.requestsByYear['2026']).toHaveLength(1);
  });
});
