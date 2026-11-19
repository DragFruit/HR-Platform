import {
  trimVacationHolidayEdges,
  VACATION_ONLY_HOLIDAYS_MESSAGE,
  vacationHolidayEdgeHint
} from '~/utils/vacationCalendar';

/**
 * Форма дат отпуска: праздники на краях периода сразу отрезаем (как сервер при сохранении)
 * и показываем подсказку «31.12 праздничный день, в отпуск не входит».
 */
export const useVacationHolidayEdgeTrim = (form: { start: string; end: string }) => {
  const removed = ref<string[]>([]);
  const onlyHolidays = ref(false);
  let skipNext = false;

  watch(
    () => [form.start, form.end] as const,
    ([start, end]) => {
      if (skipNext) {
        skipNext = false;
        return;
      }
      removed.value = [];
      onlyHolidays.value = false;
      if (!start || !end || end < start) return;
      const trimmed = trimVacationHolidayEdges(start, end);
      if (trimmed.empty) {
        onlyHolidays.value = true;
        return;
      }
      if (!trimmed.removed.length) return;
      removed.value = trimmed.removed;
      skipNext = true;
      form.start = trimmed.start;
      form.end = trimmed.end;
    },
    { immediate: true }
  );

  const holidayEdgeHint = computed(() =>
    onlyHolidays.value ? VACATION_ONLY_HOLIDAYS_MESSAGE : vacationHolidayEdgeHint(removed.value)
  );

  return { holidayEdgeHint, onlyHolidays };
};
