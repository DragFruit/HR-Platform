import { describe, expect, it } from 'vitest';
import {
  getReservationMonthBlockReason,
  getReservationRangeBlockReason,
  monthsOverlappingIsoRange,
  toEmployeeReservationCapContext,
  vacationRequestCapBlockMessage,
  type EmployeeReservationCapContext
} from '../../app/utils/vacationReservationCaps';
import type { VacationReservation } from '../../app/utils/vacationReservations';
import type { VacationRequest } from '../../app/composables/useVacations';
import type { Employee } from '../../app/composables/useEmployees';
import { resolveEmployeeReservationCapContext } from '../../app/utils/vacationDepartmentGroups';

const MASHA = 'Иванова Мария';
const KOLYA = 'Петров Николай';

const context = (subgroupId: string, extraDepartment: string[] = []): EmployeeReservationCapContext => ({
  department: { id: 'digital', label: 'Digital', memberNames: [MASHA, KOLYA, ...extraDepartment] },
  subgroup: { id: subgroupId, label: 'Подгруппа', memberNames: [MASHA, KOLYA] }
});

let nextId = 1;
const request = (employee: string, start: string, end: string, status: VacationRequest['status'] = 'approved') =>
  ({ id: nextId++, employee, start, end, status, comment: '', createdAt: '2026-01-01' }) as VacationRequest;

const reservation = (employee: string, year: number, month: number): VacationReservation => ({
  id: nextId++,
  employee,
  year,
  month,
  durationDays: 7,
  createdAt: '2026-01-01'
});

const mashaApproved = request(MASHA, '2026-10-26', '2026-11-01');

describe('лимит подгруппы по датам (Маша / Коля)', () => {
  it('отпуск Маши 26.10–01.11 не блокирует Колю 09.11–15.11 (нет пересечения дней)', () => {
    expect(
      getReservationRangeBlockReason({
        context: context('digital-revzina'),
        start: '2026-11-09',
        end: '2026-11-15',
        reservations: [],
        requests: [mashaApproved],
        excludeEmployee: KOLYA
      })
    ).toBeNull();
  });

  it('Коля 30.10–05.11 пересекается с Машей → блок подгруппы', () => {
    expect(
      getReservationRangeBlockReason({
        context: context('digital-revzina'),
        start: '2026-10-30',
        end: '2026-11-05',
        reservations: [],
        requests: [mashaApproved],
        excludeEmployee: KOLYA
      })
    ).toBe('subgroup');
  });

  it('pending-заявка тоже занимает дни, rejected — нет', () => {
    const base = {
      context: context('digital-revzina'),
      start: '2026-10-30',
      end: '2026-11-05',
      reservations: [],
      excludeEmployee: KOLYA
    };
    expect(
      getReservationRangeBlockReason({ ...base, requests: [request(MASHA, '2026-10-26', '2026-11-01', 'pending')] })
    ).toBe('subgroup');
    expect(
      getReservationRangeBlockReason({ ...base, requests: [request(MASHA, '2026-10-26', '2026-11-01', 'rejected')] })
    ).toBeNull();
  });

  it('бронь Маши на ноябрь (без дат) занимает весь месяц → блок подгруппы', () => {
    expect(
      getReservationRangeBlockReason({
        context: context('digital-revzina'),
        start: '2026-11-09',
        end: '2026-11-15',
        reservations: [reservation(MASHA, 2026, 11)],
        requests: [],
        excludeEmployee: KOLYA
      })
    ).toBe('subgroup');
  });

  it('собственная бронь не блокирует (excludeEmployee)', () => {
    expect(
      getReservationRangeBlockReason({
        context: context('digital-revzina'),
        start: '2026-11-09',
        end: '2026-11-15',
        reservations: [reservation(KOLYA, 2026, 11)],
        requests: [],
        excludeEmployee: KOLYA
      })
    ).toBeNull();
  });

  it('группа Цхай освобождена от лимита подгруппы', () => {
    expect(
      getReservationRangeBlockReason({
        context: context('digital-tskhai'),
        start: '2026-10-30',
        end: '2026-11-05',
        reservations: [reservation(MASHA, 2026, 11)],
        requests: [mashaApproved],
        excludeEmployee: KOLYA
      })
    ).toBeNull();
  });

  it('пул отдела (5 на месяц) действует и для группы Цхай', () => {
    const others = ['А', 'Б', 'В', 'Г', 'Д'];
    expect(
      getReservationRangeBlockReason({
        context: context('digital-tskhai', others),
        start: '2026-11-09',
        end: '2026-11-15',
        reservations: others.map((name) => reservation(name, 2026, 11)),
        requests: [],
        excludeEmployee: KOLYA
      })
    ).toBe('department');
  });
});

