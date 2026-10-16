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
  removeVacationAbsenceFromBitrix,
  retryFailedBitrixVacationSyncs,
  syncApprovedVacationsToBitrix
} from '../../server/utils/bitrixVacationAbsence';
import { isBitrixWriteBlockedError } from '../../server/utils/bitrixWriteGuard';

const BLOCKED = 'staging: запись в Bitrix отключена';

const req = (patch: Partial<VacationRequest>): VacationRequest => ({
  id: 1,
  employee: 'Иванов Иван',
  start: '2026-11-02',
  end: '2026-11-15',
  status: 'approved',
  comment: '',
  createdAt: '2026-10-01T00:00:00.000Z',
  ...patch
});

const stateOf = (requests: VacationRequest[]): VacationStoreState => ({
  primaryYear: 2026,
  requestsByYear: { '2026': requests },
  nextRequestId: 100,
  reservationsByYear: {},
  nextReservationId: 1
});

const all = (s: VacationStoreState) => Object.values(s.requestsByYear).flat();

describe('синк отпусков в Bitrix на стейдже', () => {
  const savedEnv = process.env.NUXT_PUBLIC_APP_ENV;

  beforeEach(() => {
    process.env.NUXT_PUBLIC_APP_ENV = 'staging';
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.bitrixRest.mockReset();
    mocks.bitrixWebhookRest.mockReset();
    mocks.createBitrixVacationSyncFailedNotification.mockReset();
  });
  afterEach(() => {
    process.env.NUXT_PUBLIC_APP_ENV = savedEnv;
    vi.restoreAllMocks();
  });

  it('новое согласование → skipped с честной причиной, без сети, без алерта админу и без фейкового id', async () => {
    const previous = stateOf([req({ status: 'pending' })]);
    const next = stateOf([req({ status: 'approved' })]);

    const result = await syncApprovedVacationsToBitrix(previous, next);
    const [item] = all(result);

    expect(item.bitrix_sync_status).toBe('skipped');
    expect(item.bitrix_sync_error).toBe(BLOCKED);
    expect(item.bitrix_absence_id).toBeUndefined();
    expect(mocks.bitrixWebhookRest).not.toHaveBeenCalled();
    expect(mocks.bitrixRest).not.toHaveBeenCalled();
    expect(mocks.createBitrixVacationSyncFailedNotification).not.toHaveBeenCalled();
  });

  it('старые failed на стейдже переводятся в skipped один раз и больше не ретраятся', async () => {
    const failed = Array.from({ length: 5 }, (_, i) =>
      req({ id: i + 1, bitrix_sync_status: 'failed', bitrix_sync_error: 'Invalid request credentials' })
    );
    const s0 = stateOf(failed);

    const s1 = await syncApprovedVacationsToBitrix(s0, s0);
    expect(all(s1).every((r) => r.bitrix_sync_status === 'skipped' && r.bitrix_sync_error === BLOCKED)).toBe(
      true
    );

    // следующая мутация: ничего не меняется (тот же объект), сети нет
    const s2 = await syncApprovedVacationsToBitrix(s1, s1);
    expect(s2).toBe(s1);
    const s3 = await retryFailedBitrixVacationSyncs(s2);
    expect(s3).toBe(s2);

    expect(mocks.bitrixWebhookRest).not.toHaveBeenCalled();
    expect(mocks.createBitrixVacationSyncFailedNotification).not.toHaveBeenCalled();
  });

  it('снятие отметки на стейдже бросает BitrixWriteBlockedError (absence id не затираем)', async () => {
    let caught: unknown;
    try {
      await removeVacationAbsenceFromBitrix(req({ bitrix_absence_id: 777 }));
    } catch (err) {
      caught = err;
    }
    expect(isBitrixWriteBlockedError(caught)).toBe(true);
    expect(mocks.bitrixWebhookRest).not.toHaveBeenCalled();
  });

  it('production по-прежнему ходит в Bitrix', async () => {
    process.env.NUXT_PUBLIC_APP_ENV = 'production';
    mocks.bitrixWebhookRest.mockRejectedValue(new Error('portal down'));

    const previous = stateOf([req({ status: 'pending' })]);
    const next = stateOf([req({ status: 'approved' })]);
    const result = await syncApprovedVacationsToBitrix(previous, next);

    expect(mocks.bitrixWebhookRest).toHaveBeenCalled();
    expect(all(result)[0].bitrix_sync_status).toBe('failed');
  });
});
