import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  bitrixRest: vi.fn(),
  bitrixWebhookRest: vi.fn(),
  createBitrixVacationSyncFailedNotification: vi.fn(),
  findEmployeeByName: vi.fn(async (_name: string) => ({ id: 1, bitrix_user_id: 501 })),
  readEmployees: vi.fn(async () => [])
}));

vi.mock('../../server/utils/bitrixClient', () => ({
  bitrixRest: mocks.bitrixRest,
  bitrixWebhookRest: mocks.bitrixWebhookRest
}));
vi.mock('../../server/utils/bitrixConfig', () => ({
  isBitrixWebhookConfigured: () => true,
  getBitrixWebhookUrl: () => 'https://portal.example/rest/1/secret'
}));
vi.mock('../../server/utils/bitrixOAuthServiceToken', () => ({
  getBitrixServiceAccessToken: async () => null,
  hasBitrixOAuthServiceToken: async () => false
}));
vi.mock('../../server/utils/adminNotificationsStore', () => ({
  createBitrixVacationSyncFailedNotification: mocks.createBitrixVacationSyncFailedNotification
}));
vi.mock('../../server/utils/employeesStore', () => ({
  findEmployeeByName: mocks.findEmployeeByName,
  readEmployees: mocks.readEmployees
}));

import type { VacationRequest } from '../../app/composables/useVacations';
import type { VacationStoreState } from '../../server/utils/vacationsStore';
import {
  reconcileFutureAbsences,
  removeVacationAbsenceFromBitrix,
  retryFailedBitrixVacationSyncs,
  syncApprovedVacationsToBitrix
} from '../../server/utils/bitrixVacationAbsence';

type El = { CODE?: string; ACTIVE_FROM?: string; ACTIVE_TO?: string; PROPERTY_1?: Record<string, string> };

const stateOf = (requests: VacationRequest[]): VacationStoreState => ({
  primaryYear: 2026,
  requestsByYear: { '2026': requests },
  nextRequestId: 2000,
  reservationsByYear: {},
  nextReservationId: 1
});
const all = (s: VacationStoreState) => Object.values(s.requestsByYear).flat();

const calls = () =>
  mocks.bitrixWebhookRest.mock.calls.map(([method, params]) => ({
    method: method as string,
    params: params as Record<string, any>
  }));
const callsOf = (method: string) => calls().filter((c) => c.method === method);
const writes = () => calls().filter((c) => c.method !== 'lists.element.get');

/** Портал с хранением: add создаёт элемент, update меняет, delete удаляет. */
const fakePortal = (iblock3: Record<number, El>, firstId = 99001) => {
  let nextId = firstId;
  const dt = (v: string) => v;
  mocks.bitrixWebhookRest.mockImplementation(async (method: string, params: Record<string, any>) => {
    const rows = () => Object.entries(iblock3).map(([id, el]) => ({ ID: id, ...el }));
    if (method === 'lists.element.get') {
      if (Number(params.IBLOCK_ID) !== 3) return [];
      const f = params.FILTER || {};
      if (f.ID != null) {
        const ids = (Array.isArray(f.ID) ? f.ID : [f.ID]).map(Number);
        return rows().filter((r) => ids.includes(Number(r.ID)));
      }
      if (params.ELEMENT_CODE) return rows().filter((r) => r.CODE === params.ELEMENT_CODE);
      if (f.CODE) throw new Error('Bitrix webhook lists.element.get: Filter field not allowed: CODE');
      if (f.PROPERTY_1 != null) {
        return rows()
          .filter((r) => Object.values(r.PROPERTY_1 || {})[0] === String(f.PROPERTY_1))
          .filter((r) => !f.ACTIVE_FROM || String(r.ACTIVE_FROM).slice(0, 10) === f.ACTIVE_FROM);
      }
      return [];
    }
    if (method === 'lists.element.add') {
      const id = nextId++;
      iblock3[id] = {
        CODE: params.ELEMENT_CODE,
        ACTIVE_FROM: dt(params.FIELDS.ACTIVE_FROM),
        ACTIVE_TO: dt(params.FIELDS.ACTIVE_TO),
        PROPERTY_1: { '10': String(params.FIELDS.PROPERTY_1) }
      };
      return id;
    }
    if (method === 'lists.element.update') {
      const id = Number(params.ELEMENT_ID);
      if (!iblock3[id]) throw new Error('Bitrix REST lists.element.update: Element not found');
      iblock3[id] = {
        ...iblock3[id],
        ...(params.ELEMENT_CODE ? { CODE: params.ELEMENT_CODE } : {}),
        ACTIVE_FROM: params.FIELDS.ACTIVE_FROM,
        ACTIVE_TO: params.FIELDS.ACTIVE_TO
      };
      return true;
    }
    if (method === 'lists.element.delete') {
      const id = Number(params.ELEMENT_ID);
      if (!iblock3[id]) throw new Error('Bitrix REST lists.element.delete: Element not found');
      delete iblock3[id];
      return true;
    }
    throw new Error(`unexpected ${method}`);
  });
};