describe('лимит отдела по реальному пересечению дней', () => {
  // Реальный кейс Digital, октябрь 2026, лимит отдела 5.
  const TSKHAI = 'Цхай Виталий';
  const KHAKIMOV = 'Хакимов';
  const SEDOVA = 'Седова';
  const DEVOCHKINA = 'Девочкина';
  const BOYARINOVA = 'Бояринова';
  const KLADOVA = 'Кладова';
  const NOSKOV = 'Носков Никита';

  const digitalContext = (subgroupId = 'digital-noskov'): EmployeeReservationCapContext => ({
    department: {
      id: 'digital',
      label: 'Digital',
      memberNames: [TSKHAI, KHAKIMOV, SEDOVA, DEVOCHKINA, BOYARINOVA, KLADOVA, NOSKOV]
    },
    subgroup: { id: subgroupId, label: 'Digital / SMM · Носков', memberNames: [NOSKOV, SEDOVA, KLADOVA] }
  });

  const october = [
    request(TSKHAI, '2026-10-05', '2026-10-18'),
    request(KHAKIMOV, '2026-10-12', '2026-10-21'),
    request(SEDOVA, '2026-10-19', '2026-10-20'),
    request(DEVOCHKINA, '2026-10-26', '2026-11-08'),
    request(BOYARINOVA, '2026-10-26', '2026-11-01')
  ];

  it('Кладова 29–30.10: в октябре 5 человек, но в эти дни отдыхают двое → можно', () => {
    expect(
      getReservationRangeBlockReason({
        context: digitalContext(),
        start: '2026-10-29',
        end: '2026-10-30',
        reservations: [],
        requests: october,
        excludeEmployee: KLADOVA
      })
    ).toBeNull();
  });

  it('бронь (без дат) по-прежнему помесячная: октябрь занят 5 людьми отдела', () => {
    const ctx = digitalContext();
    expect(
      getReservationMonthBlockReason({
        // Подгруппу без Седовой, чтобы проверить именно пул отдела.
        context: { ...ctx, subgroup: { ...ctx.subgroup, memberNames: [NOSKOV, KLADOVA] } },
        year: 2026,
        month: 10,
        reservations: [],
        requests: october,
        excludeEmployee: KLADOVA
      })
    ).toBe('department');
  });

  const five = ['А', 'Б', 'В', 'Г', 'Д'];
  const poolContext = (subgroupId = 'digital-revzina'): EmployeeReservationCapContext => ({
    department: { id: 'digital', label: 'Digital', memberNames: [KOLYA, ...five] },
    subgroup: { id: subgroupId, label: 'Подгруппа', memberNames: [KOLYA] }
  });

  it('5 человек отдыхают в один день → шестой с этим днём блокируется', () => {
    const requests = five.map((name, i) => request(name, `2026-03-0${i + 1}`, '2026-03-10'));
    expect(
      getReservationRangeBlockReason({
        context: poolContext(),
        start: '2026-03-10',
        end: '2026-03-12',
        reservations: [],
        requests,
        excludeEmployee: KOLYA
      })
    ).toBe('department');
    // День после общего пересечения свободен.
    expect(
      getReservationRangeBlockReason({
        context: poolContext(),
        start: '2026-03-11',
        end: '2026-03-12',
        reservations: [],
        requests,
        excludeEmployee: KOLYA
      })
    ).toBeNull();
  });

  it('6 человек в одном месяце без пересечения дней → можно', () => {
    const requests = five.map((name, i) => request(name, `2026-03-${String(i * 5 + 1).padStart(2, '0')}`, `2026-03-${String(i * 5 + 4).padStart(2, '0')}`));
    expect(
      getReservationRangeBlockReason({
        context: poolContext(),
        start: '2026-03-26',
        end: '2026-03-30',
        reservations: [],
        requests,
        excludeEmployee: KOLYA
      })
    ).toBeNull();
  });

  it('pending считается, rejected нет', () => {
    const requests = five.map((name, i) =>
      request(name, '2026-03-01', '2026-03-10', i === 0 ? 'rejected' : 'pending')
    );
    expect(
      getReservationRangeBlockReason({
        context: poolContext(),
        start: '2026-03-05',
        end: '2026-03-06',
        reservations: [],
        requests,
        excludeEmployee: KOLYA
      })
    ).toBeNull();
  });

  it('бронь без дат занимает весь свой месяц: 4 заявки + 1 бронь в тот же месяц → блок', () => {
    const requests = five.slice(0, 4).map((name) => request(name, '2026-03-20', '2026-03-25'));
    expect(
      getReservationRangeBlockReason({
        context: poolContext(),
        start: '2026-03-24',
        end: '2026-03-24',
        reservations: [reservation(five[4], 2026, 3)],
        requests,
        excludeEmployee: KOLYA
      })
    ).toBe('department');
    // Бронь на апрель на мартовские дни не влияет.
    expect(
      getReservationRangeBlockReason({
        context: poolContext(),
        start: '2026-03-24',
        end: '2026-03-24',
        reservations: [reservation(five[4], 2026, 4)],
        requests,
        excludeEmployee: KOLYA
      })
    ).toBeNull();
  });

  it('группа Цхай: лимит подгруппы не действует, лимит отдела по дням действует', () => {
    const tskhaiContext: EmployeeReservationCapContext = {
      department: { id: 'digital', label: 'Digital', memberNames: [KOLYA, MASHA, ...five] },
      subgroup: { id: 'digital-tskhai', label: 'Цхай', memberNames: [KOLYA, MASHA] }
    };
    // Маша из той же подгруппы в те же дни: для Цхая это не блок.
    expect(
      getReservationRangeBlockReason({
        context: tskhaiContext,
        start: '2026-03-05',
        end: '2026-03-06',
        reservations: [],
        requests: [request(MASHA, '2026-03-01', '2026-03-10')],
        excludeEmployee: KOLYA
      })
    ).toBeNull();
    // 5 человек отдела в тот же день: блок отдела.
    expect(
      getReservationRangeBlockReason({
        context: tskhaiContext,
        start: '2026-03-05',
        end: '2026-03-06',
        reservations: [],
        requests: five.map((name) => request(name, '2026-03-01', '2026-03-10')),
        excludeEmployee: KOLYA
      })
    ).toBe('department');
  });

  it('свой лимит отдела из настроек и текст сообщения с числом', () => {
    const requests = five.slice(0, 3).map((name) => request(name, '2026-03-01', '2026-03-10'));
    const params = {
      context: poolContext(),
      start: '2026-03-05',
      end: '2026-03-05',
      reservations: [],
      requests,
      excludeEmployee: KOLYA
    };
    expect(getReservationRangeBlockReason(params)).toBeNull();
    expect(getReservationRangeBlockReason({ ...params, caps: { digital: 3 } })).toBe('department');
    expect(vacationRequestCapBlockMessage('department', poolContext(), { digital: 3 })).toBe(
      'В эти даты в отделе уже отдыхает максимум сотрудников (3). Выберите другие даты или договоритесь с коллегами.'
    );
  });
});

