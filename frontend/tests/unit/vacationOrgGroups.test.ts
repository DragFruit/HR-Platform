import { describe, expect, it } from 'vitest';
import type { Employee } from '../../app/composables/useEmployees';
import type { VacationRequest } from '../../app/composables/useVacations';
import { resolveEmployeeReservationCapContext } from '../../app/utils/vacationDepartmentGroups';
import { resolveDigitalOrgVacationGroups, type OrgStructureLike } from '../../app/utils/vacationOrgGroups';
import {
  getReservationRangeBlockReason,
  toEmployeeReservationCapContext
} from '../../app/utils/vacationReservationCaps';

/** Оргструктура в форме прода (core.org_units + core.org_links, 2026-10-28). */
const unit = (id: string, name: string) => ({ id, name });
const link = (from: [string, string], to: [string, string]) => ({
  from: { kind: from[0], id: from[1], side: 'bottom' },
  to: { kind: to[0], id: to[1], side: 'top' }
}) as OrgStructureLike['links'][number];

const ORG: OrgStructureLike = {
  units: [
    unit('u-digital', 'Digital отдел'),
    unit('u-context', 'Отдел контекстной и медийной рекламы'),
    unit('u-smm', 'Отдел SMM & Influence & Таргета'),
    unit('u-analytics', 'Отдел аналитики'),
    unit('u-dev', 'Отдел разработки'),
    unit('u-sales', 'Отдел продаж')
  ],
  links: [
    link(['executive', 'exe-ceo'], ['unit', 'u-digital']),
    link(['executive', 'exe-ceo'], ['unit', 'u-dev']),
    link(['executive', 'exe-cco'], ['unit', 'u-sales']),
    link(['unit', 'u-digital'], ['unit', 'u-context']),
    link(['unit', 'u-digital'], ['unit', 'u-smm']),
    link(['unit', 'u-digital'], ['unit', 'u-analytics'])
  ]
};

/** Справочник Digital как на проде: [id, ФИО, руководитель (строка), manager_id]. */
const DIGITAL_ROWS: [number, string, string, number | null][] = [
  [848, 'Ревзина Ксения Игоревна', 'Юдин Вадим', 2825],
  [1284, 'Жукова Юлия Рафиковна', 'Ревзина Ксения', 848],
  [2094, 'Цхай Виталий Юрьевич', 'Ревзина Ксения', 848],
  [2121, 'Шелободкина Анна Алексеевна', 'Цхай Виталий', 2094],
  [2216, 'Хакимов Олег Рустамович', 'Попов Виктор', 2730],
  [2253, 'Сухова Екатерина Андреевна', 'Лунин Дмитрий', 2533],
  [2293, 'Голуб Алина Эдуардовна', 'Лунин Дмитрий', 2533],
  [2295, 'Левина Анастасия Владимировна', 'Ревзина Ксения', 848],
  [2305, 'Кухарев Владислав Вадимович', 'Цхай Виталий', 2094],
  [2417, 'Мощев Максим Вадимович', 'Ревзина Ксения', 848],
  [2504, 'Громов Максим Александрович', 'Ревзина Ксения', 848],
  [2533, 'Лунин Дмитрий Евгеньевич', 'Ревзина Ксения', 848],
  [2574, 'Маленкова Кристина Алексеевна', 'Лунин Дмитрий', 2533],
  [2637, 'Трифонов Николай Олегович', 'Попов Виктор', 2730],
  [2641, 'Булатникова Алена Борисовна', 'Цхай Виталий', 2094],
  [2673, 'Носков Никита', 'Ревзина Ксения', 848],
  [2697, 'Нижегородцев Василий Викторович', 'Попов Виктор', 2730],
  [2700, 'Павлов Вячеслав Андреевич', 'Цхай Виталий', 2094],
  [2724, 'Александрова Анна Дмитриевна', 'Цхай Виталий', 2094],
  [2726, 'Седова Елизавета Александровна', 'Носков Никита', 2673],
  [2730, 'Попов Виктор Сергеевич', 'Ревзина Ксения', 848],
  [2740, 'Новосельцева Алина Анатольевна', 'Лунин Дмитрий', 2533],
  [2775, 'Бояринова Мария', 'Попов Виктор', 2730],
  [2783, 'Чертков Иван', 'Носков Никита', 2673],
  [2799, 'Гончарова Дарья Степановна', 'Цхай Виталий', 2094],
  [2806, 'Девочкина Валерия', 'Лунин Дмитрий', 2533],
  [2812, 'Перишкова Светлана', 'Попов Виктор', 2730],
  [2817, 'Потапов Данила Витальевич', 'Цхай Виталий', 2094],
  [2819, 'Кладова Кристина', 'Носков Никита', 2673]
];

