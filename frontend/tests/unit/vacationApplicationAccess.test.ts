import { describe, expect, it } from 'vitest';
import {
  canViewVacationApplication,
  isVacationApplicationStatusAllowed,
  vacationApplicationDenyReason
} from '../../app/utils/vacationApplicationAccess';

const base = { start: '2026-11-10', today: '2026-10-20', contractForm: 'ТД' };

describe('vacationApplicationDenyReason', () => {
  it('pending (сразу после создания) — можно скачать', () => {
    expect(vacationApplicationDenyReason({ ...base, status: 'pending' })).toBeNull();
  });
  it('approved — можно скачать', () => {
    expect(vacationApplicationDenyReason({ ...base, status: 'approved' })).toBeNull();
  });
  it('rejected и неизвестный статус — нельзя', () => {
    expect(vacationApplicationDenyReason({ ...base, status: 'rejected' })).not.toBeNull();
    expect(vacationApplicationDenyReason({ ...base, status: undefined })).not.toBeNull();
    expect(isVacationApplicationStatusAllowed('cancelled')).toBe(false);
  });
  it('в день старта и после — нельзя', () => {
    expect(vacationApplicationDenyReason({ ...base, status: 'pending', start: '2026-10-20' })).not.toBeNull();
    expect(vacationApplicationDenyReason({ ...base, status: 'approved', start: '2026-10-01' })).not.toBeNull();
  });
  it('СЗ и пустая форма договора — нельзя', () => {
    expect(vacationApplicationDenyReason({ ...base, status: 'pending', contractForm: 'СЗ' })).not.toBeNull();
    expect(vacationApplicationDenyReason({ ...base, status: 'pending', contractForm: null })).not.toBeNull();
  });
});

describe('canViewVacationApplication', () => {
  const request = { employee: 'Иванова Мария', employee_id: 'emp-1' };
  it('владелец по id и по имени', () => {
    expect(canViewVacationApplication({ role: 'employee', employeeId: 'emp-1' }, request)).toBe(true);
    expect(canViewVacationApplication({ role: 'employee', employeeName: 'Иванова Мария' }, { employee: 'Иванова Мария' })).toBe(true);
  });
  it('HR и admin — да', () => {
    expect(canViewVacationApplication({ role: 'hr' }, request)).toBe(true);
    expect(canViewVacationApplication({ role: 'admin' }, request)).toBe(true);
  });
  it('чужой сотрудник — нет', () => {
    expect(
      canViewVacationApplication({ role: 'employee', employeeId: 'emp-2', employeeName: 'Петров Николай' }, request)
    ).toBe(false);
    expect(canViewVacationApplication({ role: 'employee' }, request)).toBe(false);
  });
});