describe('лимит брони по месяцу', () => {
  it('отпуск Маши касается ноября 1 днём → бронь Коли на ноябрь блокируется подгруппой', () => {
    expect(
      getReservationMonthBlockReason({
        context: context('digital-revzina'),
        year: 2026,
        month: 11,
        reservations: [],
        requests: [mashaApproved],
        excludeEmployee: KOLYA
      })
    ).toBe('subgroup');
  });

  it('декабрь свободен', () => {
    expect(
      getReservationMonthBlockReason({
        context: context('digital-revzina'),
        year: 2026,
        month: 12,
        reservations: [reservation(MASHA, 2026, 11)],
        requests: [mashaApproved],
        excludeEmployee: KOLYA
      })
    ).toBeNull();
  });
});

describe('monthsOverlappingIsoRange', () => {
  it('диапазон через границу месяцев и года', () => {
    expect(monthsOverlappingIsoRange('2026-12-28', '2027-01-05')).toEqual([
      { year: 2026, month: 12 },
      { year: 2027, month: 1 }
    ]);
    expect(monthsOverlappingIsoRange('2026-11-05', '2026-11-01')).toEqual([]);
  });
});

describe('правила заказчика: 1 на группу Digital, 5 на отдел, по реальным датам', () => {
  let empId = 1000;
  const emp = (name: string, department: string, managerId: number | null = null) =>
    ({ id: empId++, name, department, manager: '', manager_id: managerId, title: '' }) as unknown as Employee;

  const revzina = emp('Ревзина Ксения', 'Digital');
  const popov = emp('Попов Виктор', 'Digital', revzina.id);
  const popovTeam = ['Хакимов Олег', 'Бояринова Мария'].map((n) => emp(n, 'Digital', popov.id));
  const tskhai = emp('Цхай Виталий', 'Digital', revzina.id);
  const tskhaiTeam = ['Павлов Вячеслав', 'Кухарев Владислав', 'Потапов Данила', 'Гончарова Дарья', 'Александрова Анна'].map(
    (n) => emp(n, 'Digital', tskhai.id)
  );
  const lunin = emp('Лунин Дмитрий', 'Digital', revzina.id);
  const dev = ['Дев Один', 'Дев Два', 'Дев Три', 'Дев Четыре', 'Дев Пять', 'Дев Шесть'].map((n) => emp(n, 'DEV'));
  const sales = emp('Продажник Один', 'Отдел продаж');
  const all = [revzina, popov, ...popovTeam, tskhai, ...tskhaiTeam, lunin, ...dev, sales];

  const helpers = {
    directReports: (ref: string | number) =>
      all.filter((e) => e.manager_id === (typeof ref === 'number' ? ref : all.find((x) => x.name === ref)?.id)),
    findByName: (name: string) => all.find((e) => e.name === name),
    employeesInDepartment: (department: string) => all.filter((e) => e.department === department)
  };
  const ctxFor = (e: Employee) => {
    const resolved = resolveEmployeeReservationCapContext(e, helpers);
    if (!resolved) throw new Error(`нет контекста для ${e.name}`);
    return toEmployeeReservationCapContext(resolved);
  };

  it('не-Digital отдел (DEV): пул department:DEV из всех сотрудников отдела, без группы', () => {
    const ctx = ctxFor(dev[5]);
    expect(ctx.department.id).toBe('department:DEV');
    expect(ctx.department.memberNames).toHaveLength(6);
    expect(ctx.subgroup).toBeNull();
  });

  it('DEV: 5 человек в один день → шестой блокируется, другие дни можно', () => {
    const requests = dev.slice(0, 5).map((e) => request(e.name, '2026-05-04', '2026-05-08'));
    const base = { context: ctxFor(dev[5]), reservations: [], requests, excludeEmployee: dev[5].name };
    expect(getReservationRangeBlockReason({ ...base, start: '2026-05-08', end: '2026-05-12' })).toBe('department');
    expect(getReservationRangeBlockReason({ ...base, start: '2026-05-09', end: '2026-05-15' })).toBeNull();
    // Четверо в те же дни: не блок (лимит 5).
    expect(
      getReservationRangeBlockReason({ ...base, requests: requests.slice(0, 4), start: '2026-05-04', end: '2026-05-08' })
    ).toBeNull();
    expect(vacationRequestCapBlockMessage('department', base.context)).toBe(
      'В эти даты в отделе уже отдыхает максимум сотрудников (5). Выберите другие даты или договоритесь с коллегами.'
    );
  });

  it('DEV: двое в тех же датах можно (нет лимита группы), override пула department:DEV работает', () => {
    const requests = [request(dev[0].name, '2026-05-04', '2026-05-08'), request(dev[1].name, '2026-05-04', '2026-05-08')];
    const base = { context: ctxFor(dev[5]), start: '2026-05-05', end: '2026-05-06', reservations: [], requests, excludeEmployee: dev[5].name };
    expect(getReservationRangeBlockReason(base)).toBeNull();
    expect(getReservationRangeBlockReason({ ...base, caps: { 'department:DEV': 2 } })).toBe('department');
  });

  it('другой отдел в те же дни не влияет на DEV', () => {
    const requests = [sales, ...dev.slice(0, 4)].map((e) => request(e.name, '2026-05-04', '2026-05-08'));
    expect(
      getReservationRangeBlockReason({
        context: ctxFor(dev[5]), start: '2026-05-05', end: '2026-05-05', reservations: [], requests, excludeEmployee: dev[5].name
      })
    ).toBeNull();
  });

  it('Digital: группа Попова, один на группу в одни и те же дни; без пересечения можно', () => {
    const ctx = ctxFor(popovTeam[1]);
    expect(ctx.department.id).toBe('digital-department');
    expect(ctx.subgroup?.id).toBe('digital-popov');
    const requests = [request(popovTeam[0].name, '2026-06-01', '2026-06-10')];
    const base = { context: ctx, reservations: [], requests, excludeEmployee: popovTeam[1].name };
    expect(getReservationRangeBlockReason({ ...base, start: '2026-06-10', end: '2026-06-14' })).toBe('subgroup');
    expect(getReservationRangeBlockReason({ ...base, start: '2026-06-11', end: '2026-06-20' })).toBeNull();
    expect(vacationRequestCapBlockMessage('subgroup', ctx)).toBe(
      'В эти даты в вашей группе уже кто-то в отпуске. Выберите другие даты или договоритесь с коллегами.'
    );
  });

  it('Digital: разные группы в одни дни можно', () => {
    const requests = [request(popovTeam[0].name, '2026-06-01', '2026-06-10')];
    expect(
      getReservationRangeBlockReason({
        context: ctxFor(lunin), start: '2026-06-01', end: '2026-06-10', reservations: [], requests, excludeEmployee: lunin.name
      })
    ).toBeNull();
  });

  it('Digital: группа Цхай без лимита группы, но входит в 5 на отдел', () => {
    const ctx = ctxFor(tskhaiTeam[4]);
    expect(ctx.subgroup?.id).toBe('digital-tskhai');
    // 4 человека из группы Цхая в одни дни: пятому можно (лимит группы не действует, в отделе 4).
    const four = tskhaiTeam.slice(0, 4).map((e) => request(e.name, '2026-07-06', '2026-07-17'));
    const base = { context: ctx, start: '2026-07-10', end: '2026-07-12', reservations: [], excludeEmployee: tskhaiTeam[4].name };
    expect(getReservationRangeBlockReason({ ...base, requests: four })).toBeNull();
    // + один из группы Попова в те же дни = 5 в отделе → блок отдела.
    expect(
      getReservationRangeBlockReason({ ...base, requests: [...four, request(popovTeam[0].name, '2026-07-12', '2026-07-12')] })
    ).toBe('department');
    // Тот же человек Попова, но на другие дни: можно.
    expect(
      getReservationRangeBlockReason({ ...base, requests: [...four, request(popovTeam[0].name, '2026-07-13', '2026-07-14')] })
    ).toBeNull();
  });

  it('сотрудник Digital вне групп: только лимит отдела', () => {
    const outsider = emp('Новый Сотрудник', 'Digital');
    all.push(outsider);
    const ctx = ctxFor(outsider);
    expect(ctx.department.id).toBe('digital-department');
    expect(ctx.subgroup).toBeNull();
    all.pop();
  });

  it('сотрудник без отдела: лимитов нет', () => {
    expect(resolveEmployeeReservationCapContext(emp('Без Отдела', ''), helpers)).toBeNull();
  });
});
