import { describe, expect, it } from 'vitest';
import {
  isQaAuthoredIdea,
  isQaPersonVacationRow,
  stripQaAuthoredIdeas,
  stripQaPersonVacations,
  stripQaProfileActivity
} from '../../server/utils/qaProdContent';
import { isQaTestPersonName, mergeQaTestEmployees } from '../../app/data/qaTestDepartment';

const PROD = { NODE_ENV: 'production' } as Record<string, string | undefined>;
const QA_ON = { NODE_ENV: 'production', NUXT_PUBLIC_QA_TEST_DEPARTMENT: '1' } as Record<string, string | undefined>;

describe('isQaTestPersonName', () => {
  it('точное ФИО из состава QA-отдела', () => {
    expect(isQaTestPersonName('Даша Тестова')).toBe(true);
    expect(isQaTestPersonName('  константин   тестов ')).toBe(true);
    expect(isQaTestPersonName('Тестовый Сотрудник 07')).toBe(true);
    expect(isQaTestPersonName('Юбилеев Тест')).toBe(true);
  });
  it('не ловит по слову «тест»', () => {
    expect(isQaTestPersonName('Тестов Иван')).toBe(false);
    expect(isQaTestPersonName('Тестовый бриф')).toBe(false);
    expect(isQaTestPersonName('Ревзина Ксения')).toBe(false);
    expect(isQaTestPersonName('')).toBe(false);
    expect(isQaTestPersonName(undefined)).toBe(false);
  });
});

describe('stripQaAuthoredIdeas', () => {
  const state = {
    ideas: [
      { id: 'idea-1', authorUserId: 3, authorName: 'Даша Тестова', title: 'Мяя' },
      { id: 'idea-2', authorUserId: 2684, authorName: 'Ревзина Ксения', title: 'Реальная' }
    ],
    nextIdeaId: 3,
    votesByUserId: { '2684': { 'idea-1': 'up', 'idea-2': 'down' } }
  };

  it('бой: идея QA-сотрудника и голоса за неё убраны', () => {
    const out = stripQaAuthoredIdeas(state, PROD);
    expect(out.ideas.map((i) => i.id)).toEqual(['idea-2']);
    expect(out.votesByUserId).toEqual({ '2684': { 'idea-2': 'down' } });
    expect(out.nextIdeaId).toBe(3);
    expect(state.ideas).toHaveLength(2); // вход не мутируется
  });

  it('стенд с QA-флагом: без изменений', () => {
    expect(stripQaAuthoredIdeas(state, QA_ON)).toBe(state);
  });

  it('isQaAuthoredIdea по ФИО автора', () => {
    expect(isQaAuthoredIdea(state.ideas[0])).toBe(true);
    expect(isQaAuthoredIdea(state.ideas[1])).toBe(false);
  });
});

describe('stripQaPersonVacations', () => {
  const state = {
    primaryYear: 2026,
    nextRequestId: 1112,
    requestsByYear: {
      '2026': [
        { id: 1003, employee: 'Даша Тестова', start: '2026-11-16', end: '2026-11-22', status: 'approved' },
        { id: 1104, employee: 'Константин Тестов', start: '2026-08-24', end: '2026-08-30', status: 'pending' },
        { id: 1200, employee: 'Переименована', employee_id: 9004, start: '2026-01-01', end: '2026-01-02', status: 'pending' },
        { id: 1006, employee: 'Ревзина Ксения', employee_id: 2684, start: '2026-03-24', end: '2026-03-25', status: 'approved' }
      ]
    },
    reservationsByYear: {
      '2026': [
        { id: 1, employee: 'Василий Тестов', year: 2026, month: 5, durationDays: 7, createdAt: '' },
        { id: 2, employee: 'Ревзина Ксения', year: 2026, month: 6, durationDays: 7, createdAt: '' }
      ]
    }
  };

  it('бой: заявки и брони QA-сотрудников (по ФИО и employee_id) убраны', () => {
    const out = stripQaPersonVacations(state, PROD);
    expect(out.requestsByYear['2026']!.map((r) => r.id)).toEqual([1006]);
    expect(out.reservationsByYear['2026']!.map((r) => r.id)).toEqual([2]);
    expect(out.nextRequestId).toBe(1112);
  });

  it('стенд с QA-флагом: без изменений', () => {
    expect(stripQaPersonVacations(state, QA_ON)).toBe(state);
  });

  it('isQaPersonVacationRow', () => {
    expect(isQaPersonVacationRow({ employee: 'Ревзина Ксения', employee_id: 2684 })).toBe(false);
    expect(isQaPersonVacationRow({ employee: 'X', employee_id: '9100' })).toBe(true);
    expect(isQaPersonVacationRow(null)).toBe(false);
  });
});

describe('stripQaProfileActivity', () => {
  const items = [
    { id: 'seed-jubilee-merch', employee_id: 9100 },
    { id: 'real', employee_id: 2684 }
  ];
  it('бой: записи QA-сотрудников убраны', () => {
    expect(stripQaProfileActivity(items, PROD).map((i) => i.id)).toEqual(['real']);
  });
  it('стенд с QA-флагом: без изменений', () => {
    expect(stripQaProfileActivity(items, QA_ON)).toBe(items);
  });
});

describe('mergeQaTestEmployees при выключенном QA-флаге', () => {
  it('QA-строки из хранилища не отдаются', () => {
    const prev = process.env.NUXT_PUBLIC_QA_TEST_DEPARTMENT;
    process.env.NUXT_PUBLIC_QA_TEST_DEPARTMENT = '0';
    try {
      const out = mergeQaTestEmployees([{ id: 9003 }, { id: 2684 }]);
      expect(out.map((e) => e.id)).toEqual([2684]);
    } finally {
      if (prev === undefined) delete process.env.NUXT_PUBLIC_QA_TEST_DEPARTMENT;
      else process.env.NUXT_PUBLIC_QA_TEST_DEPARTMENT = prev;
    }
  });
});

describe('сиды git: на бою ничего от QA-отдела', () => {
  it('ideas.json и vacations.json после фильтра без QA', async () => {
    const ideas = (await import('../../server/data/ideas.json')).default as { ideas: unknown[] };
    expect(stripQaAuthoredIdeas(ideas, PROD).ideas.filter(isQaAuthoredIdea)).toEqual([]);
    const vac = (await import('../../server/data/vacations.json')).default as {
      requestsByYear: Record<string, unknown[]>;
      reservationsByYear: Record<string, unknown[]>;
    };
    const out = stripQaPersonVacations(vac, PROD);
    for (const rows of [...Object.values(out.requestsByYear), ...Object.values(out.reservationsByYear)]) {
      expect(rows.filter(isQaPersonVacationRow)).toEqual([]);
    }
  });
});