const toEmp = (id: number, name: string, department: string, manager = '', manager_id: number | null = null) =>
  ({ id, name, department, manager, manager_id, title: '' }) as unknown as Employee;

const ALL: Employee[] = [
  ...DIGITAL_ROWS.map(([id, name, manager, managerId]) => toEmp(id, name, 'Digital', manager, managerId)),
  ...['Дев Один', 'Дев Два', 'Дев Три', 'Дев Четыре', 'Дев Пять', 'Дев Шесть'].map((n, i) => toEmp(9000 + i, n, 'DEV')),
  toEmp(9100, 'Продажник Один', 'Отдел продаж')
];

const byName = (name: string) => {
  const found = ALL.find((e) => e.name.startsWith(name));
  if (!found) throw new Error(`нет ${name}`);
  return found;
};

const helpers = (orgStructure: OrgStructureLike | null) => ({
  directReports: (ref: string | number) =>
    ALL.filter((e) => e.manager_id === (typeof ref === 'number' ? ref : ALL.find((x) => x.name.startsWith(ref))?.id)),
  findByName: (name: string) => ALL.find((e) => e.name.startsWith(name)),
  employeesInDepartment: (department: string) => ALL.filter((e) => e.department === department),
  allEmployees: ALL,
  orgStructure
});

const ctxFor = (name: string, org: OrgStructureLike | null = ORG) => {
  const resolved = resolveEmployeeReservationCapContext(byName(name), helpers(org));
  if (!resolved) throw new Error(`нет контекста для ${name}`);
  return toEmployeeReservationCapContext(resolved);
};

const surnames = (names: string[]) => names.map((n) => n.split(' ')[0]).sort((a, b) => a.localeCompare(b, 'ru'));

let nextId = 1;
const request = (employee: string, start: string, end: string, status: VacationRequest['status'] = 'approved') =>
  ({ id: nextId++, employee: byName(employee).name, start, end, status, comment: '', createdAt: '2026-01-01' }) as VacationRequest;

