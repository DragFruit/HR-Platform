export type LaunchScope = 'full' | 'vacations';

export const LAUNCH_VACATIONS_EMPLOYEE_PATH = '/vacations';
export const LAUNCH_VACATIONS_ADMIN_PATH = '/admin/vacations';
export const LAUNCH_VACATIONS_ADMIN_EMPLOYEES_PATH = '/admin/employees';

const VACATIONS_ONLY_ADMIN_PATHS = [
  LAUNCH_VACATIONS_ADMIN_PATH,
  LAUNCH_VACATIONS_ADMIN_EMPLOYEES_PATH
] as const;

export function useLaunchScope() {
  const config = useRuntimeConfig();

  const launchScope = computed<LaunchScope>(() => {
    const raw = config.public.launchScope;
    return raw === 'vacations' ? 'vacations' : 'full';
  });

  const isVacationsOnly = computed(() => launchScope.value === 'vacations');

  const isPathAllowed = (path: string) => {
    if (!isVacationsOnly.value) return true;
    if (path === LAUNCH_VACATIONS_EMPLOYEE_PATH || path.startsWith(`${LAUNCH_VACATIONS_EMPLOYEE_PATH}/`)) {
      return true;
    }
    if (path === LAUNCH_VACATIONS_ADMIN_PATH || path.startsWith(`${LAUNCH_VACATIONS_ADMIN_PATH}/`)) {
      return true;
    }
    if (
      path === LAUNCH_VACATIONS_ADMIN_EMPLOYEES_PATH ||
      path.startsWith(`${LAUNCH_VACATIONS_ADMIN_EMPLOYEES_PATH}/`)
    ) {
      return true;
    }
    return false;
  };

  const homePath = (platformAdmin: boolean) => {
    if (isVacationsOnly.value) {
      return platformAdmin ? LAUNCH_VACATIONS_ADMIN_PATH : LAUNCH_VACATIONS_EMPLOYEE_PATH;
    }
    return platformAdmin ? '/admin' : '/';
  };

  const vacationsEmployeeNav = [{ to: LAUNCH_VACATIONS_EMPLOYEE_PATH, label: 'График отпусков' }];

  const vacationsAdminNav = [
    { to: LAUNCH_VACATIONS_ADMIN_PATH, label: 'График отпусков' },
    { to: LAUNCH_VACATIONS_ADMIN_EMPLOYEES_PATH, label: 'Сотрудники' }
  ];

  const filterNavItems = <T extends { to: string }>(items: T[]) => {
    if (!isVacationsOnly.value) return items;
    return items.filter(
      (item) =>
        item.to === LAUNCH_VACATIONS_EMPLOYEE_PATH ||
        VACATIONS_ONLY_ADMIN_PATHS.includes(item.to as (typeof VACATIONS_ONLY_ADMIN_PATHS)[number])
    );
  };

  const navForLaunchScope = (platformAdmin: boolean) =>
    platformAdmin ? vacationsAdminNav : vacationsEmployeeNav;

  return {
    launchScope,
    isVacationsOnly,
    isPathAllowed,
    homePath,
    filterNavItems,
    navForLaunchScope,
    vacationsAdminNav,
    vacationsEmployeeNav
  };
}
