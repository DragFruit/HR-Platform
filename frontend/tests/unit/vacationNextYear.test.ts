import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { VacationRequest } from '../../app/composables/useVacations';
import { assessVacationBalance, openingBalanceForYear } from '../../app/utils/vacationBalance';
import {
  isBookableVacationYear,
  requestsAroundYear,
  vacationBookingYearError,
  vacationRequestYearMessage
} from '../../app/utils/vacationBookingYears';
import { buildDaySetsForEmployee } from '../../app/utils/vacationCalendar';
import { createJsonVacationsRepo } from '../../server/vacations/jsonStore';
import type { VacationsRepo } from '../../server/vacations/types';
import type { ServerEmployee } from '../../server/utils/employeesStore';
import {
  normalizeVacationStoreState,
  withoutVacationServiceFields,
  type VacationStoreState
} from '../../server/utils/vacationsStore';
import {
  applyVacationYearRollover,
  isVacationRolloverDue,
  moscowYear,
  msUntilNextMoscowMidnight,
  runScheduledVacationRollover,
  runVacationYearRollover,
  type VacationRolloverDeps
} from '../../server/utils/vacationYearRollover';

const NAME = 'Петров Пётр';
/** Приём 01.01.2020: одно начисление ЗУП в месяц (17-е / 15-е / 16-е), 28/12 дня. */
const HIRE = '2020-01-01';

const req = (patch: Partial<VacationRequest> & Pick<VacationRequest, 'id' | 'start' | 'end'>): VacationRequest => ({
  employee: NAME,
  status: 'approved',
  comment: '',
  createdAt: '01.01.2026',
  ...patch
});

/** 2026: 14 дн. согласовано (6–19 июля) + 5 дн. на согласовании (9–13 ноября) = 19 дн. */
const usage2026 = [
  req({ id: 1, start: '2026-07-06', end: '2026-07-19' }),
  req({ id: 2, start: '2026-11-09', end: '2026-11-13', status: 'pending' })
];
/** Заявка на следующий год: 5–25 апреля 2027, 21 billable-день. */
const APR_START = '2027-04-05';
const APR_END = '2027-04-25';

describe('остаток для отпуска в следующем году', () => {
  it('база на 01.01.2027 = остаток на 31.12.2026: 10 + 28 начислено − 19 использовано = 19', () => {
    expect(openingBalanceForYear(NAME, HIRE, 2027, usage2026, 2026, 10)).toBe(19);
    // текущий учётный год — как раньше, opening balance из карточки
    expect(openingBalanceForYear(NAME, HIRE, 2026, usage2026, 2026, 10)).toBe(10);
  });

  it('апрель 2027: доступно 19 + 7 (янв–мар 2027) = 26, 21 день хватает (раньше было 17 и «Не хватает 4 дн.»)', () => {
    const a = assessVacationBalance(NAME, HIRE, APR_START, APR_END, usage2026, 2026, undefined, 10);
    expect(a.neededDays).toBe(21);
    expect(a.availableAtStart).toBe(26);
    expect(a.status).toBe('ok');
    expect(a.deficit).toBe(0);
  });

  it('использование 2026 уменьшает остаток 2027: ещё 10 дн. в декабре → 16, не хватает 5', () => {
    const more = [...usage2026, req({ id: 3, start: '2026-12-07', end: '2026-12-16' })];
    const a = assessVacationBalance(NAME, HIRE, APR_START, APR_END, more, 2026, undefined, 10);
    expect(a.availableAtStart).toBe(16);
    expect(a.status).toBe('advance');
    expect(a.deficit).toBe(5);
  });

  it('без opening balance не завышает: 168 + 28 − 19 = 177 на 01.01.2027, к 5 апреля 184 (раньше 203)', () => {
    expect(openingBalanceForYear(NAME, HIRE, 2027, usage2026, 2026, null)).toBe(177);
    const a = assessVacationBalance(NAME, HIRE, APR_START, APR_END, usage2026, 2026, undefined, null);
    expect(a.availableAtStart).toBe(184);
  });

  it('отклонённые заявки 2026 не списываются', () => {
    const withRejected = [...usage2026, req({ id: 4, start: '2026-12-07', end: '2026-12-16', status: 'rejected' })];
    expect(openingBalanceForYear(NAME, HIRE, 2027, withRejected, 2026, 10)).toBe(19);
  });

  it('после перехода года цифры те же: rollover пишет 19, оценка на апрель 2027 снова 26', () => {
    const emp = { id: 7, name: NAME, hired_at: HIRE, vacation_opening_balance: 10 } as ServerEmployee;
    const state: VacationStoreState = {
      primaryYear: 2026,
      requestsByYear: { '2026': usage2026 },
      nextRequestId: 10,
      reservationsByYear: {},
      nextReservationId: 1
    };
    const rolled = applyVacationYearRollover([emp], state, 2026, 2027);
    expect(rolled.employees[0]!.vacation_opening_balance).toBe(19);
    const after = assessVacationBalance(NAME, HIRE, APR_START, APR_END, usage2026, 2027, undefined, 19);
    expect(after.availableAtStart).toBe(26);
  });

  it('принят в 2027: база на 01.01.2027 = 0', () => {
    expect(openingBalanceForYear(NAME, '2027-02-01', 2027, [], 2026, null)).toBe(0);
  });
});