describe('группы Digital из оргструктуры', () => {
  const groups = resolveDigitalOrgVacationGroups(ORG, ALL)!;

  it('группы = секции дочерних нод «Digital отдел»', () => {
    expect(groups.map((g) => g.id)).toEqual([
      'digital-lunin',
      'digital-popov',
      'digital-tskhai',
      'digital-noskov',
      'digital-analytics'
    ]);
    const members = Object.fromEntries(groups.map((g) => [g.id, surnames(g.members.map((m) => m.name))]));
    expect(members['digital-tskhai']).toEqual(
      surnames(['Цхай', 'Шелободкина', 'Кухарев', 'Булатникова', 'Павлов', 'Александрова', 'Гончарова', 'Потапов'])
    );
    expect(members['digital-popov']).toEqual(
      surnames(['Попов', 'Хакимов', 'Трифонов', 'Нижегородцев', 'Бояринова', 'Перишкова'])
    );
    expect(members['digital-lunin']).toEqual(
      surnames(['Лунин', 'Сухова', 'Голуб', 'Маленкова', 'Новосельцева', 'Девочкина'])
    );
    expect(members['digital-noskov']).toEqual(surnames(['Носков', 'Седова', 'Чертков', 'Кладова']));
    expect(members['digital-analytics']).toEqual(surnames(['Левина', 'Мощев']));
  });

  it('Ревзина, Жукова, Громов стоят прямо в Digital: только лимит отдела', () => {
    for (const name of ['Ревзина', 'Жукова', 'Громов']) {
      const ctx = ctxFor(name);
      expect(ctx.department.id).toBe('digital-department');
      expect(ctx.department.memberNames).toHaveLength(DIGITAL_ROWS.length);
      expect(ctx.subgroup).toBeNull();
    }
  });

  it('Ревзина и Жукова в одни даты: можно (раньше была общая группа «Дирекция»)', () => {
    expect(
      getReservationRangeBlockReason({
        context: ctxFor('Жукова'),
        start: '2026-12-01',
        end: '2026-12-05',
        reservations: [],
        requests: [request('Ревзина', '2026-12-01', '2026-12-10')],
        excludeEmployee: byName('Жукова').name
      })
    ).toBeNull();
  });

  it('Кладова 29–30.10 (реальные заявки Digital): из её группы никто не пересекается, в отделе двое → можно', () => {
    const ctx = ctxFor('Кладова');
    expect(ctx.subgroup?.id).toBe('digital-noskov');
    const real = [
      request('Цхай', '2026-10-05', '2026-10-18'),
      request('Хакимов', '2026-10-12', '2026-10-21'),
      request('Седова', '2026-10-19', '2026-10-20'),
      request('Бояринова', '2026-10-26', '2026-11-01'),
      request('Девочкина', '2026-10-26', '2026-11-08'),
      request('Павлов', '2026-11-02', '2026-11-15'),
      request('Чертков', '2026-11-09', '2026-11-13', 'pending')
    ];
    const base = { context: ctx, reservations: [], requests: real, excludeEmployee: byName('Кладова').name };
    expect(getReservationRangeBlockReason({ ...base, start: '2026-10-29', end: '2026-10-30' })).toBeNull();
    // Сдвиг на 19.10 задел бы Седову из той же группы → блок группы.
    expect(getReservationRangeBlockReason({ ...base, start: '2026-10-19', end: '2026-10-19' })).toBe('subgroup');
  });

  it('группа Цхая из структуры освобождена от лимита группы, лимит отдела действует', () => {
    const ctx = ctxFor('Потапов');
    expect(ctx.subgroup?.id).toBe('digital-tskhai');
    const four = ['Павлов', 'Кухарев', 'Гончарова', 'Александрова'].map((n) => request(n, '2026-07-06', '2026-07-17'));
    const base = { context: ctx, start: '2026-07-10', end: '2026-07-12', reservations: [], excludeEmployee: byName('Потапов').name };
    expect(getReservationRangeBlockReason({ ...base, requests: four })).toBeNull();
    expect(
      getReservationRangeBlockReason({ ...base, requests: [...four, request('Хакимов', '2026-07-12', '2026-07-12')] })
    ).toBe('department');
  });

  it('другая группа контекста (Попов) по-прежнему «1 на группу»', () => {
    const ctx = ctxFor('Хакимов');
    expect(ctx.subgroup?.id).toBe('digital-popov');
    expect(
      getReservationRangeBlockReason({
        context: ctx,
        start: '2026-06-05',
        end: '2026-06-06',
        reservations: [],
        requests: [request('Трифонов', '2026-06-01', '2026-06-10')],
        excludeEmployee: byName('Хакимов').name
      })
    ).toBe('subgroup');
  });

  it('не-Digital без изменений: DEV — пул отдела, без группы', () => {
    const ctx = ctxFor('Дев Шесть');
    expect(ctx.department.id).toBe('department:DEV');
    expect(ctx.subgroup).toBeNull();
  });

  it('нет данных оргструктуры по Digital → запасная раскладка из кода', () => {
    const empty: OrgStructureLike = { units: [unit('u-dev', 'Отдел разработки')], links: [] };
    expect(resolveDigitalOrgVacationGroups(empty, ALL)).toBeNull();
    expect(ctxFor('Жукова', empty).subgroup?.id).toBe('digital-directorate');
    expect(ctxFor('Потапов', empty).subgroup?.id).toBe('digital-tskhai');
  });
});
