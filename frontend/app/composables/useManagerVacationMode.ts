export type ManagerVacationUiMode = 'manager' | 'employee';

/** Режим отпусков руководителя: календарь команды + согласования или личный экран сотрудника. */
export const useManagerVacationMode = () =>
  useState<ManagerVacationUiMode>('vac-manager-ui-mode', () => 'manager');
