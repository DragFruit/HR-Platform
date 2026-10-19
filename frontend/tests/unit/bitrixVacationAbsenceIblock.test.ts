import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  bitrixRest: vi.fn(),
  bitrixWebhookRest: vi.fn(),
  createBitrixVacationSyncFailedNotification: vi.fn(),
  findEmployeeByName: vi.fn(async () => ({ id: 1, bitrix_user_id: 501 })),
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
  absenceElementUserId,
  removeVacationAbsenceFromBitrix,
  resolveAbsenceIblockId,
  retryFailedBitrixVacationSyncs,
  syncApprovedVacationsToBitrix,
  toBitrixDate,
  toBitrixDateTime,
  elementMatchesDates
} from '../../server/utils/bitrixVacationAbsence';

const ABSENCE_KEYS = [
  'BITRIX_ABSENCE_IBLOCK_ID',
  'BITRIX_ABSENCE_IBLOCK_TYPE_ID',
  'BITRIX_ABSENCE_PROPERTY_USER',
  'BITRIX_ABSENCE_PROPERTY_TYPE',
  'BITRIX_ABSENCE_TYPE_ENUM',
  'BITRIX_ABSENCE_PROPERTY_INFO',
  'BITRIX_ABSENCE_PROPERTY_START',
  'BITRIX_ABSENCE_PROPERTY_END'
] as const;

