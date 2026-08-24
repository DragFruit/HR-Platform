import { isProductionBrowserHost } from '~/utils/productionHost';

export type LaunchScope = 'full' | 'vacations';

export const LAUNCH_VACATIONS_EMPLOYEE_PATH = '/vacations';
export const LAUNCH_VACATIONS_NOTIFICATIONS_PATH = '/notifications';
export const LAUNCH_VACATIONS_PROFILE_PATH = '/profile';
export const LAUNCH_VACATIONS_IDEAS_PATH = '/ideas';
export const LAUNCH_VACATIONS_KNOWLEDGE_PATH = '/knowledge';
export const LAUNCH_VACATIONS_VPN_PATH = '/vpn';
export const LAUNCH_VACATIONS_ADMIN_PATH = '/admin/vacations';
export const LAUNCH_VACATIONS_ADMIN_HOW_IT_LOOKS_PATH = '/admin/how-it-looks';
export const LAUNCH_VACATIONS_ADMIN_EMPLOYEES_PATH = '/admin/employees';
export const LAUNCH_VACATIONS_ADMIN_NOTIFICATIONS_PATH = '/admin/notifications';
export const LAUNCH_VACATIONS_ADMIN_IDEAS_PATH = '/admin/ideas';
export const LAUNCH_VACATIONS_ADMIN_KNOWLEDGE_PATH = '/admin/knowledge';
export const LAUNCH_VACATIONS_ADMIN_ORGANIZATION_PATH = '/admin/organization';
export const LAUNCH_VACATIONS_EMPLOYEE_ORGANIZATION_PATH = '/organization';

export function useLaunchScope() {
  const config = useRuntimeConfig();
  const url = useRequestURL();

  const launchScope = computed<LaunchScope>(() => {
    // Бой :80 — всегда пилот «только отпуска», даже если в бандле full/development
    if (isProductionBrowserHost(url.hostname, url.port)) return 'vacations';
    const raw = config.public.launchScope;
    if (raw === 'vacations') return 'vacations';
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
    if (
      path === LAUNCH_VACATIONS_PROFILE_PATH ||
      path.startsWith(`${LAUNCH_VACATIONS_PROFILE_PATH}/`)
    ) {
      return true;
    }
    if (path === LAUNCH_VACATIONS_IDEAS_PATH || path.startsWith(`${LAUNCH_VACATIONS_IDEAS_PATH}/`)) {
      return true;
    }
    if (
      path === LAUNCH_VACATIONS_KNOWLEDGE_PATH ||
      path.startsWith(`${LAUNCH_VACATIONS_KNOWLEDGE_PATH}/`)
    ) {
      return true;
    }
    if (path === LAUNCH_VACATIONS_VPN_PATH || path.startsWith(`${LAUNCH_VACATIONS_VPN_PATH}/`)) {
      return true;
    }
    if (path === LAUNCH_VACATIONS_ADMIN_PATH || path.startsWith(`${LAUNCH_VACATIONS_ADMIN_PATH}/`)) {
      return true;
    }
    // /admin/how-it-looks — с замком на бое (превью закрыто после выката рук-ам)
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
    if (
      path === LAUNCH_VACATIONS_ADMIN_IDEAS_PATH ||
      path.startsWith(`${LAUNCH_VACATIONS_ADMIN_IDEAS_PATH}/`)
    ) {
      return true;
    }
    if (
      path === LAUNCH_VACATIONS_ADMIN_KNOWLEDGE_PATH ||
      path.startsWith(`${LAUNCH_VACATIONS_ADMIN_KNOWLEDGE_PATH}/`)
    ) {
      return true;
    }
    if (
      path === LAUNCH_VACATIONS_ADMIN_ORGANIZATION_PATH ||
      path.startsWith(`${LAUNCH_VACATIONS_ADMIN_ORGANIZATION_PATH}/`)
    ) {
      return true;
    }
    if (
      path === LAUNCH_VACATIONS_EMPLOYEE_ORGANIZATION_PATH ||
      path.startsWith(`${LAUNCH_VACATIONS_EMPLOYEE_ORGANIZATION_PATH}/`)
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
