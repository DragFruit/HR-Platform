import {
  isDaySelectable,
  isRangeFullySelectable,
  normalizeRange,
  todayIso,
  type CalendarDayCell
} from '~/utils/vacationCalendar';

export function useVacationRangePick(options: {
  blockedDays: Ref<Set<string>>;
  onRangeSelected: (start: string, end: string) => void;
}) {
  const minIso = todayIso();
  const rangePickStart = ref<string | null>(null);
  const rangePickHover = ref<string | null>(null);

  const isSelecting = computed(() => rangePickStart.value !== null);

  const clearSelection = () => {
    rangePickStart.value = null;
    rangePickHover.value = null;
  };

  const handleDayClick = (cell: CalendarDayCell) => {
    if (!isDaySelectable(cell, minIso)) return;

    if (!rangePickStart.value) {
      rangePickStart.value = cell.iso;
      rangePickHover.value = null;
      return;
    }

    const start = rangePickStart.value;
    const end = cell.iso;
    const [lo, hi] = normalizeRange(start, end);

    if (!isRangeFullySelectable(lo, hi, minIso, options.blockedDays.value)) {
      rangePickHover.value = null;
      return;
    }

    options.onRangeSelected(lo, hi);
    clearSelection();
  };

  const handleDayHover = (cell: CalendarDayCell) => {
    if (!rangePickStart.value) return;
    if (!isDaySelectable(cell, minIso)) return;
    rangePickHover.value = cell.iso;
  };

  const handleDocumentClick = (event: MouseEvent) => {
    if (!rangePickStart.value) return;
    const target = event.target as Element | null;
    if (target?.closest('.hr-month-grid td:not(.empty)')) return;
    clearSelection();
  };

  onMounted(() => {
    document.addEventListener('click', handleDocumentClick);
  });

  onUnmounted(() => {
    document.removeEventListener('click', handleDocumentClick);
  });

  return {
    rangePickStart,
    rangePickHover,
    isSelecting,
    minIso,
    clearSelection,
    handleDayClick,
    handleDayHover
  };
}
