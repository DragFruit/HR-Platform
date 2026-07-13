import {
  resolveVacationTeamScope,
  vacationTeamScopeToDepartments,
  type VacationTeamScope
} from '~/utils/vacationTeamScope';

const SCOPE_STORAGE_KEY = 'vbi-employee-vac-calendar-scope-v1';

export type EmployeeCalendarScope = 'mine' | 'team';

const readStoredScope = (): EmployeeCalendarScope => {
  if (!import.meta.client) return 'mine';
  const raw = localStorage.getItem(SCOPE_STORAGE_KEY);
  return raw === 'team' ? 'team' : 'mine';
};

const writeStoredScope = (scope: EmployeeCalendarScope) => {
  if (!import.meta.client) return;
  localStorage.setItem(SCOPE_STORAGE_KEY, scope);
};

export function useEmployeeVacationTeamView() {
  const { user } = useAuth();
  const {
    employees,
    findByUserForAuth,
    employeesInDepartment,
    directReports,
    findByName
  } = useEmployees();

  const currentEmployee = computed(() => findByUserForAuth(user.value));

  const teamScope = computed((): VacationTeamScope | null =>
    resolveVacationTeamScope(currentEmployee.value, employees.value, {
      employeesInDepartment,
      directReports,
      findByName
    })
  );

  const hasTeamCalendar = computed(() => Boolean(teamScope.value));

  const teamDepartments = computed(() => {
    const scope = teamScope.value;
    if (!scope) return [];
    return vacationTeamScopeToDepartments(scope, {
      allEmployees: employees.value,
      directReports,
      findByName
    });
  });

  const calendarScope = useState<EmployeeCalendarScope>('emp-vac-calendar-scope', readStoredScope);

  const setCalendarScope = (scope: EmployeeCalendarScope) => {
    if (scope === 'team' && !hasTeamCalendar.value) {
      calendarScope.value = 'mine';
      writeStoredScope('mine');
      return;
    }
    calendarScope.value = scope;
    writeStoredScope(scope);
  };

  watch(hasTeamCalendar, (available) => {
    if (!available && calendarScope.value === 'team') {
      calendarScope.value = 'mine';
      writeStoredScope('mine');
    }
  });

  return {
    currentEmployee,
    teamScope,
    hasTeamCalendar,
    teamDepartments,
    calendarScope,
    setCalendarScope
  };
}