describe('пересечения и календарь через Новый год', () => {
  const byYear = {
    '2026': [req({ id: 11, start: '2026-12-28', end: '2027-01-10' })],
    '2027': [req({ id: 12, start: '2027-03-01', end: '2027-03-05' })],
    '2028': [req({ id: 13, start: '2028-01-10', end: '2028-01-12' })]
  };

  it('requestsAroundYear берёт папки year−1, year, year+1 без дублей', () => {
    expect(requestsAroundYear(byYear, 2027).map((r) => r.id).sort()).toEqual([11, 12, 13]);
    expect(requestsAroundYear(byYear, 2026).map((r) => r.id).sort()).toEqual([11, 12]);
    expect(requestsAroundYear({ '2026': [byYear['2026'][0]!], '2027': [byYear['2026'][0]!] }, 2027)).toHaveLength(1);
  });

  it('отпуск 28.12.2026–10.01.2027 виден в январе 2027 (раньше календарь 2027 его не видел)', () => {
    const old = buildDaySetsForEmployee(NAME, 2027, byYear['2027']);
    expect(old.approved.has('2027-01-05')).toBe(false);
    const sets = buildDaySetsForEmployee(NAME, 2027, requestsAroundYear(byYear, 2027));
    expect(sets.approved.has('2027-01-05')).toBe(true);
    expect(sets.approved.has('2026-12-30')).toBe(false); // только дни своего года
  });
});

describe('годы для новых заявок и броней', () => {
  it('открыты только primaryYear и primaryYear+1', () => {
    expect(isBookableVacationYear(2026, 2026)).toBe(true);
    expect(isBookableVacationYear(2027, 2026)).toBe(true);
    expect(isBookableVacationYear(2028, 2026)).toBe(false);
    expect(isBookableVacationYear(2025, 2026)).toBe(false);
  });

  it('заявка на 2028 при учётном 2026 — понятная ошибка', () => {
    expect(vacationBookingYearError('2028-02-01', '2028-02-10', 2026)).toBe(vacationRequestYearMessage(2026));
    expect(vacationRequestYearMessage(2026)).toContain('только на 2026 или 2027 год');
    expect(vacationBookingYearError('2027-02-01', '2027-02-10', 2026)).toBeNull();
    expect(vacationBookingYearError('2027-12-28', '2028-01-05', 2026)).toBeNull();
  });

  it('старая заявка прошлого года правится как раньше, но перенести её в 2028 нельзя', () => {
    expect(vacationBookingYearError('2025-08-04', '2025-08-10', 2026, '2025-08-01')).toBeNull();
    expect(vacationBookingYearError('2025-08-04', '2025-08-10', 2026)).not.toBeNull();
    expect(vacationBookingYearError('2028-08-04', '2028-08-10', 2026, '2025-08-01')).not.toBeNull();
  });
});

