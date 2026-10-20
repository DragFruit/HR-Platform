import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VibePasswordEntry } from '../../server/profile/domains';

type Emp = { id: number; name: string; email?: string; bitrix_user_id?: number | null };

const mocks = vi.hoisted(() => ({
  employees: [] as Emp[],
  revokedEmails: new Set<string>(),
  entries: [] as VibePasswordEntry[],
  audit: [] as Array<{ reason?: string; actorEmployeeId?: number | null }>,
  calls: [] as string[],
  sent: [] as Array<{ bitrixUserId: number; message: string }>,
  sendImpl: null as null | ((p: { bitrixUserId: number; message: string }) => Promise<unknown>)
}));

vi.mock('../../server/utils/employeesStore', () => ({
  readEmployees: async () => mocks.employees.map((e) => ({ ...e }))
}));
vi.mock('../../server/utils/employeeAccessDenylist', () => ({
  isAccessRevokedForIdentity: async (i: { email?: string }) => mocks.revokedEmails.has(String(i.email))
}));
vi.mock('../../server/utils/bitrixImbot', () => ({
  isBitrixImbotConfigured: () => true,
  sendBitrixImbotMessage: async (p: { bitrixUserId: number; message: string }) => {
    mocks.calls.push('send');
    if (mocks.sendImpl) return mocks.sendImpl(p);
    mocks.sent.push(p);
    return { messageId: 1, channel: 'test' };
  }
}));
vi.mock('../../server/utils/profileStore', () => ({
  vibePasswordsRepo: async () => ({
    backend: 'json',
    async read() {
      mocks.calls.push('read-pw');
      return structuredClone(mocks.entries);
    },
    async mutate(fn: (items: VibePasswordEntry[]) => unknown, ctx?: { reason?: string; actorEmployeeId?: number | null }) {
      const copy = structuredClone(mocks.entries);
      const r = await fn(copy);
      if (JSON.stringify(copy) !== JSON.stringify(mocks.entries)) {
        mocks.entries = copy;
        mocks.audit.push({ reason: ctx?.reason, actorEmployeeId: ctx?.actorEmployeeId });
        mocks.calls.push(`write:${ctx?.reason}`);
      }
      return r;
    }
  })
}));

import {
  VIBE_PASSWORD_DIGITS,
  VIBE_PASSWORD_LOWER,
  VIBE_PASSWORD_SYMBOLS,
  VIBE_PASSWORD_UPPER,
  generateVibePassword,
  issueVibeCredentials,
  vibeCredentialsMessage,
  vibeLoginEmail
} from '../../server/utils/vibeCredentialsIssue';
import { checkVibePassword, getVibePasswordPlain, setVibePassword } from '../../server/utils/vibePasswordsStore';

const PASSWORD_IN_MESSAGE = /Пароль: (.+)$/m;
const passwordOf = (message: string) => PASSWORD_IN_MESSAGE.exec(message)![1]!;

describe('generateVibePassword', () => {
  it('16 символов, все классы, без похожих символов, разные', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const p = generateVibePassword();
      expect(p).toHaveLength(16);
      expect([...p].some((c) => VIBE_PASSWORD_UPPER.includes(c))).toBe(true);
      expect([...p].some((c) => VIBE_PASSWORD_LOWER.includes(c))).toBe(true);
      expect([...p].some((c) => VIBE_PASSWORD_DIGITS.includes(c))).toBe(true);
      expect([...p].some((c) => VIBE_PASSWORD_SYMBOLS.includes(c))).toBe(true);
      expect(p).not.toMatch(/[0O1lIo\s]/);
      seen.add(p);
    }
    expect(seen.size).toBe(300);
  });
});

describe('vibeLoginEmail', () => {
  it('только @vbi.ru, без учёта регистра', () => {
    expect(vibeLoginEmail(' Drago.S@VBI.RU ')).toBe('drago.s@vbi.ru');
    expect(vibeLoginEmail('a@vbi.kz')).toBeNull();
    expect(vibeLoginEmail('a@mail.vbi.ru')).toBeNull();
    expect(vibeLoginEmail('a@vbi.ru.evil.com')).toBeNull();
    expect(vibeLoginEmail('')).toBeNull();
    expect(vibeLoginEmail(undefined)).toBeNull();
  });
});

describe('vibeCredentialsMessage', () => {
  it('текст дословно, с переносами', () => {
    expect(vibeCredentialsMessage('x@vbi.ru', 'P@ss')).toBe(
      'Хорошего тебе дня!\nВ Вайбе доступен вход не только через Битрикс, но и по логину паролю\n\nТвои доступы:\nЛогин: x@vbi.ru\nПароль: P@ss'
    );
  });
});

