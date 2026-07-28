export type LaunchScope = 'full' | 'vacations';

export const LAUNCH_VACATIONS_EMPLOYEE_PATH = '/vacations';
export const LAUNCH_VACATIONS_NOTIFICATIONS_PATH = '/notifications';
export const LAUNCH_VACATIONS_ADMIN_PATH = '/admin/vacations';
export const LAUNCH_VACATIONS_ADMIN_EMPLOYEES_PATH = '/admin/employees';
export const LAUNCH_VACATIONS_ADMIN_NOTIFICATIONS_PATH = '/admin/notifications';

export function useLaunchScope() {
  const config = useRuntimeConfig();

  const launchScope = computed<LaunchScope>(() => {
    const raw = config.public.launchScope;
    if (raw === 'vacations') return 'vacations';
    // На бое всегда пилот «только отпуска» — остальное с замком, даже если в конфиге full
    if (config.public.appEnv === 'production') return 'vacations';
    if (raw === 'full') return 'full';
    return 'full';
  });

  const isVacationsOnly = computed(() => launchScope.value === 'vacations');

  const isPathAllowed = (path: string) => {
    if (!isVacationsOnly.value) return true;
    if (path === LAUNCH_VACATIONS_EMPLOYEE_PATH || path.startsWith(`${LAUNCH_VACATIONS_EMPLOYEE_PATH}/`)) {
      return true;
    }
    if (
      path === LAUNCH_VACATIONS_NOTIFICATIONS_PATH ||
      path.startsWith(`${LAUNCH_VACATIONS_NOTIFICATIONS_PATH}/`)
    ) {
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
    if (
      path === LAUNCH_VACATIONS_ADMIN_NOTIFICATIONS_PATH ||
      path.startsWith(`${LAUNCH_VACATIONS_ADMIN_NOTIFICATIONS_PATH}/`)
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

  const isNavPathUnlocked = (path: string) => isPathAllowed(path);

  return {
    launchScope,
    isVacationsOnly,
    isPathAllowed,
    isNavPathUnlocked,
    homePath
  };
}