describe('автосмена года: дата по Москве', () => {
  it('31.12 23:30 МСК — ещё 2026; 01.01 00:00:30 МСК — уже 2027', () => {
    expect(moscowYear(new Date('2026-12-31T20:30:00Z'))).toBe(2026);
    expect(isVacationRolloverDue(2026, new Date('2026-12-31T20:30:00Z'))).toBe(false);
    expect(moscowYear(new Date('2026-12-31T21:00:30Z'))).toBe(2027);
    expect(isVacationRolloverDue(2026, new Date('2026-12-31T21:00:30Z'))).toBe(true);
    // по UTC ещё 31.12, по Москве уже 1 января
    expect(isVacationRolloverDue(2026, new Date('2026-12-31T22:00:00Z'))).toBe(true);
  });

  it('таймер срабатывает в 00:00:30 по Москве', () => {
    const now = new Date('2026-12-31T20:30:00Z'); // 23:30 МСК
    expect(msUntilNextMoscowMidnight(now)).toBe(30 * 60 * 1000 + 30 * 1000);
    const at = new Date('2026-10-19T09:00:00Z'); // 12:00 МСК
    expect(new Date(at.getTime() + msUntilNextMoscowMidnight(at)).toISOString()).toBe('2026-10-19T21:00:30.000Z');
  });
});

