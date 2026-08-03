import type { Employee } from '~/composables/useEmployees';

export type VisitingCardAnchor = { x: number; y: number };

/**
 * Публичная визитка сотрудника (поповер у клика, без затемнения).
 * Точки входа: календарь, профиль «Твоя команда», банк идей; структура — позже.
 */
export function useEmployeeVisitingCard() {
  const openEmployeeId = useState<number | null>('employee-visiting-card-id', () => null);
  const anchor = useState<VisitingCardAnchor | null>('employee-visiting-card-anchor', () => null);

  const isOpen = computed(() => openEmployeeId.value != null);

  const resolveId = (employee: Employee | number | string): number | null => {
    if (typeof employee === 'number') return employee;
    if (typeof employee === 'string') {
      const { findByName } = useEmployees();
      return findByName(employee)?.id ?? null;
    }
    return employee.id;
  };

  const openEmployeeVisitingCard = (
    employee: Employee | number | string,
    event?: MouseEvent | VisitingCardAnchor | null
  ) => {
    const id = resolveId(employee);
    if (id == null) return;

    let nextAnchor: VisitingCardAnchor | null = null;
    if (event && 'clientX' in event && typeof event.clientX === 'number') {
      nextAnchor = { x: event.clientX, y: event.clientY };
    } else if (event && 'x' in event && typeof event.x === 'number') {
      nextAnchor = { x: event.x, y: event.y };
    }

    openEmployeeId.value = id;
    anchor.value = nextAnchor;
  };

  const closeEmployeeVisitingCard = () => {
    openEmployeeId.value = null;
    anchor.value = null;
  };

  return {
    openEmployeeId,
    anchor,
    isOpen,
    openEmployeeVisitingCard,
    closeEmployeeVisitingCard
  };
}
