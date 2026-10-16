import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BITRIX_NOTIFY_BRIDGE_METHOD,
  BitrixWriteBlockedError,
  assertBitrixWriteAllowed,
  bitrixWritesAllowed,
  isBitrixReadMethod,
  isBitrixWriteBlockedError,
  isBitrixWritesBlockedMessage,
  shouldBlockBitrixCall
} from '../../server/utils/bitrixWriteGuard';

const READS = ['user.current', 'user.get', 'user.admin', 'department.get', 'lists.get', 'lists.element.get'];
const WRITES = [
  'lists.element.add',
  'lists.element.update',
  'lists.element.delete',
  'calendar.event.add',
  'calendar.event.delete',
  'im.notify.system.add',
  'im.message.add',
  'imbot.message.add',
  'crm.lead.add',
  'tasks.task.add',
  'batch',
  BITRIX_NOTIFY_BRIDGE_METHOD
];

describe('bitrixWriteGuard — решение стенд × метод × флаг', () => {
  it('все чтения, которые реально использует код, пропускаются на любом стенде', () => {
    for (const method of READS) {
      expect(isBitrixReadMethod(method)).toBe(true);
      for (const stand of ['production', 'staging', 'development', null] as const) {
        expect(shouldBlockBitrixCall(method, stand, undefined)).toBe(false);
      }
    }
  });

  it('метод вне allowlist = запись (запрет по умолчанию)', () => {
    for (const method of WRITES) expect(isBitrixReadMethod(method)).toBe(false);
    expect(isBitrixReadMethod('some.unknown.method')).toBe(false);
  });

  it('production пишет всегда', () => {
    expect(bitrixWritesAllowed('production')).toBe(true);
    for (const method of WRITES) expect(shouldBlockBitrixCall(method, 'production', undefined)).toBe(false);
  });

  it('staging не пишет никогда — даже с BITRIX_ALLOW_WRITES=1', () => {
    for (const flag of [undefined, '', '0', '1', 'true']) {
      expect(bitrixWritesAllowed('staging', flag)).toBe(false);
      for (const method of WRITES) expect(shouldBlockBitrixCall(method, 'staging', flag)).toBe(true);
    }
  });

  it('development не пишет, пока не задан BITRIX_ALLOW_WRITES', () => {
    expect(shouldBlockBitrixCall('lists.element.add', 'development', undefined)).toBe(true);
    expect(shouldBlockBitrixCall('lists.element.add', 'development', '0')).toBe(true);
    expect(shouldBlockBitrixCall('lists.element.add', 'development', '1')).toBe(false);
    expect(shouldBlockBitrixCall('imbot.message.add', 'development', 'true')).toBe(false);
  });

  it('стенд не определён — fail safe, запись закрыта', () => {
    expect(bitrixWritesAllowed(null, '1')).toBe(false);
    expect(shouldBlockBitrixCall('im.notify.system.add', null, '1')).toBe(true);
  });
});

describe('assertBitrixWriteAllowed (по NUXT_PUBLIC_APP_ENV вне Nitro)', () => {
  const saved = { env: process.env.NUXT_PUBLIC_APP_ENV, flag: process.env.BITRIX_ALLOW_WRITES };

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    process.env.NUXT_PUBLIC_APP_ENV = saved.env;
    process.env.BITRIX_ALLOW_WRITES = saved.flag;
    vi.restoreAllMocks();
  });

  it('staging: запись → BitrixWriteBlockedError и одна строка лога; чтение проходит', () => {
    process.env.NUXT_PUBLIC_APP_ENV = 'staging';
    process.env.BITRIX_ALLOW_WRITES = '1';
    expect(() => assertBitrixWriteAllowed('user.get')).not.toThrow();

    let caught: unknown;
    try {
      assertBitrixWriteAllowed('lists.element.add');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(BitrixWriteBlockedError);
    expect(isBitrixWriteBlockedError(caught)).toBe(true);
    expect((caught as Error).message).toBe('staging: запись в Bitrix отключена');
    expect(isBitrixWritesBlockedMessage((caught as Error).message)).toBe(true);
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith('[bitrix] staging: write blocked lists.element.add');
  });

  it('production: запись не блокируется', () => {
    process.env.NUXT_PUBLIC_APP_ENV = 'production';
    expect(() => assertBitrixWriteAllowed('lists.element.add')).not.toThrow();
    expect(console.warn).not.toHaveBeenCalled();
  });
});