describe('автосмена года: атомарно и идемпотентно', () => {
  let dir = '';
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'vac-rollover-'));
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  /** mutate как в vacationsStore: нормализация, очередь/замок хранилища. */
  const mutateOn =
    (repo: VacationsRepo): VacationRolloverDeps['mutate'] =>
    async (mutator, ctx) => {
      let result!: VacationStoreState;
      await repo.mutateRaw(async (raw) => {
        result = await mutator(normalizeVacationStoreState(raw));
        return result;
      }, ctx);
      return result;
    };

  const setup = async (file: string, opts: { employeesDelayMs?: number; failApply?: number } = {}) => {
    const repo = createJsonVacationsRepo(join(dir, file));
    await repo.writeRaw({
      primaryYear: 2026,
      requestsByYear: { '2026': usage2026 },
      nextRequestId: 10,
      reservationsByYear: {},
      nextReservationId: 1
    });
    let employees: ServerEmployee[] = [
      { id: 7, name: NAME, hired_at: HIRE, vacation_opening_balance: 10 } as ServerEmployee,
      { id: 8, name: 'Без Даты', hired_at: '', vacation_opening_balance: null } as unknown as ServerEmployee
    ];
    let failsLeft = opts.failApply ?? 0;
    let applyCalls = 0;
    const deps: VacationRolloverDeps = {
      mutate: mutateOn(repo),
      readVacations: async () => normalizeVacationStoreState(await repo.readRaw()),
      readEmployees: async () => {
        if (opts.employeesDelayMs) await sleep(opts.employeesDelayMs);
        return employees;
      },
      applyOpeningBalances: async (balances) => {
        applyCalls += 1;
        if (failsLeft > 0) {
          failsLeft -= 1;
          throw new Error('employees write failed');
        }
        employees = employees.map((e) =>
          balances[String(e.id)] === undefined ? e : { ...e, vacation_opening_balance: balances[String(e.id)]! }
        );
        return Object.keys(balances).length;
      },
      now: () => new Date('2026-12-31T21:00:30Z')
    };
    return { repo, deps, getEmployees: () => employees, getApplyCalls: () => applyCalls };
  };

  it('заявка, созданная во время перехода года, не теряется', async () => {
    const { repo, deps, getEmployees } = await setup('concurrent.json', { employeesDelayMs: 60 });
    const rollover = runVacationYearRollover(deps, 2027);
    await sleep(10); // переход уже внутри замка, ждёт справочник
    const create = deps.mutate((state) => {
      const id = state.nextRequestId++;
      state.requestsByYear['2027'] = [
        ...(state.requestsByYear['2027'] ?? []),
        req({ id, start: '2027-02-01', end: '2027-02-05', status: 'pending' })
      ];
      return state;
    });
    const [outcome] = await Promise.all([rollover, create]);
    expect(outcome.changed).toBe(true);
    expect(outcome.employeesApplied).toBe(true);

    const saved = normalizeVacationStoreState(await repo.readRaw());
    expect(saved.primaryYear).toBe(2027);
    expect(saved.requestsByYear['2027']!.map((r) => r.id)).toEqual([10]);
    expect(saved.nextRequestId).toBe(11);
    expect(saved.yearRollover).toMatchObject({ fromYear: 2026, toYear: 2027, openingBalances: { '7': 19 } });
    expect(saved.yearRollover!.employeesAppliedAt).toBeTruthy();
    expect(getEmployees()[0]!.vacation_opening_balance).toBe(19);
    expect(outcome.skipped).toEqual(['Без Даты']);
  });

  it('повторный запуск ничего не меняет (идемпотентно)', async () => {
    const { repo, deps, getEmployees, getApplyCalls } = await setup('idempotent.json');
    await runVacationYearRollover(deps, 2027);
    const first = await repo.readRaw();
    const again = await runVacationYearRollover(deps, 2027);
    expect(again.changed).toBe(false);
    expect(await repo.readRaw()).toEqual(first);
    expect(getEmployees()[0]!.vacation_opening_balance).toBe(19); // не 19 + ещё раз
    expect(getApplyCalls()).toBe(1);
    expect((await runScheduledVacationRollover(deps))).toBeNull();
  });

  it('запуск по расписанию до полуночи по Москве ничего не делает, после — переводит год', async () => {
    const { repo, deps } = await setup('scheduled.json');
    expect(await runScheduledVacationRollover({ ...deps, now: () => new Date('2026-12-31T20:59:00Z') })).toBeNull();
    expect((await repo.readRaw()).primaryYear).toBe(2026);
    const outcome = await runScheduledVacationRollover(deps);
    expect(outcome?.changed).toBe(true);
    expect((await repo.readRaw()).primaryYear).toBe(2027);
  });

  it('сбой записи карточек: год сменён, остатки доделает следующий запуск без двойного списания', async () => {
    const { repo, deps, getEmployees } = await setup('retry.json', { failApply: 1 });
    const outcome = await runVacationYearRollover(deps, 2027);
    expect(outcome.changed).toBe(true);
    expect(outcome.employeesApplied).toBe(false);
    const mid = normalizeVacationStoreState(await repo.readRaw());
    expect(mid.primaryYear).toBe(2027);
    expect(mid.yearRollover!.employeesAppliedAt).toBeNull();
    expect(getEmployees()[0]!.vacation_opening_balance).toBe(10);

    expect(await runScheduledVacationRollover(deps)).toBeNull();
    expect(getEmployees()[0]!.vacation_opening_balance).toBe(19);
    expect(normalizeVacationStoreState(await repo.readRaw()).yearRollover!.employeesAppliedAt).toBeTruthy();
  });

  it('снимок остатков не уходит клиенту', () => {
    const state = normalizeVacationStoreState({
      primaryYear: 2027,
      yearRollover: {
        fromYear: 2026,
        toYear: 2027,
        at: '',
        reason: 'x',
        openingBalances: { '7': 19 },
        employeesAppliedAt: null
      }
    });
    expect(state.yearRollover).toBeDefined();
    expect('yearRollover' in withoutVacationServiceFields(state)).toBe(false);
  });
});
