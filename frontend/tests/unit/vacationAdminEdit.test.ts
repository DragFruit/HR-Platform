import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  appendVacationAdminEdit,
  buildVacationAdminEditEntry,
  canAdminEditVacationRequest,
  formatAdminEditHistoryLine,
  validateVacationEditDates,
  VACATION_ADMIN_EDITS_MAX,
  type VacationAdminEditEntry
} from '../../app/utils/vacationAdminEdit';
import type { VacationStoreState } from '../../server/utils/vacationsStore';

describe('vacationAdminEdit: чистая логика', () => {
  it('править можно только admin/hr и только pending/approved', () => {
    expect(canAdminEditVacationRequest('admin', { status: 'approved' })).toBe(true);
    expect(canAdminEditVacationRequest('hr', { status: 'pending' })).toBe(true);
    expect(canAdminEditVacationRequest('admin', { status: 'rejected' })).toBe(false);
    expect(canAdminEditVacationRequest('manager', { status: 'approved' })).toBe(false);
    expect(canAdminEditVacationRequest('employee', { status: 'pending' })).toBe(false);
    expect(canAdminEditVacationRequest('admin', null)).toBe(false);
  });

  it('валидация дат: конец не раньше начала, реальные даты', () => {
    expect(validateVacationEditDates('2026-12-05', '2026-12-18')).toBeNull();
    expect(validateVacationEditDates('2026-12-05', '2026-12-05')).toBeNull();
    expect(validateVacationEditDates('2026-12-18', '2026-12-05')).toMatch(/раньше/);
    expect(validateVacationEditDates('', '2026-12-05')).toMatch(/Укажите/);
    expect(validateVacationEditDates('2026-02-30', '2026-03-05')).toMatch(/Некорректная/);
    expect(validateVacationEditDates('05.12.2026', '2026-12-18')).toMatch(/Некорректная/);
  });

  it('строка истории: было/стало', () => {
    expect(
      formatAdminEditHistoryLine({
        actorName: 'Иванов Иван',
        actorRole: 'admin',
        before: { start: '2026-12-01', end: '2026-12-14' },
        after: { start: '2026-12-05', end: '2026-12-18' }
      })
    ).toBe('изменено админом Иванов Иван: было 01.12.2026–14.12.2026, стало 05.12.2026–18.12.2026');
    expect(
      formatAdminEditHistoryLine({
        actorName: 'Петрова Анна',
        actorRole: 'hr',
        before: { start: '2026-12-01', end: '2026-12-14' },
        after: { start: '2026-12-01', end: '2026-12-14' },
        commentChanged: true
      })
    ).toBe('изменено HR Петрова Анна: комментарий');
  });

  it('запись истории: null без изменений, флаг комментария, лимит длины', () => {
    const same = { start: '2026-12-01', end: '2026-12-14', comment: 'a' };
    expect(
      buildVacationAdminEditEntry({ actorEmployeeId: 1, actorName: 'A', actorRole: 'admin', before: same, after: same })
    ).toBeNull();

    const entry = buildVacationAdminEditEntry({
      at: '2026-11-19T10:00:00.000Z',
      actorEmployeeId: 5,
      actorName: 'Иванов Иван',
      actorRole: 'admin',
      before: same,
      after: { start: '2026-12-05', end: '2026-12-18', comment: 'b' }
    })!;
    expect(entry).toMatchObject({
      by_employee_id: 5,
      start_before: '2026-12-01',
      end_after: '2026-12-18',
      comment_changed: true
    });
    expect(entry.summary).toContain('было 01.12.2026–14.12.2026, стало 05.12.2026–18.12.2026; комментарий');

    let list: VacationAdminEditEntry[] = [];
    for (let i = 0; i < VACATION_ADMIN_EDITS_MAX + 5; i++) list = appendVacationAdminEdit(list, { ...entry, summary: String(i) });
    expect(list).toHaveLength(VACATION_ADMIN_EDITS_MAX);
    expect(list.at(-1)!.summary).toBe(String(VACATION_ADMIN_EDITS_MAX + 4));
  });
});

// ---------- сервер: patchVacationRequest от админа ----------

const store = vi.hoisted(() => ({
  state: null as unknown as VacationStoreState,
  ctx: null as null | { reason?: string; actorEmployeeId?: number | null },
  sessionEmployee: null as null | { id: number; name: string }
}));
const mocks = vi.hoisted(() => ({
  notifyAdminEdit: vi.fn(async () => {}),
  notifyPatched: vi.fn(async () => {}),
  sync: vi.fn(async (_prev: unknown, next: unknown) => next)
}));