const pending = (patch: Partial<VacationRequest> = {}): VacationRequest => ({
  id: 77,
  employee: 'Иванов Иван',
  start: '2026-12-25',
  end: '2027-01-12',
  status: 'pending',
  comment: '',
  createdAt: '2026-11-01T00:00:00.000Z',
  ...patch
});

describe('Bitrix: отпуск, разрезанный праздниками, — отсутствие на каждый отрезок', () => {
  const savedAppEnv = process.env.NUXT_PUBLIC_APP_ENV;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-19T12:00:00Z'));
    process.env.NUXT_PUBLIC_APP_ENV = 'production';
    delete process.env.BITRIX_ABSENCE_IBLOCK_ID;
    delete process.env.BITRIX_ABSENCE_IBLOCK_TYPE_ID;
    delete process.env.BITRIX_ABSENCE_PROPERTY_USER;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    mocks.bitrixWebhookRest.mockReset();
    mocks.createBitrixVacationSyncFailedNotification.mockReset();
    mocks.findEmployeeByName.mockImplementation(async () => ({ id: 1, bitrix_user_id: 501 }));
  });
  afterEach(() => {
    vi.useRealTimers();
    process.env.NUXT_PUBLIC_APP_ENV = savedAppEnv;
    vi.restoreAllMocks();
  });

  it('согласование 25.12.2026–12.01.2027 → два отсутствия (25–30.12 и 09–12.01), на праздники нет', async () => {
    const portal: Record<number, El> = {};
    fakePortal(portal);
    const prev = stateOf([pending()]);
    const next = stateOf([pending({ status: 'approved' })]);
    const res = await syncApprovedVacationsToBitrix(prev, next);

    const adds = callsOf('lists.element.add');
    expect(adds.map((a) => [a.params.ELEMENT_CODE, a.params.FIELDS.ACTIVE_FROM, a.params.FIELDS.ACTIVE_TO])).toEqual([
      ['vbi-hr-vac-77', '25.12.2026 00:00:00', '30.12.2026 23:59:59'],
      ['vbi-hr-vac-77-p2', '09.01.2027 00:00:00', '12.01.2027 23:59:59']
    ]);
    expect(all(res)[0]).toMatchObject({
      bitrix_absence_id: 99001,
      bitrix_absence_parts: [
        { start: '2026-12-25', end: '2026-12-30', absence_id: 99001 },
        { start: '2027-01-09', end: '2027-01-12', absence_id: 99002 }
      ],
      bitrix_sync_status: 'synced'
    });
  });

  it('правка дат согласованной разрезанной заявки → отрезки пересобираются, лишний удаляется', async () => {
    const portal: Record<number, El> = {
      99001: { CODE: 'vbi-hr-vac-77', ACTIVE_FROM: '25.12.2026 00:00:00', ACTIVE_TO: '30.12.2026 23:59:59', PROPERTY_1: { '10': '501' } },
      99002: { CODE: 'vbi-hr-vac-77-p2', ACTIVE_FROM: '09.01.2027 00:00:00', ACTIVE_TO: '12.01.2027 23:59:59', PROPERTY_1: { '10': '501' } }
    };
    fakePortal(portal, 99100);
    const synced = pending({
      status: 'approved',
      bitrix_absence_id: 99001,
      bitrix_absence_iblock_id: 3,
      bitrix_absence_parts: [
        { start: '2026-12-25', end: '2026-12-30', absence_id: 99001 },
        { start: '2027-01-09', end: '2027-01-12', absence_id: 99002 }
      ],
      bitrix_sync_status: 'synced',
      bitrix_sync_method: 'lists.element.add:webhook'
    });
    const res = await syncApprovedVacationsToBitrix(
      stateOf([synced]),
      stateOf([{ ...synced, start: '2026-12-14', end: '2026-12-27' }])
    );

    expect(callsOf('lists.element.add')).toHaveLength(0);
    expect(callsOf('lists.element.update').map((u) => u.params.ELEMENT_ID)).toEqual([99001]);
    expect(callsOf('lists.element.delete').map((d) => d.params.ELEMENT_ID)).toEqual([99002]);
    expect(Object.keys(portal)).toEqual(['99001']);
    expect(all(res)[0]!.bitrix_absence_parts).toEqual([{ start: '2026-12-14', end: '2026-12-27', absence_id: 99001 }]);
  });

  it('правка дат старой заявки с одним элементом → первый отрезок берёт старый id, второй создаётся', async () => {
    const portal: Record<number, El> = {
      500: { CODE: 'vbi-hr-vac-77', ACTIVE_FROM: '14.12.2026 00:00:00', ACTIVE_TO: '20.12.2026 23:59:59', PROPERTY_1: { '10': '501' } }
    };
    fakePortal(portal);
    const legacy = pending({
      status: 'approved',
      start: '2026-12-14',
      end: '2026-12-20',
      bitrix_absence_id: 500,
      bitrix_absence_iblock_id: 3,
      bitrix_sync_status: 'synced',
      bitrix_sync_method: 'lists.element.add:webhook'
    });
    const res = await syncApprovedVacationsToBitrix(
      stateOf([legacy]),
      stateOf([{ ...legacy, start: '2026-12-28', end: '2027-01-10' }])
    );
    expect(callsOf('lists.element.update').map((u) => u.params.ELEMENT_ID)).toEqual([500]);
    expect(callsOf('lists.element.add').map((a) => a.params.ELEMENT_CODE)).toEqual(['vbi-hr-vac-77-p2']);
    expect(all(res)[0]!.bitrix_absence_parts).toEqual([
      { start: '2026-12-28', end: '2026-12-30', absence_id: 500 },
      { start: '2027-01-09', end: '2027-01-10', absence_id: 99001 }
    ]);
  });

  it('старая согласованная заявка с одним элементом через праздники не пересоздаётся (синк, повтор, сверка)', async () => {
    const portal: Record<number, El> = {
      500: { CODE: 'vbi-hr-vac-77', ACTIVE_FROM: '25.12.2026 00:00:00', ACTIVE_TO: '12.01.2027 23:59:59', PROPERTY_1: { '10': '501' } }
    };
    fakePortal(portal);
    const legacy = pending({
      status: 'approved',
      bitrix_absence_id: 500,
      bitrix_absence_iblock_id: 3,
      bitrix_sync_status: 'synced',
      bitrix_sync_method: 'lists.element.add:webhook'
    });
    const state = stateOf([legacy]);

    expect(await syncApprovedVacationsToBitrix(state, stateOf([{ ...legacy }]))).toMatchObject({});
    const rec = await reconcileFutureAbsences(state);
    expect(rec.state).toBe(state);
    expect(writes()).toHaveLength(0);

    // повтор после failed — тоже одним элементом, без отрезков
    const failed = { ...legacy, bitrix_sync_status: 'failed' as const };
    const retried = await retryFailedBitrixVacationSyncs(stateOf([failed]));
    expect(callsOf('lists.element.add')).toHaveLength(0);
    expect(all(retried)[0]).toMatchObject({ bitrix_absence_id: 500, bitrix_sync_status: 'synced' });
    expect(all(retried)[0]!.bitrix_absence_parts).toBeUndefined();
  });

  it('сверка: пропавший второй отрезок восстанавливается с кодом -p2', async () => {
    const portal: Record<number, El> = {
      99001: { CODE: 'vbi-hr-vac-77', ACTIVE_FROM: '25.12.2026 00:00:00', ACTIVE_TO: '30.12.2026 23:59:59', PROPERTY_1: { '10': '501' } }
    };
    fakePortal(portal, 99200);
    const res = await reconcileFutureAbsences(
      stateOf([
        pending({
          status: 'approved',
          bitrix_absence_id: 99001,
          bitrix_absence_iblock_id: 3,
          bitrix_absence_parts: [
            { start: '2026-12-25', end: '2026-12-30', absence_id: 99001 },
            { start: '2027-01-09', end: '2027-01-12', absence_id: 99002 }
          ],
          bitrix_sync_status: 'synced',
          bitrix_sync_method: 'lists.element.add:webhook'
        })
      ])
    );
    expect(res).toMatchObject({ checked: 2, readded: 1, fixed: 0, failed: 0 });
    expect(callsOf('lists.element.add').map((a) => a.params.ELEMENT_CODE)).toEqual(['vbi-hr-vac-77-p2']);
    expect(all(res.state)[0]!.bitrix_absence_parts![1]).toEqual({
      start: '2027-01-09',
      end: '2027-01-12',
      absence_id: 99200
    });
    expect(all(res.state)[0]!.bitrix_absence_id).toBe(99001);
  });

  it('снятие согласования удаляет все отрезки', async () => {
    const portal: Record<number, El> = {
      99001: { CODE: 'vbi-hr-vac-77' },
      99002: { CODE: 'vbi-hr-vac-77-p2' }
    };
    fakePortal(portal);
    await removeVacationAbsenceFromBitrix(
      pending({
        status: 'approved',
        bitrix_absence_id: 99001,
        bitrix_absence_iblock_id: 3,
        bitrix_absence_parts: [
          { start: '2026-12-25', end: '2026-12-30', absence_id: 99001 },
          { start: '2027-01-09', end: '2027-01-12', absence_id: 99002 }
        ],
        bitrix_sync_method: 'lists.element.add:webhook'
      })
    );
    expect(callsOf('lists.element.delete').map((d) => d.params.ELEMENT_ID)).toEqual([99001, 99002]);
    expect(portal).toEqual({});
  });
});
