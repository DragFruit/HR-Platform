import { describe, expect, it } from 'vitest';
import {
  getReservationMonthBlockReason,
  getReservationRangeBlockReason,
  monthsOverlappingIsoRange,
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
