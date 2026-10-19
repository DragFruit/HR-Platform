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
  syncApprovedVacationsToBitrix
} from '../../server/utils/bitrixVacationAbsence';

type El = { CODE?: string; ACTIVE_FROM?: string; ACTIVE_TO?: string; PROPERTY_1?: Record<string, string> };

const synced = (patch: Partial<VacationRequest>): VacationRequest => ({
  id: 1171,
  employee: 'Иванов Иван',
  start: '2026-11-16',
  end: '2026-11-22',
  status: 'approved',
  comment: '',
  createdAt: '2026-10-01T00:00:00.000Z',
  bitrix_absence_id: 500,
  bitrix_absence_iblock_id: 3,
  bitrix_sync_status: 'synced',
  bitrix_sync_method: 'lists.element.add:webhook',
  ...patch
});

const stateOf = (requests: VacationRequest[]): VacationStoreState => ({
  primaryYear: 2026,
  requestsByYear: { '2026': requests },
  nextRequestId: 2000,
  reservationsByYear: {},
  nextReservationId: 1
});

const all = (s: VacationStoreState) => Object.values(s.requestsByYear).flat();
const user = (id: number) => ({ '10': String(id) });

const calls = () =>
  mocks.bitrixWebhookRest.mock.calls.map(([method, params]) => ({
    method: method as string,
    params: params as Record<string, any>
  }));
const callsOf = (method: string) => calls().filter((c) => c.method === method);
const writes = () => calls().filter((c) => c.method !== 'lists.element.get');

/** Портал: инфоблок 3, фильтры ID / ELEMENT_CODE / пользователь (+ACTIVE_FROM), add/update. */
const fakePortal = (iblock3: Record<number, El>, nextId = 99001) => {
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
          .filter((r) => !f.ACTIVE_FROM || String(r.ACTIVE_FROM) === f.ACTIVE_FROM);
      }
      return [];
    }
    if (method === 'lists.element.add') return nextId;
    if (method === 'lists.element.update') {
      if (!iblock3[Number(params.ELEMENT_ID)]) {
        throw new Error('Bitrix REST lists.element.update: Element not found');
      }
      return true;
    }
    throw new Error(`unexpected ${method}`);
  });
};

