import { describe, expect, it } from 'vitest';
import {
  absenceLoadLevel,
  countOverlapPeople,
  dailyAbsences,
  findRequestOverlaps,
  rangesOverlapInclusive,
  resolveOverlapScope,
  type OverlapRequestLike
} from '~/utils/vacationOverlaps';

const req = (
  id: number,
  employee: string,
  start: string,
  end: string,
  status = 'approved',
  employee_id?: number
): OverlapRequestLike => ({ id, employee, start, end, status, employee_id });

const employees = [
  { name: 'Иванов Иван Иванович', department: 'Продажи' },
  { name: 'Петров Пётр Петрович', department: 'Продажи' },
  { name: 'Сидорова Анна Сергеевна', department: 'Продажи' },
  { name: 'Кузнецов Олег Павлович', department: 'Маркетинг' }
];

describe('rangesOverlapInclusive', () => {
  it('общий граничный день считается пересечением', () => {
    expect(rangesOverlapInclusive('2026-07-01', '2026-07-10', '2026-07-10', '2026-07-20')).toBe(true);
    expect(rangesOverlapInclusive('2026-07-01', '2026-07-10', '2026-07-11', '2026-07-20')).toBe(false);
  });
  it('перевёрнутые диапазоны нормализуются', () => {
    expect(rangesOverlapInclusive('2026-07-10', '2026-07-01', '2026-07-05', '2026-07-05')).toBe(true);
  });
});

describe('findRequestOverlaps', () => {
  const target = req(1, 'Иванов Иван Иванович', '2026-07-06', '2026-07-19', 'pending', 11);

  it('учитывает approved и pending, игнорирует rejected/cancelled', () => {
    const all = [
      target,
      req(2, 'Петров Пётр Петрович', '2026-07-01', '2026-07-06', 'approved', 12),
      req(3, 'Сидорова Анна Сергеевна', '2026-07-15', '2026-07-30', 'pending', 13),
      req(4, 'Петров Пётр Петрович', '2026-07-10', '2026-07-12', 'rejected', 12),
      req(5, 'Сидорова Анна Сергеевна', '2026-07-08', '2026-07-09', 'cancelled', 13)
    ];
    const res = findRequestOverlaps(target, all);
    expect(res.map((r) => r.id)).toEqual([2, 3]);
    expect(res[0]).toMatchObject({ status: 'approved', overlapStart: '2026-07-06', overlapEnd: '2026-07-06' });
    expect(res[1]).toMatchObject({ status: 'pending', overlapStart: '2026-07-15', overlapEnd: '2026-07-19' });
  });

  it('исключает саму заявку и другие заявки того же сотрудника', () => {
    const all = [
      target,
      req(6, 'Иванов Иван Иванович', '2026-07-10', '2026-07-12', 'approved', 11),
      req(7, 'Иванов Иван', '2026-07-10', '2026-07-12', 'approved')
    ];
    expect(findRequestOverlaps(target, all)).toEqual([]);
  });

  it('id заявки не путается с id сотрудника', () => {
    const legacy = req(12, 'Иванов Иван Иванович', '2026-07-06', '2026-07-19', 'pending');
    const other = req(30, 'Петров Пётр Петрович', '2026-07-07', '2026-07-07', 'approved', 12);
    expect(findRequestOverlaps(legacy, [legacy, other]).map((r) => r.id)).toEqual([30]);
  });

  it('фильтрует по кругу людей (отдел)', () => {
    const all = [
      target,
      req(2, 'Петров Пётр Петрович', '2026-07-10', '2026-07-11', 'approved', 12),
      req(8, 'Кузнецов Олег Павлович', '2026-07-10', '2026-07-11', 'approved', 14)
    ];
    const scope = resolveOverlapScope({
      mode: 'requester-department',
      requesterName: target.employee,
      employees
    });
    expect(scope).not.toContain('Кузнецов Олег Павлович');
    expect(findRequestOverlaps(target, all, scope).map((r) => r.employee)).toEqual([
      'Петров Пётр Петрович'
    ]);
    // Без фильтра видно обоих.
    expect(findRequestOverlaps(target, all)).toHaveLength(2);
  });

  it('countOverlapPeople считает людей, а не заявки', () => {
    const all = [
      target,
      req(2, 'Петров Пётр Петрович', '2026-07-06', '2026-07-07', 'approved', 12),
      req(9, 'Петров Пётр Петрович', '2026-07-15', '2026-07-16', 'pending', 12)
    ];
    expect(countOverlapPeople(findRequestOverlaps(target, all))).toBe(1);
  });
});

describe('resolveOverlapScope', () => {
  it('руководитель: имена команды как есть', () => {
    expect(resolveOverlapScope({ mode: 'team', teamNames: ['A', 'B'] })).toEqual(['A', 'B']);
  });
  it('админ: отдел заявителя; неизвестный заявитель = без фильтра', () => {
    expect(
      resolveOverlapScope({ mode: 'requester-department', requesterName: 'Кузнецов Олег', employees })
    ).toEqual(['Кузнецов Олег Павлович']);
    expect(
      resolveOverlapScope({ mode: 'requester-department', requesterName: 'Нет Такого', employees })
    ).toBeNull();
  });
});

describe('dailyAbsences / absenceLoadLevel', () => {
  it('считает людей по дням, один человек в день один раз, approved важнее', () => {
    const all = [
      req(1, 'Иванов Иван Иванович', '2026-07-01', '2026-07-03', 'pending'),
      req(2, 'Иванов Иван Иванович', '2026-07-03', '2026-07-04', 'approved'),
      req(3, 'Петров Пётр Петрович', '2026-07-03', '2026-07-03', 'approved'),
      req(4, 'Кузнецов Олег Павлович', '2026-07-03', '2026-07-03', 'rejected')
    ];
    const map = dailyAbsences(all, '2026-07-01', '2026-07-05');
    expect(map.get('2026-07-01')).toEqual([{ employee: 'Иванов Иван Иванович', status: 'pending' }]);
    expect(map.get('2026-07-03')).toEqual([
      { employee: 'Иванов Иван Иванович', status: 'approved' },
      { employee: 'Петров Пётр Петрович', status: 'approved' }
    ]);
    expect(map.get('2026-07-05')).toEqual([]);
    const scoped = dailyAbsences(all, '2026-07-01', '2026-07-05', ['Петров Пётр Петрович']);
    expect(scoped.get('2026-07-01')).toEqual([]);
    expect(scoped.get('2026-07-03')).toHaveLength(1);
  });

  it('переход через месяц/год и уровни 0/1/2/3+', () => {
    const map = dailyAbsences([req(1, 'A', '2026-12-30', '2027-01-02')], '2026-12-29', '2027-01-03');
    expect([...map.keys()]).toHaveLength(6);
    expect(map.get('2027-01-01')).toHaveLength(1);
    expect([0, 1, 2, 3, 7].map(absenceLoadLevel)).toEqual([0, 1, 2, 3, 3]);
  });
});