vi.mock('../../server/utils/vacationsStore', () => ({
  mutateVacations: async (
    mutator: (s: VacationStoreState) => VacationStoreState | Promise<VacationStoreState>,
    ctx: { reason?: string }
  ) => {
    const draft = JSON.parse(JSON.stringify(store.state)) as VacationStoreState;
    store.state = await mutator(draft);
    store.ctx = { ...ctx };
    return store.state;
  }
}));
const owner = { id: 7, name: 'Петров Пётр', department: 'SEO', manager: 'Руководитель Р', hired_at: '2020-01-01' };
vi.mock('../../server/utils/employeesStore', () => ({
  findEmployeeForSession: async () => store.sessionEmployee,
  findEmployeeByName: async () => owner,
  readEmployees: async () => [owner]
}));
vi.mock('../../server/utils/vacationNotifications', () => ({
  notifyVacationRequestCreated: vi.fn(async () => {}),
  notifyVacationRequestDeleted: vi.fn(async () => {}),
  notifyVacationRequestPatched: mocks.notifyPatched,
  notifyVacationDatesChangedByAdmin: mocks.notifyAdminEdit
}));
vi.mock('../../server/utils/bitrixVacationAbsence', () => ({
  syncApprovedVacationsToBitrix: mocks.sync,
  removeVacationAbsenceFromBitrix: vi.fn(async () => {})
}));
vi.mock('../../server/utils/adminNotificationsStore', () => ({
  createBitrixVacationSyncFailedNotification: vi.fn(async () => {})
}));
vi.mock('../../server/utils/vacationReservationCapMutations', () => ({
  assertVacationRequestGroupCap: vi.fn(async () => {})
}));
vi.stubGlobal('createError', (opts: { statusCode: number; statusMessage: string }) =>
  Object.assign(new Error(opts.statusMessage), opts)
);

const { patchVacationRequest } = await import('../../server/utils/vacationRequestMutations');
type Session = Parameters<typeof patchVacationRequest>[0];
const adminSession = { id: 2, role: 'admin', name: 'Админ' } as unknown as Session;
const employeeSession = { id: 1, role: 'employee', name: owner.name } as unknown as Session;

const requestById = (id: number) =>
  Object.values(store.state.requestsByYear).flat().find((r) => r.id === id)!;

describe('patchVacationRequest: правка админом', () => {
  beforeEach(() => {
    mocks.notifyAdminEdit.mockClear();
    mocks.sync.mockClear();
    store.sessionEmployee = { id: 99, name: 'Иванов Иван' };
    store.state = {
      primaryYear: 2026,
      requestsByYear: {
        '2026': [
          {
            id: 10,
            employee: owner.name,
            employee_id: 7,
            start: '2026-12-01',
            end: '2026-12-14',
            status: 'approved',
            comment: 'Заявка из платформы',
            createdAt: '01.11.2026',
            bitrix_absence_id: 555,
            bitrix_sync_status: 'synced'
          },
          {
            id: 11,
            employee: owner.name,
            employee_id: 7,
            start: '2026-12-20',
            end: '2026-12-25',
            status: 'pending',
            approval_step: 'manager',
            comment: '',
            createdAt: '01.11.2026'
          }
        ]
      },
      nextRequestId: 12,
      reservationsByYear: {},
      nextReservationId: 1
    };
  });

  it('согласованная остаётся согласованной, история и уведомление сотруднику', async () => {
    await patchVacationRequest(adminSession, 10, { start: '2026-12-02', end: '2026-12-15', comment: 'перенос' });
    const req = requestById(10);
    expect(req.status).toBe('approved');
    expect(req.start).toBe('2026-12-02');
    expect(req.comment).toBe('перенос');
    expect(req.bitrix_absence_id).toBe(555);
    expect(req.admin_edits).toHaveLength(1);
    expect(req.admin_edits![0]!.summary).toBe(
      'изменено админом Иванов Иван: было 01.12.2026–14.12.2026, стало 02.12.2026–15.12.2026; комментарий'
    );
    expect(store.ctx?.reason).toBe(`api:request-admin-edit: ${req.admin_edits![0]!.summary}`);
    expect(store.ctx?.actorEmployeeId).toBe(99);
    // Bitrix-синк идёт тем же путём: previous (старые даты) → next (новые)
    expect(mocks.sync).toHaveBeenCalledTimes(1);
    expect(mocks.notifyAdminEdit).toHaveBeenCalledTimes(1);
  });

  it('pending остаётся на своём шаге', async () => {
    await patchVacationRequest(adminSession, 11, { start: '2026-12-21', end: '2026-12-26' });
    const req = requestById(11);
    expect(req.status).toBe('pending');
    expect(req.approval_step).toBe('manager');
  });

  it('только комментарий: история есть, уведомления о датах нет', async () => {
    await patchVacationRequest(adminSession, 10, { comment: 'уточнение' });
    expect(requestById(10).admin_edits![0]!.summary).toBe('изменено админом Иванов Иван: комментарий');
    expect(mocks.notifyAdminEdit).not.toHaveBeenCalled();
  });

  it('сотрудник не может менять комментарий', async () => {
    store.sessionEmployee = { id: 7, name: owner.name };
    await expect(patchVacationRequest(employeeSession, 11, { comment: 'x' })).rejects.toMatchObject({
      statusCode: 403
    });
  });

  it('пересечение со своим же отпуском блокируется как раньше', async () => {
    await expect(
      patchVacationRequest(adminSession, 10, { start: '2026-12-10', end: '2026-12-21' })
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
