import { readEmployees, writeEmployees } from './employeesStore';
import { mutateVacations, readVacationsWithServiceFields } from './vacationsStore';
import type { VacationRolloverDeps } from './vacationYearRollover';

/** Боевые зависимости перехода года: хранилище отпусков (JSON или Postgres) и справочник сотрудников. */
export const vacationRolloverDeps = (): VacationRolloverDeps => ({
  mutate: mutateVacations,
  readVacations: readVacationsWithServiceFields,
  readEmployees,
  applyOpeningBalances: async (balances, ctx) => {
    const employees = await readEmployees();
    let changed = 0;
    const next = employees.map((emp) => {
      const value = balances[String(emp.id)];
      if (value === undefined || emp.vacation_opening_balance === value) return emp;
      changed += 1;
      return { ...emp, vacation_opening_balance: value };
    });
    if (changed) {
      await writeEmployees(next, {
        actorEmployeeId: ctx.actorEmployeeId ?? null,
        reason: ctx.reason,
        preserveManagers: true
      });
    }
    return changed;
  }
});