const req = (patch: Partial<VacationRequest>): VacationRequest => ({
  id: 1146,
  employee: 'Трифонов Николай',
  start: '2026-11-09',
  end: '2026-11-15',
  status: 'approved',
  comment: '',
  createdAt: '2026-10-01T00:00:00.000Z',
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

type Call = { method: string; params: Record<string, any> };
const calls = (): Call[] =>
  mocks.bitrixWebhookRest.mock.calls.map(([method, params]) => ({ method, params }));
const callsOf = (method: string) => calls().filter((c) => c.method === method);

/** Портал: элементы инфоблока 3 по ID; add → новый ID; update по неизвестному ID → Element not found. */
const fakePortal = (iblock3: Record<number, Record<string, unknown>>, nextId = 99001) => {
  mocks.bitrixWebhookRest.mockImplementation(async (method: string, params: Record<string, any>) => {
    if (method === 'lists.element.get') {
      if (Number(params.IBLOCK_ID) !== 3) return [];
      const filterId = params.FILTER?.ID;
      if (filterId != null) {
        const ids = (Array.isArray(filterId) ? filterId : [filterId]).map(Number);
        return ids.filter((id) => iblock3[id]).map((id) => ({ ID: String(id), ...iblock3[id] }));
      }
      if (params.ELEMENT_CODE) {
        return Object.entries(iblock3)
          .filter(([, el]) => el.CODE === params.ELEMENT_CODE)
          .map(([id, el]) => ({ ID: id, ...el }));
      }
      return [];
    }
    if (method === 'lists.element.add') return nextId;
    if (method === 'lists.element.update') {
      // Худший случай для нас: ELEMENT_CODE главнее ELEMENT_ID при поиске элемента.
      const id = params.ELEMENT_CODE
        ? Number(Object.entries(iblock3).find(([, el]) => el.CODE === params.ELEMENT_CODE)?.[0] ?? 0)
        : Number(params.ELEMENT_ID);
      if (!iblock3[id]) {
        throw new Error('Bitrix REST lists.element.update: Element not found');
      }
      return true;
    }
    if (method === 'lists.element.delete') return true;
    throw new Error(`unexpected ${method}`);
  });
};

describe('отпуска → настоящий график отсутствий (инфоблок 3)', () => {
  // «сегодня» фиксируем: отпуска ноября 2026 — будущие, июль — прошедший
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-16T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const savedAppEnv = process.env.NUXT_PUBLIC_APP_ENV;
  const savedAbsence = Object.fromEntries(ABSENCE_KEYS.map((k) => [k, process.env[k]]));

  beforeEach(() => {
    process.env.NUXT_PUBLIC_APP_ENV = 'production';
    for (const key of ABSENCE_KEYS) delete process.env[key];
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    mocks.bitrixWebhookRest.mockReset();
    mocks.bitrixRest.mockReset();
  });
  afterEach(() => {
    process.env.NUXT_PUBLIC_APP_ENV = savedAppEnv;
    for (const key of ABSENCE_KEYS) {
      if (savedAbsence[key] === undefined) delete process.env[key];
      else process.env[key] = savedAbsence[key];
    }
    vi.restoreAllMocks();
  });

  it('без env: structure → инфоблок 3 без lists.get; явный BITRIX_ABSENCE_IBLOCK_ID главнее', async () => {
    expect(await resolveAbsenceIblockId()).toEqual({ id: 3 });
    expect(mocks.bitrixWebhookRest).not.toHaveBeenCalled();

    process.env.BITRIX_ABSENCE_IBLOCK_ID = '42';
    expect(await resolveAbsenceIblockId()).toEqual({ id: 42 });
  });

  it('новый отпуск: поля графика отсутствий, без «Информация»/«Начало»/«Конец», iblock сохраняется', async () => {
    fakePortal({});
    const result = await syncApprovedVacationsToBitrix(
      stateOf([req({ status: 'pending' })]),
      stateOf([req({})])
    );

    const [add] = callsOf('lists.element.add');
    expect(add.params.IBLOCK_TYPE_ID).toBe('structure');
    expect(add.params.IBLOCK_ID).toBe(3);
    expect(add.params.FIELDS).toEqual({
      NAME: 'Отпуск: Трифонов Николай (VBI HR)',
      ACTIVE_FROM: '09.11.2026 00:00:00',
      ACTIVE_TO: '15.11.2026 23:59:59',
      PROPERTY_1: 501,
      PROPERTY_7: '1'
    });

    const [item] = all(result);
    expect(item.bitrix_absence_id).toBe(99001);
    expect(item.bitrix_absence_iblock_id).toBe(3);
    expect(item.bitrix_sync_status).toBe('synced');
  });

  it('INFO/START/END уходят только если ключи env заданы явно', async () => {
    process.env.BITRIX_ABSENCE_PROPERTY_INFO = 'PROPERTY_1551';
    process.env.BITRIX_ABSENCE_PROPERTY_START = 'PROPERTY_1548';
    process.env.BITRIX_ABSENCE_PROPERTY_END = 'PROPERTY_1549';
    fakePortal({});
    await syncApprovedVacationsToBitrix(stateOf([req({ status: 'pending' })]), stateOf([req({})]));

    const fields = callsOf('lists.element.add')[0].params.FIELDS;
    expect(fields.PROPERTY_1548).toBe('09.11.2026 00:00:00');
    expect(fields.PROPERTY_1549).toBe('15.11.2026 23:59:59');
    expect(String(fields.PROPERTY_1551)).toContain('2026-11-09');
  });

  it('перенос: ID не из инфоблока 3 → новый элемент; ID из инфоблока 3 → только отметка iblock', async () => {
    fakePortal({
      33212: { CODE: 'vbi-hr-vac-1202', ACTIVE_FROM: '16.11.2026 00:00:00', ACTIVE_TO: '22.11.2026 23:59:59' }
    });
    const wrong = req({
      id: 1146,
      bitrix_absence_id: 33277,
      bitrix_sync_status: 'synced',
      bitrix_sync_method: 'lists.element.add:oauth'
    });
    const good = req({
      id: 1202,
      start: '2026-11-16',
      end: '2026-11-22',
      bitrix_absence_id: 33212,
      bitrix_sync_status: 'synced',
      bitrix_sync_method: 'lists.element.add:oauth'
    });

    // прошедший отпуск, которого нет в графике (убрали руками), — не воскрешаем
    const past = req({
      id: 1014,
      start: '2026-07-15',
      end: '2026-07-26',
      bitrix_absence_id: 32099,
      bitrix_sync_status: 'synced',
      bitrix_sync_method: 'lists.element.add:webhook'
    });

    const result = await retryFailedBitrixVacationSyncs(stateOf([wrong, good, past]));
    const byId = new Map(all(result).map((r) => [r.id, r]));

    expect(byId.get(1146)).toMatchObject({
      bitrix_absence_id: 99001,
      bitrix_absence_iblock_id: 3,
      bitrix_sync_status: 'synced',
      bitrix_sync_method: 'lists.element.add:webhook'
    });
    expect(byId.get(1202)).toMatchObject({ bitrix_absence_id: 33212, bitrix_absence_iblock_id: 3 });

    const adds = callsOf('lists.element.add');
    expect(adds).toHaveLength(1);
    expect(adds[0].params.ELEMENT_CODE).toBe('vbi-hr-vac-1146');
    expect(callsOf('lists.element.update')).toHaveLength(0);
    expect(callsOf('lists.element.delete')).toHaveLength(0);
    expect(byId.get(1014)?.bitrix_absence_id).toBe(32099);
    expect(byId.get(1014)?.bitrix_absence_iblock_id).toBeUndefined();

    // повторный проход ничего не делает
    mocks.bitrixWebhookRest.mockClear();
    await retryFailedBitrixVacationSyncs(result);
    expect(callsOf('lists.element.add')).toHaveLength(0);
  });

  it('сохранённый чужой iblock (313): ID не ищем и не апдейтим, создаём в инфоблоке 3', async () => {
    fakePortal({});
    const stale = req({
      bitrix_absence_id: 33277,
      bitrix_absence_iblock_id: 313,
      bitrix_sync_status: 'synced',
      bitrix_sync_method: 'lists.element.add:oauth'
    });
    const result = await retryFailedBitrixVacationSyncs(stateOf([stale]));

    expect(all(result)[0]).toMatchObject({ bitrix_absence_id: 99001, bitrix_absence_iblock_id: 3 });
    expect(callsOf('lists.element.get').some((c) => c.params.FILTER?.ID === 33277)).toBe(false);
    expect(callsOf('lists.element.update')).toHaveLength(0);
  });

  it('update отвечает Element not found → создаём заново', async () => {
    // find по ID видит элемент со старыми датами, а update его уже не находит
    fakePortal({});
    mocks.bitrixWebhookRest.mockImplementation(async (method: string, params: Record<string, any>) => {
      if (method === 'lists.element.get') {
        return params.FILTER?.ID === 555
          ? [{ ID: '555', ACTIVE_FROM: '01.11.2026 00:00:00', ACTIVE_TO: '05.11.2026 23:59:59' }]
          : [];
      }
      if (method === 'lists.element.update') throw new Error('Bitrix REST lists.element.update: Element not found');
      if (method === 'lists.element.add') return 99002;
      throw new Error(`unexpected ${method}`);
    });
    const before = req({ bitrix_absence_id: 555, bitrix_absence_iblock_id: 3, bitrix_sync_status: 'synced' });
    const after = { ...before, start: '2026-11-10' };
    const result = await syncApprovedVacationsToBitrix(stateOf([before]), stateOf([after]));

    expect(all(result)[0]).toMatchObject({
      bitrix_absence_id: 99002,
      bitrix_absence_iblock_id: 3,
      bitrix_sync_method: 'lists.element.add-after-not-found:webhook'
    });
  });

  it('снятие отметки из чужого инфоблока ничего не удаляет', async () => {
    fakePortal({});
    await removeVacationAbsenceFromBitrix(req({ bitrix_absence_id: 33277, bitrix_absence_iblock_id: 313 }));
    expect(callsOf('lists.element.delete')).toHaveLength(0);
  });

  it('absenceElementUserId читает настроенное свойство пользователя', () => {
    expect(absenceElementUserId({ PROPERTY_1: { '1': '2579' } })).toBe(2579);
    process.env.BITRIX_ABSENCE_PROPERTY_USER = 'PROPERTY_99';
    expect(absenceElementUserId({ PROPERTY_99: { '7': '42' }, PROPERTY_1: { '1': '2579' } })).toBe(42);
  });

  it('даты отпуска: перестановка строки, 00:00:00 / 23:59:59, одинаковые в любом TZ процесса', () => {
    const prevTz = process.env.TZ;
    try {
      for (const tz of ['UTC', 'Europe/Moscow', 'Asia/Almaty', 'America/Los_Angeles', 'Pacific/Kiritimati']) {
        process.env.TZ = tz;
        expect(toBitrixDate('2026-11-09')).toBe('09.11.2026');
        expect(toBitrixDate('2026-12-31')).toBe('31.12.2026');
        expect(toBitrixDate('2027-01-01')).toBe('01.01.2027');
        expect(toBitrixDateTime('2026-10-12')).toBe('12.10.2026 00:00:00');
        expect(toBitrixDateTime('2026-10-25', true)).toBe('25.10.2026 23:59:59');
        expect(toBitrixDateTime('2026-12-31', true)).toBe('31.12.2026 23:59:59');
      }
    } finally {
      if (prevTz === undefined) delete process.env.TZ;
      else process.env.TZ = prevTz;
    }
    expect(() => toBitrixDate('09.11.2026')).toThrow();
    expect(() => toBitrixDate('')).toThrow();
  });

  it('перенос дат: update шлёт 00:00:00 – 23:59:59 и ELEMENT_CODE своего элемента', async () => {
    fakePortal({
      33212: { CODE: 'vbi-hr-vac-1202', ACTIVE_FROM: '16.11.2026', ACTIVE_TO: '22.11.2026' }
    });
    const before = req({
      id: 1202,
      start: '2026-11-16',
      end: '2026-11-22',
      bitrix_absence_id: 33212,
      bitrix_absence_iblock_id: 3,
      bitrix_sync_status: 'synced'
    });
    const after = { ...before, start: '2026-11-23', end: '2026-11-29' };
    await syncApprovedVacationsToBitrix(stateOf([before]), stateOf([after]));
    const updates = callsOf('lists.element.update');
    expect(updates.length).toBe(1);
    expect(updates[0].params.FIELDS.ACTIVE_FROM).toBe('23.11.2026 00:00:00');
    expect(updates[0].params.FIELDS.ACTIVE_TO).toBe('29.11.2026 23:59:59');
    // без ELEMENT_CODE lists.element.update стирает CODE (FIELDS.CODE Bitrix не применяет)
    expect(updates[0].params.ELEMENT_ID).toBe(33212);
    expect(updates[0].params.ELEMENT_CODE).toBe('vbi-hr-vac-1202');
  });
  it('elementMatchesDates: конец только 23:59:59 последнего дня', () => {
    const ok = { ACTIVE_FROM: '16.11.2026 00:00:00', ACTIVE_TO: '22.11.2026 23:59:59' };
    expect(elementMatchesDates(ok, '2026-11-16', '2026-11-22')).toBe(true);
    expect(elementMatchesDates({ ...ok, ACTIVE_FROM: '16.11.2026' }, '2026-11-16', '2026-11-22')).toBe(true);
    // так стало у 32004 после d7b8911: отпуск кончается в 00:00 последнего дня
    expect(elementMatchesDates({ ...ok, ACTIVE_TO: '22.11.2026 00:00:00' }, '2026-11-16', '2026-11-22')).toBe(false);
    expect(elementMatchesDates({ ...ok, ACTIVE_TO: '22.11.2026' }, '2026-11-16', '2026-11-22')).toBe(false);
    expect(elementMatchesDates({ ...ok, ACTIVE_TO: '23.11.2026 02:59:59' }, '2026-11-16', '2026-11-22')).toBe(false);
    expect(elementMatchesDates({ ...ok, ACTIVE_TO: '21.11.2026 23:59:59' }, '2026-11-16', '2026-11-22')).toBe(false);
    expect(elementMatchesDates({ ...ok, ACTIVE_FROM: '15.11.2026 00:00:00' }, '2026-11-16', '2026-11-22')).toBe(false);
  });

  it('CODE стёрт (как у 32095): update с ELEMENT_CODE → not found → повтор по ELEMENT_ID, без add', async () => {
    fakePortal({ 32095: { CODE: '', ACTIVE_FROM: '16.11.2026', ACTIVE_TO: '22.11.2026' } });
    const before = req({
      id: 3,
      start: '2026-11-16',
      end: '2026-11-22',
      bitrix_absence_id: 32095,
      bitrix_absence_iblock_id: 3,
      bitrix_sync_status: 'synced'
    });
    const result = await syncApprovedVacationsToBitrix(
      stateOf([before]),
      stateOf([{ ...before, end: '2026-11-23' }])
    );
    const updates = callsOf('lists.element.update');
    expect(updates).toHaveLength(2);
    expect(updates[0].params).toMatchObject({ ELEMENT_ID: 32095, ELEMENT_CODE: 'vbi-hr-vac-3' });
    expect(updates[1].params.ELEMENT_ID).toBe(32095);
    expect(updates[1].params.ELEMENT_CODE).toBeUndefined();
    expect(updates[1].params.FIELDS.ACTIVE_TO).toBe('23.11.2026 23:59:59');
    expect(callsOf('lists.element.add')).toHaveLength(0);
    expect(all(result)[0].bitrix_absence_id).toBe(32095);
  });

  it('CODE заявки у другого элемента → чужой по коду не адресуем, update только по ELEMENT_ID', async () => {
    fakePortal({
      32095: { CODE: '', ACTIVE_FROM: '16.11.2026', ACTIVE_TO: '22.11.2026' },
      40001: { CODE: 'vbi-hr-vac-3', ACTIVE_FROM: '01.12.2026', ACTIVE_TO: '05.12.2026' }
    });
    const before = req({
      id: 3,
      start: '2026-11-16',
      end: '2026-11-22',
      bitrix_absence_id: 32095,
      bitrix_absence_iblock_id: 3,
      bitrix_sync_status: 'synced'
    });
    await syncApprovedVacationsToBitrix(stateOf([before]), stateOf([{ ...before, end: '2026-11-23' }]));
    const updates = callsOf('lists.element.update');
    expect(updates).toHaveLength(1);
    expect(updates[0].params.ELEMENT_ID).toBe(32095);
    expect(updates[0].params.ELEMENT_CODE).toBeUndefined();
  });
});
