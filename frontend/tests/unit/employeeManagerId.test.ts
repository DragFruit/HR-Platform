import { describe, expect, it } from 'vitest';
import { ensureEmployeeManagerIds } from '../../app/utils/employeeManagerRef';
import { departmentScopeForManager } from '../../app/utils/departmentTeamScope';
import { employeeNamesMatch } from '../../app/utils/employeeName';
import {
  isVacationDepartmentDirector,
  resolveManagerCalendarDepartments
} from '../../app/utils/vacationDepartmentGroups';
import type { Employee } from '../../app/composables/useEmployees';

const emp = (
  partial: Partial<Employee> & Pick<Employee, 'id' | 'name' | 'department' | 'manager'>
): Employee => ({
  title: '',
  hired_at: '2020-01-01',
  platform_user_id: null,
  email: '',
  account_role: '',
  legal_entity: '',
  contract_form: '',
  ...partial
});

describe('manager_id hierarchy', () => {
  it('fills manager_id from ФИО even when director has patronymic', () => {
    const list = ensureEmployeeManagerIds([
      emp({
        id: 848,
        name: 'Ревзина Ксения Игоревна',
        department: 'Digital',
        manager: 'Юдин Вадим'
      }),
      emp({
        id: 1,
        name: 'Юдин Вадим',
        department: 'Дирекция',
        manager: ''
      }),
      emp({
        id: 2730,
        name: 'Попов Виктор Сергеевич',
        department: 'Digital',
        manager: 'Ревзина Ксения'
      }),
      emp({
        id: 2216,
        name: 'Хакимов Олег',
        department: 'Digital',
        manager: 'Попов Виктор'
      })
    ]);

    const revzina = list.find((row) => row.id === 848)!;
    const popov = list.find((row) => row.id === 2730)!;
    const khakimov = list.find((row) => row.id === 2216)!;

    expect(popov.manager_id).toBe(848);
    expect(khakimov.manager_id).toBe(2730);
    expect(departmentScopeForManager(revzina, list)).toBe('Digital');
    expect(
      isVacationDepartmentDirector(revzina, 'Digital', (name) =>
        list.find((e) => employeeNamesMatch(e.name, name))
      )
    ).toBe(true);
  });

  it('calendar for Digital director returns groups by manager_id chain', () => {
    const list = ensureEmployeeManagerIds([
      emp({
        id: 848,
        name: 'Ревзина Ксения Игоревна',
        department: 'Digital',
        manager: 'Юдин Вадим'
      }),
      emp({ id: 1, name: 'Юдин Вадим', department: 'Дирекция', manager: '' }),
      emp({
        id: 1284,
        name: 'Жукова Юлия Рафиковна',
        department: 'Digital',
        manager: 'Ревзина Ксения'
      }),
      emp({
        id: 2730,
        name: 'Попов Виктор Сергеевич',
        department: 'Digital',
        manager: 'Ревзина Ксения'
      }),
      emp({
        id: 2216,
        name: 'Хакимов Олег',
        department: 'Digital',
        manager: 'Попов Виктор'
      })
    ]);

    const findByName = (name: string) => list.find((row) => employeeNamesMatch(row.name, name));

    const deps = resolveManagerCalendarDepartments(list.find((e) => e.id === 848)!, list, {
      findByName,
      directReports: (ref) => {
        const id = typeof ref === 'number' ? ref : findByName(ref)?.id;
        return list.filter((e) => e.manager_id === id);
      }
    });

    const allIds = deps.flatMap((d) => d.employees.map((e) => e.id));
    expect(allIds).toContain(848);
    expect(allIds).toContain(1284);
    expect(allIds).toContain(2730);
    expect(allIds).toContain(2216);
  });
});
