<template>
  <div
    class="emp-cal-grid"
    :class="{ 'emp-cal-grid--compact': compact, 'emp-cal-grid--selecting': isSelecting }"
    role="img"
    :aria-label="`Календарь отпусков за ${year} год`"
  >
    <div v-for="month in months" :key="month.index" class="emp-cal-month hr-month" :class="monthClass(month.index)">
      <div class="hr-month-title">
        <span>{{ month.title }}</span>
        <button
          v-if="!isSelecting && showReservationControl(month)"
          type="button"
          class="emp-reservation-add-btn"
          :class="{ 'emp-reservation-add-btn--has': month.reservation }"
          :data-tour="month.index === 11 ? 'vac-reservation-dec' : undefined"
          :title="month.reservation ? 'Изменить бронь' : 'Предварительная бронь'"
          :aria-label="month.reservation ? `Бронь: ${month.reservationLabel}` : 'Добавить предварительную бронь'"
          @click.stop="onReservationClick(month.index)"
        >
          <span
            v-if="month.reservation"
            class="emp-reservation-badge emp-reservation-badge--wide"
          >
            {{ month.reservationLabel }}
          </span>
          <span v-else class="emp-reservation-add-label">+бронь</span>
        </button>
      </div>
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
  isInRangePreview,
  rangePreviewSegmentClass,
  type CalendarDayCell
} from '~/utils/vacationCalendar';
import type { VacationRequest } from '~/composables/useVacations';
import type { VacationReservation } from '~/utils/vacationReservations';
import {
  canAddReservationForMonth,
  canManageReservationMonth,
  formatReservationLabel
} from '~/utils/vacationReservations';

const props = defineProps<{
  employeeName: string;
  year: number;
  requests: VacationRequest[];
  reservations?: VacationReservation[];
  compact?: boolean;
  rangePickStart?: string | null;
  rangePickHover?: string | null;
  /** Зафиксированный период из формы — подсветка после выбора на календаре */
  selectedRangeStart?: string | null;
  selectedRangeEnd?: string | null;
  minSelectableIso?: string;
  /** Подсветка месяца при «Создать заявку» из брони */
  highlightMonthIndex?: number | null;
  /** В учебном квесте — всегда показывать +бронь у этого месяца (0–11) */
  reservationControlOverride?: number | null;
}>();

const emit = defineEmits<{
  'day-click': [cell: CalendarDayCell];
  'day-hover': [cell: CalendarDayCell];
  'reservation-month-click': [monthIndex: number];
}>();

const weekdays = WEEKDAYS_SHORT;

const minIso = computed(() => props.minSelectableIso ?? '');

const isSelecting = computed(() => Boolean(props.rangePickStart));

const reservationByMonth = computed(() => {
  const map = new Map<number, VacationReservation>();
  for (const item of props.reservations ?? []) {
    if (item.year === props.year) {
      map.set(item.month - 1, item);
    }
  }
  return map;
});

const months = computed(() => {
  const { approved, pending } = buildDaySetsForEmployee(props.employeeName, props.year, props.requests);
  return MONTHS_RU.map((name, index) => {
    const reservation = reservationByMonth.value.get(index);
    return {
      index,
      title: props.compact ? name : `${name}, ${String(props.year).slice(-2)}`,
      rows: buildMonthGrid(props.year, index, approved, pending),
      reservation,
      reservationLabel: reservation ? formatReservationLabel(reservation.durationDays) : ''
    };
  });
});

const showReservationControl = (month: { index: number; reservation?: VacationReservation }) => {
  if (props.reservationControlOverride === month.index) return true;
  const monthNum = month.index + 1;
  if (month.reservation) {
    return canManageReservationMonth(props.year, monthNum);
  }
  return canAddReservationForMonth(props.year, monthNum);
};

const monthClass = (monthIndex: number) => {
  const classes: string[] = [];
  if (reservationByMonth.value.has(monthIndex)) {
    classes.push('emp-cal-month--has-reservation');
  }
  if (props.highlightMonthIndex === monthIndex) {
    classes.push('emp-cal-month--highlight');
  }
  return classes.length ? classes : undefined;
};

const onReservationClick = (monthIndex: number) => {
  emit('reservation-month-click', monthIndex);
};

const previewEnd = computed(() => {
  if (props.rangePickStart) return props.rangePickHover ?? props.rangePickStart;
  if (props.selectedRangeStart && props.selectedRangeEnd) return props.selectedRangeEnd;
  return props.rangePickStart;
});

const previewStart = computed(() => {
  if (props.rangePickStart) return props.rangePickStart;
  if (props.selectedRangeStart && props.selectedRangeEnd) return props.selectedRangeStart;
  return null;
});

const isInPreview = (cell: CalendarDayCell) => {
  if (!previewStart.value || !previewEnd.value || cell.empty) return false;
  return isInRangePreview(cell.iso, previewStart.value, previewEnd.value);
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

  if (previewStart.value && isInPreview(cell) && !cell.approved && !cell.pending) {
    classes.push('emp-day-range-preview');
    const seg = rangePreviewSegmentClass(cell.iso, previewStart.value, previewEnd.value!);
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
