<template>
  <div
    class="emp-cal-grid"
    :class="{ 'emp-cal-grid--compact': compact, 'emp-cal-grid--selecting': isSelecting }"
    role="img"
    :aria-label="`Календарь отпусков за ${year} год`"
  >
    <div v-for="month in months" :key="month.index" class="emp-cal-month hr-month">
      <div class="hr-month-title">{{ month.title }}</div>
      <table class="hr-month-grid">
        <thead v-if="!compact">
          <tr>
            <th v-for="weekday in weekdays" :key="weekday">{{ weekday }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, rowIndex) in month.rows" :key="rowIndex">
            <td
              v-for="(cell, cellIndex) in row"
              :key="cellIndex"
              :class="cellClass(cell)"
              :title="cellTitle(cell)"
              @click.stop="onCellClick(cell)"
              @mouseenter="onCellHover(cell)"
            >
              <span v-if="!cell.empty" class="hr-day-num">{{ cell.day }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  MONTHS_RU,
  WEEKDAYS_SHORT,
  buildDaySetsForEmployee,
  buildMonthGrid,
  isDaySelectable,
  isIsoInRange,
  rangePreviewSegmentClass,
  type CalendarDayCell
} from '~/utils/vacationCalendar';
import type { VacationRequest } from '~/composables/useVacations';

const props = defineProps<{
  employeeName: string;
  year: number;
  requests: VacationRequest[];
  compact?: boolean;
  rangePickStart?: string | null;
  rangePickHover?: string | null;
  minSelectableIso?: string;
}>();

const emit = defineEmits<{
  'day-click': [cell: CalendarDayCell];
  'day-hover': [cell: CalendarDayCell];
}>();

const weekdays = WEEKDAYS_SHORT;

const minIso = computed(() => props.minSelectableIso ?? '');

const isSelecting = computed(() => Boolean(props.rangePickStart));

const months = computed(() => {
  const { approved, pending } = buildDaySetsForEmployee(props.employeeName, props.year, props.requests);
  return MONTHS_RU.map((name, index) => ({
    index,
    title: props.compact ? name : `${name}, ${String(props.year).slice(-2)}`,
    rows: buildMonthGrid(props.year, index, approved, pending)
  }));
});

const previewEnd = computed(() => props.rangePickHover ?? props.rangePickStart ?? null);

const isInPreview = (cell: CalendarDayCell) => {
  if (!props.rangePickStart || !previewEnd.value || cell.empty) return false;
  return isIsoInRange(cell.iso, props.rangePickStart, previewEnd.value);
};

const cellClass = (cell: CalendarDayCell) => {
  if (cell.empty) return 'empty';
  const classes: string[] = [];
  if (cell.holiday) classes.push('holiday');
  else if (cell.weekend) classes.push('weekend');
  if (cell.approved) {
    classes.push('emp-day-approved');
    if (cell.segmentClass) classes.push(cell.segmentClass);
  }
  if (cell.pending) {
    classes.push('emp-day-pending');
    if (cell.segmentClass) classes.push(cell.segmentClass);
  }

  const selectable = minIso.value && isDaySelectable(cell, minIso.value);
  if (selectable) {
    classes.push('emp-day-selectable');
  } else if (!cell.approved && !cell.pending) {
    classes.push('emp-day-unselectable');
  }

  if (props.rangePickStart && isInPreview(cell) && !cell.approved && !cell.pending) {
    classes.push('emp-day-range-preview');
    const seg = rangePreviewSegmentClass(cell.iso, props.rangePickStart, previewEnd.value);
    if (seg) classes.push(seg);
  }

  return classes.length ? classes : undefined;
};

const cellTitle = (cell: CalendarDayCell) => {
  if (cell.approved) return 'Отпуск одобрен';
  if (cell.pending) return 'Отпуск на согласовании';
  if (minIso.value && !isDaySelectable(cell, minIso.value)) {
    if (cell.iso < minIso.value) return 'Прошедшая дата';
    return 'Дата занята';
  }
  if (isSelecting.value) return 'Выберите дату окончания';
  return 'Выберите дату начала';
};

const onCellClick = (cell: CalendarDayCell) => {
  emit('day-click', cell);
};

const onCellHover = (cell: CalendarDayCell) => {
  emit('day-hover', cell);
};
</script>
