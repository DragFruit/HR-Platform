import type { Employee } from '~/composables/useEmployees';

/**
 * Публичная визитка сотрудника (поповер, не страница).
 * Открытие: openEmployeeVisitingCard(employee | name).
 */
export function useEmployeeVisitingCard() {
  const openEmployeeId = useState<number | null>('employee-visiting-card-id', () => null);

  const isOpen = computed(() => openEmployeeId.value != null);

  const openEmployeeVisitingCard = (employee: Employee | number | string) => {
    if (typeof employee === 'number') {
      openEmployeeId.value = employee;
      return;
    }
    if (typeof employee === 'string') {
      const { findByName } = useEmployees();
      const found = findByName(employee);
      openEmployeeId.value = found?.id ?? null;
      return;
    }
    openEmployeeId.value = employee.id;
  };

  const closeEmployeeVisitingCard = () => {
    openEmployeeId.value = null;
  };

  return {
    openEmployeeId,
    isOpen,
    openEmployeeVisitingCard,
    closeEmployeeVisitingCard
  };
}
