import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VacationStoreState } from '../../server/utils/vacationsStore';

const store = vi.hoisted(() => ({ state: null as unknown as VacationStoreState }));

vi.mock('../../server/utils/vacationsStore', () => ({
  mutateVacations: async (mutator: (s: VacationStoreState) => VacationStoreState | Promise<VacationStoreState>) => {
    const draft = JSON.parse(JSON.stringify(store.state)) as VacationStoreState;
    store.state = await mutator(draft);
    return store.state;
  }
}));
const employee = { id: 7, name: 'Петров Пётр', department: 'SEO', manager: 'Руководитель Р', hired_at: '2020-01-01' };
vi.mock('../../server/utils/employeesStore', () => ({
  findEmployeeForSession: async () => employee,
  findEmployeeByName: async () => employee,
  readEmployees: async () => [employee]
}));
vi.mock('../../server/utils/vacationNotifications', () => ({
  notifyVacationRequestCreated: vi.fn(async () => {}),
  notifyVacationRequestDeleted: vi.fn(async () => {}),
  notifyVacationRequestPatched: vi.fn(async () => {})
}));
vi.mock('../../server/utils/vacationReservationNotifications', () => ({
  notifyVacationReservationUpdated: vi.fn(async () => {})
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
import { createVacationReservation } from '../../server/utils/vacationReservationMutations';
import type { SessionUser } from '../../server/utils/credentials';

const employeeSession = { id: 1, role: 'employee', name: employee.name } as unknown as SessionUser;
const adminSession = { id: 2, role: 'admin', name: 'Админ' } as unknown as SessionUser;

const YEAR_ERROR = 'Отпуск можно оформить только на 2026 или 2027 год';

beforeEach(() => {
  store.state = {
    primaryYear: 2026,
    requestsByYear: {
      '2025': [
        {
          id: 1,
          employee: employee.name,
          employee_id: 7,
          start: '2025-08-01',
          end: '2025-08-07',
          status: 'approved',
          comment: '',
          createdAt: '01.07.2025'
        }
      ],
      '2026': []
    },
    nextRequestId: 2,
    reservationsByYear: {},
    nextReservationId: 1
  };
});

describe('сервер: заявки только на текущий учётный и следующий год', () => {
  it('заявка на 2027 создаётся', async () => {
    const state = await createVacationRequest(employeeSession, {
      year: 2027,
      employee: employee.name,
      start: '2027-02-01',
      end: '2027-02-10'
    });
    expect(state.requestsByYear['2027']).toHaveLength(1);
  });

  it('заявка на 2028 отклоняется с понятной ошибкой', async () => {
    await expect(
      createVacationRequest(employeeSession, {
        year: 2028,
        employee: employee.name,
        start: '2028-02-01',
        end: '2028-02-10'
      })
    ).rejects.toMatchObject({ statusCode: 400, statusMessage: expect.stringContaining(YEAR_ERROR) });
    expect(store.state.requestsByYear['2028']).toBeUndefined();
  });

  it('перенос дат своей заявки в 2028 — нельзя', async () => {
    await createVacationRequest(employeeSession, {
      year: 2027,
      employee: employee.name,
      start: '2027-02-01',
      end: '2027-02-10'
    });
    await expect(
      patchVacationRequest(employeeSession, 2, { start: '2028-02-01', end: '2028-02-10' })
    ).rejects.toMatchObject({ statusCode: 400, statusMessage: expect.stringContaining(YEAR_ERROR) });
  });

  it('старую заявку 2025 админ правит как раньше', async () => {
    await patchVacationRequest(adminSession, 1, { start: '2025-08-04', end: '2025-08-10' });
    expect(store.state.requestsByYear['2025']![0]).toMatchObject({ start: '2025-08-04', end: '2025-08-10' });
  });
});

describe('сервер: брони только на текущий учётный и следующий год', () => {
  it('бронь на март 2027 ставится', async () => {
    const state = await createVacationReservation(employeeSession, { year: 2027, month: 3, durationDays: 14 });
    expect(state.reservationsByYear['2027']).toHaveLength(1);
  });

  it('бронь на 2028 отклоняется', async () => {
    await expect(
      createVacationReservation(employeeSession, { year: 2028, month: 3, durationDays: 14 })
    ).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: expect.stringContaining('Бронь можно поставить только на 2026 или 2027 год')
    });
  });
});
