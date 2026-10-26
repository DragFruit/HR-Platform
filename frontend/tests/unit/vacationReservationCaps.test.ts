import { describe, expect, it } from 'vitest';
import {
  getReservationMonthBlockReason,
  getReservationRangeBlockReason,
  monthsOverlappingIsoRange,
  vacationRequestCapBlockMessage,
  type EmployeeReservationCapContext
} from '../../app/utils/vacationReservationCaps';
import type { VacationReservation } from '../../app/utils/vacationReservations';
import type { VacationRequest } from '../../app/composables/useVacations';

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
