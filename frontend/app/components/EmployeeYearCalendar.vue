<template>
  <div
    class="emp-cal-grid"
    :class="{ 'emp-cal-grid--compact': compact }"
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
  type CalendarDayCell
} from '~/utils/vacationCalendar';
import type { VacationRequest } from '~/composables/useVacations';

const props = defineProps<{
  employeeName: string;
  year: number;
  requests: VacationRequest[];
  compact?: boolean;
}>();

const weekdays = WEEKDAYS_SHORT;

const months = computed(() => {
  const { approved, pending } = buildDaySetsForEmployee(props.employeeName, props.year, props.requests);
  return MONTHS_RU.map((name, index) => ({
    index,
    title: props.compact ? name : `${name}, ${String(props.year).slice(-2)}`,
    rows: buildMonthGrid(props.year, index, approved, pending)
  }));
});

const cellClass = (cell: CalendarDayCell) => {
  if (cell.empty) return 'empty';
  const classes = [];
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
  return classes.length ? classes : undefined;
};

const cellTitle = (cell: CalendarDayCell) => {
  if (cell.approved) return 'Отпуск одобрен';
  if (cell.pending) return 'Отпуск на согласовании';
  return undefined;
};
</script>
