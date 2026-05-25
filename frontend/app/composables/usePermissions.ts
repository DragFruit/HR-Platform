import type { AuthSessionUser } from '~/composables/useAuth';

export type PlatformRole = AuthSessionUser['role'];

export const roleLabels: Record<PlatformRole, string> = {
  admin: 'Редактор системы',
  employee: 'Сотрудник',
  manager: 'Руководитель',
  hr: 'HR'
};

export const roleDescriptions: Record<PlatformRole, string> = {
  admin: 'Полный доступ: админ-панель, справочники, все согласования',
  employee: 'Календарь, свои заявки на отпуск',
  manager: 'Согласование заявок подчинённых, календарь команды',
  hr: 'Как руководитель + кадровые настройки отпусков'
};

export function usePermissions() {
  const { user } = useAuth();

  const role = computed(() => user.value?.role ?? null);
  const roleLabel = computed(() => (role.value ? roleLabels[role.value] : ''));

  const isAdmin = computed(() => role.value === 'admin');
  const isManager = computed(() => role.value === 'manager');
  const isEmployee = computed(() => role.value === 'employee');
  const isHr = computed(() => role.value === 'hr');

  const canAccessAdmin = computed(() => isAdmin.value);
  const canEditEmployees = computed(() => isAdmin.value || isHr.value);
  const canApproveVacations = computed(() => isAdmin.value || isManager.value || isHr.value);
  const canSeeAllVacationApprovals = computed(() => isAdmin.value || isHr.value);

  return {
    role,
    roleLabel,
    roleDescriptions,
    isAdmin,
    isManager,
    isEmployee,
    isHr,
    canAccessAdmin,
    canEditEmployees,
    canApproveVacations,
    canSeeAllVacationApprovals
  };
}
