import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VacationStoreState } from '../../server/utils/vacationsStore';
import {
  countVacationBillableDays,
  trimVacationHolidayEdges,
  VACATION_ONLY_HOLIDAYS_MESSAGE,
  vacationHolidayEdgeHint
} from '../../app/utils/vacationCalendar';

const store = vi.hoisted(() => ({ state: null as unknown as VacationStoreState }));

vi.mock('../../server/utils/vacationsStore', () => ({
  mutateVacations: async (mutator: (s: VacationStoreState) => VacationStoreState | Promise<VacationStoreState>) => {
    const draft = JSON.parse(JSON.stringify(store.state)) as VacationStoreState;
    store.state = await mutator(draft);
    return store.state;
  }
}));
const employee = { id: 7, name: 'Петров Пётр', department: 'SEO', manager: 'Руководитель Р', hired_at: '2015-01-01' };
vi.mock('../../server/utils/employeesStore', () => ({
  findEmployeeForSession: async () => employee,
  findEmployeeByName: async () => employee,
  readEmployees: async () => [employee]
}));
vi.mock('../../server/utils/vacationNotifications', () => ({
  notifyVacationRequestCreated: vi.fn(async () => {}),
  notifyVacationRequestDeleted: vi.fn(async () => {}),
  notifyVacationRequestPatched: vi.fn(async () => {}),
  notifyVacationDatesChangedByAdmin: vi.fn(async () => {})
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
import { vacationApplicationValues } from '../../server/utils/vacationApplicationDocx';
import type { SessionUser } from '../../server/utils/credentials';

const employeeSession = { id: 1, role: 'employee', name: employee.name } as unknown as SessionUser;
const adminSession = { id: 2, role: 'admin', name: 'Админ' } as unknown as SessionUser;

describe('trimVacationHolidayEdges', () => {
  it('праздник в конце отрезается: 28–31.12.2026 → 28–30.12', () => {
    expect(trimVacationHolidayEdges('2026-12-28', '2026-12-31')).toEqual({
      start: '2026-12-28',
      end: '2026-12-30',
      removed: ['2026-12-31'],
      empty: false
    });
  });

  it('праздники в начале отрезаются до первого не праздника: 31.12.2026–12.01.2027 → с 11.01.2027', () => {
    const r = trimVacationHolidayEdges('2026-12-31', '2027-01-12');
    expect(r.start).toBe('2027-01-11');
    expect(r.end).toBe('2027-01-12');
    expect(r.removed[0]).toBe('2026-12-31');
    expect(r.removed.at(-1)).toBe('2027-01-10');
    expect(r.empty).toBe(false);
  });

  it('праздник внутри периода остаётся (только не считается)', () => {
    const r = trimVacationHolidayEdges('2026-12-28', '2027-01-15');
    expect(r).toMatchObject({ start: '2026-12-28', end: '2027-01-15', removed: [] });
    expect(countVacationBillableDays(r.start, r.end)).toBe(19 - 11);
  });

  it('выходной на краю не обрезается', () => {
    // 2026-12-26 сб, 2026-12-27 вс
    expect(trimVacationHolidayEdges('2026-12-26', '2026-12-27')).toMatchObject({
      start: '2026-12-26',
      end: '2026-12-27',
      removed: []
    });
  });

  it('все дни праздники → признак ошибки', () => {
    expect(trimVacationHolidayEdges('2026-12-31', '2027-01-05')).toMatchObject({ empty: true });
    expect(trimVacationHolidayEdges('2026-11-04', '2026-11-04')).toMatchObject({ empty: true });
  });

  it('подсказка перечисляет отрезанные даты', () => {
    expect(vacationHolidayEdgeHint(['2026-12-31'])).toBe('31.12 праздничный день, в отпуск не входит');
    expect(vacationHolidayEdgeHint(['2026-06-12', '2026-06-13'])).toBe(
      '12.06, 13.06 праздничные дни, в отпуск не входят'
    );
    expect(vacationHolidayEdgeHint([])).toBe('');
  });
});

describe('сервер: даты заявки обрезаются по праздникам на краях', () => {
  beforeEach(() => {
    store.state = {
      primaryYear: 2026,
      requestsByYear: {
        '2026': [
          {
            id: 1,
            employee: employee.name,
            employee_id: 7,
            start: '2026-12-21',
            end: '2026-12-23',
            status: 'pending',
            comment: '',
            createdAt: '01.11.2026'
          }
        ]
      },
      nextRequestId: 2,
      reservationsByYear: {},
      nextReservationId: 1
    };
  });

  it('создание 28–31.12.2026 сохраняет 28–30.12', async () => {
    const state = await createVacationRequest(employeeSession, {
      year: 2026,
      employee: employee.name,
      start: '2026-12-28',
      end: '2026-12-31'
    });
    const created = state.requestsByYear['2026']!.find((r) => r.id === 2);
    expect(created).toMatchObject({ start: '2026-12-28', end: '2026-12-30' });
  });

  it('создание с 31.12.2026 переносит заявку в папку 2027 с первого не праздника', async () => {
    const state = await createVacationRequest(employeeSession, {
      year: 2026,
      employee: employee.name,
      start: '2026-12-31',
      end: '2027-01-15'
    });
    expect(state.requestsByYear['2027']![0]).toMatchObject({ start: '2027-01-11', end: '2027-01-15' });
  });

  it('только праздники → 400 с понятным текстом', async () => {
    await expect(
      createVacationRequest(employeeSession, {
        year: 2026,
        employee: employee.name,
        start: '2026-12-31',
        end: '2027-01-05'
      })
    ).rejects.toMatchObject({ statusCode: 400, statusMessage: VACATION_ONLY_HOLIDAYS_MESSAGE });
  });

  it('правка дат сотрудником и админом сохраняет обрезанные даты', async () => {
    await patchVacationRequest(employeeSession, 1, { start: '2026-12-28', end: '2026-12-31' });
    expect(store.state.requestsByYear['2026']![0]).toMatchObject({ start: '2026-12-28', end: '2026-12-30' });

    await patchVacationRequest(adminSession, 1, { start: '2026-11-04', end: '2026-11-06' });
    expect(store.state.requestsByYear['2026']![0]).toMatchObject({ start: '2026-11-05', end: '2026-11-06' });
  });

  it('правка только комментария админом старые даты не трогает', async () => {
    store.state.requestsByYear['2026']![0]!.end = '2026-12-31';
    store.state.requestsByYear['2026']![0]!.start = '2026-12-28';
    await patchVacationRequest(adminSession, 1, { comment: 'ок' });
    expect(store.state.requestsByYear['2026']![0]).toMatchObject({ start: '2026-12-28', end: '2026-12-31' });
  });
});

describe('заявление: даты после обрезки и billable-дни', () => {
  const base = { employeeName: 'Петров Пётр', position: 'SEO', legalEntity: '' };

  it('старая заявка 28–31.12.2026 → в заявлении 28–30 декабря, 3 дня, выход 11.01.2027', () => {
    const v = vacationApplicationValues({ ...base, startDate: '2026-12-28', endDate: '2026-12-31' });
    expect(v.start_date).toBe('28 декабря 2026 г.');
    expect(v.end_date).toBe('30 декабря 2026 г.');
    expect(v.days_count).toBe('3');
    expect(v.return_date).toBe('11 января 2027 г.');
  });

  it('праздники внутри периода не входят в число дней', () => {
    const v = vacationApplicationValues({ ...base, startDate: '2026-12-28', endDate: '2027-01-15' });
    expect(v.end_date).toBe('15 января 2027 г.');
    expect(v.days_count).toBe('8');
  });
});