describe('ежедневная сверка дат отпусков с графиком отсутствий', () => {
  const savedAppEnv = process.env.NUXT_PUBLIC_APP_ENV;
  let info: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-19T12:00:00Z'));
    process.env.NUXT_PUBLIC_APP_ENV = 'production';
    delete process.env.BITRIX_ABSENCE_IBLOCK_ID;
    delete process.env.BITRIX_ABSENCE_IBLOCK_TYPE_ID;
    delete process.env.BITRIX_ABSENCE_PROPERTY_USER;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    info = vi.spyOn(console, 'info').mockImplementation(() => {});
    mocks.bitrixWebhookRest.mockReset();
    mocks.createBitrixVacationSyncFailedNotification.mockReset();
    mocks.findEmployeeByName.mockImplementation(async () => ({ id: 1, bitrix_user_id: 501 }));
  });
  afterEach(() => {
    vi.useRealTimers();
    process.env.NUXT_PUBLIC_APP_ENV = savedAppEnv;
    vi.restoreAllMocks();
  });

  const summaryLine = () =>
    info.mock.calls.map((c) => String(c[0])).find((l) => l.includes('reconcile: checked='));

  it('сдвинутый элемент (ACTIVE_TO следующий день 02:59:59) обновляется датами без времени', async () => {
    fakePortal({
      500: { CODE: 'vbi-hr-vac-1171', ACTIVE_FROM: '16.11.2026', ACTIVE_TO: '23.11.2026 02:59:59', PROPERTY_1: user(501) }
    });
    const res = await reconcileFutureAbsences(stateOf([synced({})]));

    const [upd] = callsOf('lists.element.update');
    expect(upd.params.ELEMENT_ID).toBe(500);
    expect(upd.params.FIELDS).toMatchObject({
      ACTIVE_FROM: '16.11.2026',
      ACTIVE_TO: '22.11.2026',
      PROPERTY_1: 501,
      CODE: 'vbi-hr-vac-1171'
    });
    expect(callsOf('lists.element.add')).toHaveLength(0);
    expect(res).toMatchObject({ checked: 1, fixed: 1, readded: 0, adopted: 0, failed: 0, dryRun: false });
    expect(all(res.state)[0]).toMatchObject({
      bitrix_absence_id: 500,
      bitrix_sync_status: 'synced',
      bitrix_sync_method: 'lists.element.update-reconcile:webhook'
    });
    expect(summaryLine()).toBe(
      '[bitrix-vacation] reconcile: checked=1 fixed=1 readded=0 adopted=0 failed=0'
    );
  });

  it('совпадающий элемент не трогаем (время в ACTIVE_TO не важно, только дата)', async () => {
    fakePortal({
      500: { CODE: 'vbi-hr-vac-1171', ACTIVE_FROM: '16.11.2026', ACTIVE_TO: '22.11.2026 23:59:59', PROPERTY_1: user(501) }
    });
    const state = stateOf([synced({})]);
    const res = await reconcileFutureAbsences(state);

    expect(writes()).toHaveLength(0);
    // одна пачка чтения по ID
    expect(callsOf('lists.element.get')).toHaveLength(1);
    expect(callsOf('lists.element.get')[0].params.FILTER.ID).toEqual([500]);
    expect(res).toMatchObject({ checked: 1, fixed: 0, readded: 0, failed: 0 });
    expect(res.state).toBe(state);
  });

  it('пустой CODE (как у 32004 заявки 1043) проставляется', async () => {
    fakePortal({
      32004: { CODE: '', ACTIVE_FROM: '16.11.2026', ACTIVE_TO: '22.11.2026', PROPERTY_1: user(501) }
    });
    const res = await reconcileFutureAbsences(stateOf([synced({ id: 1043, bitrix_absence_id: 32004 })]));

    const [upd] = callsOf('lists.element.update');
    expect(upd.params.ELEMENT_ID).toBe(32004);
    expect(upd.params.FIELDS.CODE).toBe('vbi-hr-vac-1043');
    expect(res.fixed).toBe(1);
  });

  it('элемента нет в графике → создаём заново обычным путём (ничего не удаляем)', async () => {
    fakePortal({});
    const res = await reconcileFutureAbsences(stateOf([synced({})]));

    const [add] = callsOf('lists.element.add');
    expect(add.params.ELEMENT_CODE).toBe('vbi-hr-vac-1171');
    expect(add.params.FIELDS).toMatchObject({ ACTIVE_FROM: '16.11.2026', ACTIVE_TO: '22.11.2026' });
    expect(callsOf('lists.element.delete')).toHaveLength(0);
    expect(res).toMatchObject({ checked: 1, fixed: 0, readded: 1, failed: 0 });
    expect(all(res.state)[0]).toMatchObject({ bitrix_absence_id: 99001, bitrix_absence_iblock_id: 3 });
  });

  it('прошедшие, несогласованные и несинкнутые заявки не проверяются', async () => {
    fakePortal({});
    const res = await reconcileFutureAbsences(
      stateOf([
        synced({ id: 1014, start: '2026-07-15', end: '2026-07-26', bitrix_absence_id: 32099 }),
        synced({ id: 1300, status: 'pending' }),
        synced({ id: 1301, bitrix_sync_status: 'failed' })
      ])
    );
    expect(mocks.bitrixWebhookRest).not.toHaveBeenCalled();
    expect(res.checked).toBe(0);
  });

  it('конец отпуска сегодня — ещё проверяем', async () => {
    fakePortal({
      500: { CODE: 'vbi-hr-vac-1171', ACTIVE_FROM: '13.10.2026', ACTIVE_TO: '20.10.2026 02:59:59', PROPERTY_1: user(501) }
    });
    const res = await reconcileFutureAbsences(
      stateOf([synced({ start: '2026-10-13', end: '2026-10-19' })])
    );
    expect(res.fixed).toBe(1);
  });

  it('стейдж: только чтение и лог, без записи, без failed и без алертов', async () => {
    process.env.NUXT_PUBLIC_APP_ENV = 'staging';
    fakePortal({
      500: { CODE: 'vbi-hr-vac-1171', ACTIVE_FROM: '16.11.2026', ACTIVE_TO: '23.11.2026 02:59:59', PROPERTY_1: user(501) }
    });
    const state = stateOf([synced({}), synced({ id: 1172, bitrix_absence_id: 501 })]);
    const res = await reconcileFutureAbsences(state);

    expect(writes()).toHaveLength(0);
    expect(res.state).toBe(state);
    expect(all(res.state).every((r) => r.bitrix_sync_status === 'synced')).toBe(true);
    expect(mocks.createBitrixVacationSyncFailedNotification).not.toHaveBeenCalled();
    expect(res).toMatchObject({ dryRun: true, checked: 2, fixed: 1, readded: 1, failed: 0 });
    expect(summaryLine()).toBe(
      '[bitrix-vacation] reconcile: checked=2 fixed=1 readded=1 adopted=0 failed=0 ' +
        '(dry-run: staging: запись в Bitrix отключена)'
    );
  });

  it('гвард записи на бою (ошибка «запись отключена») не превращается в failed', async () => {
    fakePortal({
      500: { CODE: 'vbi-hr-vac-1171', ACTIVE_FROM: '16.11.2026', ACTIVE_TO: '23.11.2026 02:59:59', PROPERTY_1: user(501) }
    });
    const base = mocks.bitrixWebhookRest.getMockImplementation()!;
    mocks.bitrixWebhookRest.mockImplementation(async (method: string, params: Record<string, any>) => {
      if (method === 'lists.element.update') throw new Error('staging: запись в Bitrix отключена');
      return base(method, params);
    });
    const res = await reconcileFutureAbsences(stateOf([synced({})]));
    expect(res.failed).toBe(0);
    expect(all(res.state)[0].bitrix_sync_status).toBe('synced');
  });

  describe('сирота 32167 (vbi-hr-vac-1147, заявки нет) у Трифонова', () => {
    const TRIFONOV = 2637;
    const orphan = (): Record<number, El> => ({
      32167: {
        CODE: 'vbi-hr-vac-1147',
        ACTIVE_FROM: '16.11.2026 03:00:00',
        ACTIVE_TO: '23.11.2026 02:59:59',
        PROPERTY_1: user(TRIFONOV)
      }
    });
    const trifonov = (patch: Partial<VacationRequest>): VacationRequest => ({
      id: 1212,
      employee: 'Трифонов Николай',
      start: '2026-11-16',
      end: '2026-11-22',
      status: 'approved',
      comment: '',
      createdAt: '2026-10-10T00:00:00.000Z',
      ...patch
    });

    beforeEach(() => {
      mocks.findEmployeeByName.mockImplementation(async () => ({ id: 7, bitrix_user_id: TRIFONOV }));
    });

    it('согласование 16–22.11 берёт 32167 (update дат и CODE), без второго элемента', async () => {
      fakePortal(orphan());
      const result = await syncApprovedVacationsToBitrix(
        stateOf([trifonov({ status: 'pending' })]),
        stateOf([trifonov({})])
      );

      expect(callsOf('lists.element.add')).toHaveLength(0);
      expect(callsOf('lists.element.delete')).toHaveLength(0);
      const [upd] = callsOf('lists.element.update');
      expect(upd.params.ELEMENT_ID).toBe(32167);
      expect(upd.params.FIELDS).toMatchObject({
        ACTIVE_FROM: '16.11.2026',
        ACTIVE_TO: '22.11.2026',
        PROPERTY_1: TRIFONOV,
        CODE: 'vbi-hr-vac-1212'
      });
      expect(all(result)[0]).toMatchObject({
        bitrix_absence_id: 32167,
        bitrix_absence_iblock_id: 3,
        bitrix_sync_status: 'synced',
        bitrix_sync_method: 'lists.element.update-adopted:webhook'
      });
    });

    it('заявка 1147 ещё есть в vacations.json → это не сирота, создаём новый элемент', async () => {
      fakePortal(orphan());
      const old = trifonov({ id: 1147, status: 'rejected' });
      await syncApprovedVacationsToBitrix(
        stateOf([old, trifonov({ status: 'pending' })]),
        stateOf([old, trifonov({})])
      );
      expect(callsOf('lists.element.update')).toHaveLength(0);
      expect(callsOf('lists.element.add')).toHaveLength(1);
    });

    it('даты не пересекаются → не берём, создаём новый', async () => {
      fakePortal(orphan());
      await syncApprovedVacationsToBitrix(
        stateOf([trifonov({ status: 'pending', start: '2026-12-01', end: '2026-12-07' })]),
        stateOf([trifonov({ start: '2026-12-01', end: '2026-12-07' })])
      );
      expect(callsOf('lists.element.update')).toHaveLength(0);
      expect(callsOf('lists.element.add')).toHaveLength(1);
    });

    it('элемент другого сотрудника или уже привязанный к заявке не берём', async () => {
      fakePortal({ ...orphan(), 32168: { ...orphan()[32167], CODE: 'vbi-hr-vac-1148', PROPERTY_1: user(999) } });
      const linked = trifonov({ id: 1500, start: '2027-01-10', end: '2027-01-12', bitrix_absence_id: 32167, bitrix_absence_iblock_id: 3, bitrix_sync_status: 'synced' });
      await syncApprovedVacationsToBitrix(
        stateOf([linked, trifonov({ status: 'pending' })]),
        stateOf([linked, trifonov({})])
      );
      expect(callsOf('lists.element.update').filter((c) => c.params.ELEMENT_ID === 32167)).toHaveLength(0);
      expect(callsOf('lists.element.update').filter((c) => c.params.ELEMENT_ID === 32168)).toHaveLength(0);
    });

    it('сверка: пропавший элемент заявки → берём сироту, adopted=1', async () => {
      fakePortal(orphan());
      const res = await reconcileFutureAbsences(
        stateOf([trifonov({ bitrix_absence_id: 40000, bitrix_absence_iblock_id: 3, bitrix_sync_status: 'synced', bitrix_sync_method: 'lists.element.add:webhook' })])
      );
      expect(res).toMatchObject({ checked: 1, adopted: 1, readded: 0, failed: 0 });
      expect(callsOf('lists.element.add')).toHaveLength(0);
      expect(all(res.state)[0].bitrix_absence_id).toBe(32167);
    });
  });
});
