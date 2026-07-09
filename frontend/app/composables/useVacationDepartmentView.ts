import {
  departmentVacationViewScope,
  isDepartmentVacationViewer
} from '~/utils/vacationDepartmentView';
import { enrichTeamMembers } from '~/utils/vacationTeamScope';

export function useVacationDepartmentView() {
  const { user } = useAuth();
  const { managerProfileName, employeesInDepartment, findByName, findByUserForAuth } = useEmployees();

  const profileName = computed(() => managerProfileName(user.value));

  const viewDepartment = computed(() => departmentVacationViewScope(profileName.value));

  const isViewer = computed(() => isDepartmentVacationViewer(profileName.value));

  const departmentTeam = computed(() => {
    const dept = viewDepartment.value;
    if (!dept) return [];
    return enrichTeamMembers(
      employeesInDepartment(dept),
      findByName,
      findByUserForAuth(user.value)
    );
  });

  return {
    profileName,
    viewDepartment,
    isViewer,
    departmentTeam
  };
}
