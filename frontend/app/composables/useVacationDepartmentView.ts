import {
  departmentVacationViewScope,
  isDepartmentVacationViewer
} from '~/utils/vacationDepartmentView';

export function useVacationDepartmentView() {
  const { user } = useAuth();
  const { managerProfileName, employeesInDepartment } = useEmployees();

  const profileName = computed(() => managerProfileName(user.value));

  const viewDepartment = computed(() => departmentVacationViewScope(profileName.value));

  const isViewer = computed(() => isDepartmentVacationViewer(profileName.value));

  const departmentTeam = computed(() => {
    const dept = viewDepartment.value;
    if (!dept) return [];
    return employeesInDepartment(dept);
  });

  return {
    profileName,
    viewDepartment,
    isViewer,
    departmentTeam
  };
}