describe('issueVibeCredentials', () => {
  const savedEnv = process.env.NUXT_PUBLIC_APP_ENV;
  let logs: string[];

  beforeEach(() => {
    vi.stubGlobal('createError', (o: { statusCode: number; statusMessage: string }) =>
      Object.assign(new Error(o.statusMessage), o)
    );
    vi.stubEnv('VBI_SESSION_SECRET', 'test-seal-secret');
    process.env.NUXT_PUBLIC_APP_ENV = 'production';
    mocks.employees = [
      { id: 1, name: 'Драго Станислава', email: 'Drago@VBI.ru', bitrix_user_id: 2684 },
      { id: 2, name: 'Казах', email: 'k@vbi.kz', bitrix_user_id: 10 },
      { id: 3, name: 'Без битрикса', email: 'nob@vbi.ru', bitrix_user_id: null },
      { id: 4, name: 'Без почты', email: '', bitrix_user_id: 11 },
      { id: 5, name: 'Уже с паролем', email: 'has@vbi.ru', bitrix_user_id: 12 },
      { id: 6, name: 'Закрыт', email: 'gone@vbi.ru', bitrix_user_id: 13 },
      { id: 9001, name: 'Мария Тестова', email: 'qa@vbi.ru', bitrix_user_id: 14 }
    ];
    mocks.revokedEmails = new Set(['gone@vbi.ru']);
    mocks.entries = [];
    mocks.audit = [];
    mocks.calls = [];
    mocks.sent = [];
    mocks.sendImpl = null;
    logs = [];
    for (const level of ['log', 'info', 'warn', 'error'] as const) {
      vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
        logs.push(args.map(String).join(' '));
      });
    }
  });
  afterEach(() => {
    process.env.NUXT_PUBLIC_APP_ENV = savedEnv;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  const seedExisting = async () => {
    await setVibePassword(5, 'Existing-Pass-123');
    mocks.audit = [];
    mocks.calls = [];
  };

  it('dryRun по умолчанию: список и причины, ничего не пишет и не шлёт', async () => {
    await seedExisting();
    const before = structuredClone(mocks.entries);
    const res = await issueVibeCredentials({ all: true });
    expect(res.dry_run).toBe(true);
    const by = Object.fromEntries(res.rows.map((r) => [r.employee_id, r]));
    expect(by[1]).toMatchObject({ status: 'would_issue', email: 'drago@vbi.ru', bitrix_user_id: 2684 });
    expect(by[2]).toMatchObject({ status: 'skipped', reason: expect.stringContaining('@vbi.ru') });
    expect(by[3]).toMatchObject({ status: 'skipped', reason: expect.stringContaining('Bitrix ID') });
    expect(by[4]).toMatchObject({ status: 'skipped', reason: expect.stringContaining('нет email') });
    expect(by[5]).toMatchObject({ status: 'skipped', reason: expect.stringContaining('уже задан') });
    expect(by[6]).toMatchObject({ status: 'skipped', reason: expect.stringContaining('denylist') });
    expect(by[9001]).toMatchObject({ status: 'skipped', reason: expect.stringContaining('QA') });
    expect(mocks.entries).toEqual(before);
    expect(mocks.sent).toHaveLength(0);
    expect(mocks.calls.filter((c) => c !== 'read-pw')).toEqual([]);
  });

  it('id не из справочника → skipped', async () => {
    const res = await issueVibeCredentials({ employeeIds: [777] });
    expect(res.rows).toEqual([expect.objectContaining({ employee_id: 777, status: 'skipped' })]);
  });

  it('по Bitrix ID: находит сотрудника, неизвестный → skipped', async () => {
    const res = await issueVibeCredentials({ bitrixUserIds: [2684, 99999], employeeIds: [1] });
    expect(res.rows).toEqual([
      expect.objectContaining({ employee_id: 1, bitrix_user_id: 2684, status: 'would_issue' }),
      expect.objectContaining({ employee_id: 0, bitrix_user_id: 99999, status: 'skipped' })
    ]);
  });

  it('без employeeIds и all → 400', async () => {
    await expect(issueVibeCredentials({})).rejects.toMatchObject({ statusCode: 400 });
  });

  it('боевой прогон: set → verify → send, вход по email работает, глаз открывает пароль', async () => {
    const res = await issueVibeCredentials({ employeeIds: [1], dryRun: false, actorEmployeeId: 42 });
    expect(res.rows[0]).toMatchObject({ employee_id: 1, status: 'sent' });
    expect(mocks.sent).toHaveLength(1);
    expect(mocks.sent[0]!.bitrixUserId).toBe(2684);
    const pw = passwordOf(mocks.sent[0]!.message);
    expect(mocks.sent[0]!.message).toBe(vibeCredentialsMessage('drago@vbi.ru', pw));
    expect(await checkVibePassword(1, pw)).toBe(true);
    expect(await getVibePasswordPlain(1)).toBe(pw);
    // порядок: запись пароля раньше отправки, отметка «доставлено» после
    const order = mocks.calls.filter((c) => c !== 'read-pw');
    expect(order).toEqual(['write:vibe-credentials-issued', 'send', 'write:vibe-credentials-sent']);
    expect(mocks.audit).toEqual([
      { reason: 'vibe-credentials-issued', actorEmployeeId: 42 },
      { reason: 'vibe-credentials-sent', actorEmployeeId: 42 }
    ]);
    expect(mocks.entries[0]!.credentials_sent_at).toBeTruthy();
    // ни пароля, ни текста в результате и логах
    expect(JSON.stringify(res)).not.toContain(pw);
    expect(JSON.stringify(res)).not.toContain('Твои доступы');
    expect(logs.join('\n')).not.toContain(pw);
    expect(logs.join('\n')).not.toContain('Твои доступы');
  });

  it('уже есть пароль: без overwriteExisting не трогаем, с ним перевыдаём', async () => {
    await seedExisting();
    const skip = await issueVibeCredentials({ employeeIds: [5], dryRun: false });
    expect(skip.rows[0]).toMatchObject({ status: 'skipped' });
    expect(await checkVibePassword(5, 'Existing-Pass-123')).toBe(true);
    const over = await issueVibeCredentials({ employeeIds: [5], dryRun: false, overwriteExisting: true });
    expect(over.rows[0]).toMatchObject({ status: 'sent' });
    expect(await checkVibePassword(5, 'Existing-Pass-123')).toBe(false);
  });

  it('отправка упала → пароль задан, set_not_delivered без секрета; resend шлёт ТОТ ЖЕ пароль', async () => {
    let failedPw = '';
    mocks.sendImpl = async (p) => {
      failedPw = passwordOf(p.message);
      throw new Error(`imbot.message.add: boom ${failedPw}`);
    };
    const res = await issueVibeCredentials({ employeeIds: [1], dryRun: false });
    expect(res.rows[0]).toMatchObject({ status: 'set_not_delivered' });
    expect(JSON.stringify(res)).not.toContain(failedPw);
    expect(await checkVibePassword(1, failedPw)).toBe(true);
    expect(mocks.entries[0]!.credentials_sent_at).toBeUndefined();

    // обычный прогон не перевыдаёт молча
    mocks.sendImpl = null;
    const again = await issueVibeCredentials({ employeeIds: [1], dryRun: false });
    expect(again.rows[0]).toMatchObject({ status: 'skipped', reason: expect.stringContaining('resendUndelivered') });
    expect(mocks.sent).toHaveLength(0);

    const dry = await issueVibeCredentials({ employeeIds: [1], resendUndelivered: true });
    expect(dry.rows[0]).toMatchObject({ status: 'would_resend' });
    expect(mocks.sent).toHaveLength(0);

    const resent = await issueVibeCredentials({ employeeIds: [1], dryRun: false, resendUndelivered: true });
    expect(resent.rows[0]).toMatchObject({ status: 'resent' });
    expect(passwordOf(mocks.sent[0]!.message)).toBe(failedPw);
    expect(await checkVibePassword(1, failedPw)).toBe(true);
    expect(mocks.entries[0]!.credentials_sent_at).toBeTruthy();

    // доставленным повтор не шлёт
    const twice = await issueVibeCredentials({ employeeIds: [1], dryRun: false, resendUndelivered: true });
    expect(twice.rows[0]).toMatchObject({ status: 'skipped' });
    expect(mocks.sent).toHaveLength(1);
  });

  it('стейдж: пароль задаётся, отправка заблокирована гвардом → «не доставлено: staging»', async () => {
    process.env.NUXT_PUBLIC_APP_ENV = 'staging';
    mocks.sendImpl = async () => {
      const { assertBitrixWriteAllowed } = await import('../../server/utils/bitrixWriteGuard');
      assertBitrixWriteAllowed('imbot.message.add');
      return {};
    };
    const dry = await issueVibeCredentials({ employeeIds: [1] });
    expect(dry.delivery.bitrix_writes_blocked).toBe(true);
    expect(dry.rows[0]!.reason).toContain('staging');
    const res = await issueVibeCredentials({ employeeIds: [1], dryRun: false });
    expect(res.rows[0]).toMatchObject({ status: 'set_not_delivered', reason: 'не доставлено: staging: запись в Bitrix отключена' });
    expect(mocks.entries).toHaveLength(1);
  });
});
