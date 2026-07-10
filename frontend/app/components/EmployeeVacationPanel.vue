<template>
  <div class="vac-emp-page" :class="embedded ? 'vac-emp-page--embedded' : 'vac-emp-page--fit'">
    <header class="vac-emp-toolbar">
      <form class="vac-emp-toolbar__form" data-tour="vac-create-form" @submit.prevent="submitRequest">
        <h3 class="vac-emp-toolbar__title">Создать заявку на отпуск</h3>
        <span class="vac-emp-toolbar__word">с</span>
        <input v-model="form.start" type="date" class="vac-emp-input" aria-label="Дата начала" />
        <span class="vac-emp-toolbar__word">по</span>
        <input v-model="form.end" type="date" class="vac-emp-input" aria-label="Дата окончания" />
        <button class="vac-emp-btn" type="submit" :disabled="submitting">
          {{ submitting ? 'Сохранение…' : 'Создать заявку' }}
        </button>
        <p
          v-if="formAssessment.status === 'advance'"
          class="vac-advance-notice vac-advance-notice--toolbar"
          role="status"
        >
          <span class="vac-advance-notice__text">
            Не хватает {{ formAssessment.deficit }} дн. · к {{ formAssessment.startLabel }} будет
            {{ formAssessment.availableAtStart }} из {{ formAssessment.neededDays }}
          </span>
        </p>
        <p v-if="clarifyHint" class="vac-emp-toolbar__clarify-hint" role="status">
          {{ clarifyHint }}
        </p>
      </form>
    </header>

    <p v-if="formError" class="vac-emp-error">
      <strong>{{ formError.title }}:</strong> {{ formError.text }}
    </p>

    <div class="vac-emp-body" :class="{ 'vac-emp-body--embedded': embedded }">
      <div
        class="vac-emp-calendar-slot"
        :class="{ 'vac-emp-calendar-slot--with-tabs': hasTeamCalendar }"
      >
        <section
          class="vac-emp-calendar-pane"
          :class="{
            'vac-emp-calendar-pane--embedded': embedded,
            'vac-emp-calendar-pane--team': showTeamCalendar
          }"
          data-tour="vac-calendar"
        >
          <VacationTeamCalendar
            v-if="showTeamCalendar"
            variant="employee-team"
            :departments="teamDepartments"
            :requests="yearRequests"
            :reservations="employeeReservationsList"
            :get-month-entries="getMonthEntries"
            :year="props.viewYear"
          />
          <EmployeeYearCalendar
            v-else-if="employeeName"
            compact
            :employee-name="employeeName"
            :year="props.viewYear"
            :requests="displayRequests"
            :reservations="employeeReservationsList"
            :highlight-month-index="highlightMonthIndex"
            :range-pick-start="rangePickStart"
            :range-pick-hover="rangePickHover"
            :selected-range-start="form.start || null"
            :selected-range-end="form.end || null"
            :min-selectable-iso="minIso"
            :reservation-control-override="reservationControlOverride"
            @day-click="handleDayClick"
            @day-hover="handleDayHover"
            @reservation-month-click="openReservationDialog"
          />
          <p v-else class="vac-emp-empty">
            Нет записи в справочнике сотрудников для вашего аккаунта. Попросите HR добавить вас в справочник с
            вашим email.
          </p>
        </section>
        <VacationCalendarScopeToggle
          v-if="hasTeamCalendar"
          :model-value="calendarScope"
          @update:model-value="setCalendarScope"
        />
      </div>

      <EmployeeVacationAside
        v-if="!embedded"
        :view-year="viewYear"
        :ui-mode="uiMode"
        :team-mode-label="teamModeLabel"
        @update:ui-mode="onUiModeChange"
        @clarify-reservation="clarifyReservation"
      />
    </div>

    <VacationReservationDialog
      v-model:open="reservationDialogOpen"
      :year="props.viewYear"
      :month-index="reservationMonthIndex"
      :month-label="MONTHS_RU[reservationMonthIndex] ?? ''"
      :employee-name="employeeName"
      :editing-reservation="editingReservation"
    />
  </div>
</template>

<script setup lang="ts">
import { buildDaySetsForEmployee } from '~/utils/vacationCalendar';
import { assessVacationBalance } from '~/utils/vacationBalance';
import type { VacationReservation } from '~/utils/vacationReservations';
import {
  canAddReservationForMonth,
  canManageReservationMonth
} from '~/utils/vacationReservations';

const props = defineProps<{
  viewYear: number;
  /** Календарь в колонке руководителя; боковая панель — в ManagerVacationAside */
  embedded?: boolean;
  /** Переключатель «отдел / сотрудник» для наблюдателя отдела (полный экран сотрудника). */
  uiMode?: 'manager' | 'employee';
  teamModeLabel?: string;
}>();

const emit = defineEmits<{
  'update:viewYear': [value: number];
  'update:uiMode': [value: 'manager' | 'employee'];
}>();

const onUiModeChange = (mode: 'manager' | 'employee') => {
  emit('update:uiMode', mode);
};

const { user } = useAuth();
const { findByUserForAuth, hydrate: hydrateEmployees } = useEmployees();
const {
  requestsForYear,
  employeeReservations,
  addRequest,
  deleteReservation,
  hydrate: hydrateVacations,
  state,
  getMonthEntries,
  MONTHS_RU
} = useVacations();
const {
  hasTeamCalendar,
  teamDepartments,
  calendarScope,
  setCalendarScope
} = useEmployeeVacationTeamView();
const {
  isActive: isTrainingActive,
  currentStep: trainingStep,
  addTrainingRequest,
  addTrainingReservation,
  mergeReservationsForDisplay,
  trainingReservationMonth,
  notifyCalendarRangeSelected,
  mergeRequestsForDisplay
} = useVacationTraining();

const yearRequests = computed(() => requestsForYear(props.viewYear));
const displayRequests = computed(() => mergeRequestsForDisplay(props.viewYear, yearRequests.value));
const employeeReservationsList = computed(() => {
  if (!employeeName.value) return [];
  const real = employeeReservations(employeeName.value, props.viewYear);
  return mergeReservationsForDisplay(props.viewYear, real);
});

const reservationDialogOpen = ref(false);
const reservationMonthIndex = ref(0);
const editingReservation = ref<VacationReservation | null>(null);
const highlightMonthIndex = ref<number | null>(null);
const pendingClarifyReservationId = ref<number | null>(null);
const clarifyHint = ref('');

const clarifyReservation = (reservation: { id: number; month: number; year: number; durationDays: number; isTraining?: boolean }) => {
  if ('isTraining' in reservation && reservation.isTraining && isTrainingActive.value) {
    highlightMonthIndex.value = reservation.month - 1;
    form.start = '';
    form.end = '';
    clearSelection();
    formError.value = null;
    clarifyHint.value =
      'Выберите конкретные даты на календаре или в форме выше — после создания заявки учебная бронь исчезнет.';
    document.querySelector('.vac-emp-toolbar')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }
  pendingClarifyReservationId.value = reservation.id;
  highlightMonthIndex.value = reservation.month - 1;
  const monthName = MONTHS_RU[reservation.month - 1] ?? '';
  clarifyHint.value = `Создайте заявку на ${monthName} ${reservation.year} (бронь ~${reservation.durationDays} дн.) — выберите период на календаре или в форме выше.`;
  form.start = '';
  form.end = '';
  clearSelection();
  formError.value = null;
  document.querySelector('.vac-emp-toolbar')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

const currentEmployee = computed(() => findByUserForAuth(user.value));
const employeeName = computed(() => currentEmployee.value?.name ?? '');

const showTeamCalendar = computed(
  () => hasTeamCalendar.value && calendarScope.value === 'team' && Boolean(employeeName.value)
);
const hireIso = computed(() => currentEmployee.value?.hired_at ?? '');

const formAssessment = computed(() =>
  assessVacationBalance(
    employeeName.value,
    hireIso.value,
    form.start,
    form.end,
    yearRequests.value,
    state.value.primaryYear,
    undefined,
    currentEmployee.value?.vacation_opening_balance
  )
);

const form = reactive({ start: '', end: '' });
const formError = ref<{ title: string; text: string } | null>(null);
const submitting = ref(false);

const blockedDays = computed(() => {
  if (!employeeName.value) return new Set<string>();
  const { approved, pending } = buildDaySetsForEmployee(
    employeeName.value,
    props.viewYear,
    displayRequests.value
  );
  return new Set([...approved, ...pending]);
});

const {
  rangePickStart,
  rangePickHover,
  minIso,
  clearSelection,
  handleDayClick,
  handleDayHover
} = useVacationRangePick({
  blockedDays,
  onRangeSelected: (start, end) => {
    form.start = start;
    form.end = end;
    formError.value = null;
    notifyCalendarRangeSelected();
  }
});

const reservationControlOverride = computed(() =>
  isTrainingActive.value && trainingStep.value?.id === 'reservation-book'
    ? trainingReservationMonth - 1
    : null
);

const openReservationDialog = (monthIndex: number) => {
  if (rangePickStart.value) return;
  if (
    isTrainingActive.value &&
    trainingStep.value?.id === 'reservation-book' &&
    monthIndex !== trainingReservationMonth - 1
  ) {
    return;
  }

  const monthNum = monthIndex + 1;
  const existing = employeeReservationsList.value.find((r) => r.month === monthNum);
  const trainingBookStep =
    isTrainingActive.value && trainingStep.value?.id === 'reservation-book';

  if (!trainingBookStep) {
    if (existing) {
      if (!canManageReservationMonth(props.viewYear, monthNum)) return;
    } else if (!canAddReservationForMonth(props.viewYear, monthNum)) {
      return;
    }
  }
  reservationMonthIndex.value = monthIndex;
  editingReservation.value =
    employeeReservationsList.value.find((r) => r.month === monthIndex + 1) ?? null;
  reservationDialogOpen.value = true;
};

watch(reservationDialogOpen, (isOpen) => {
  if (!isOpen) editingReservation.value = null;
});

const hasConflict = (start: string, end: string, excludeId?: number) =>
  displayRequests.value.some(
    (r) =>
      r.id !== excludeId &&
      r.employee === employeeName.value &&
      (r.status === 'approved' || r.status === 'pending') &&
      !(end < r.start || start > r.end)
  );

const submitRequest = async () => {
  formError.value = null;
  if (!employeeName.value || !form.start || !form.end) {
    formError.value = { title: 'Заполните даты', text: 'Укажите дату начала и окончания отпуска.' };
    return;
  }
  if (form.end < form.start) {
    formError.value = { title: 'Некорректный период', text: 'Дата окончания не может быть раньше даты начала.' };
    return;
  }
  if (hasConflict(form.start, form.end)) {
    formError.value = {
      title: 'Пересечение',
      text: 'На эти даты уже есть отпуск.'
    };
    return;
  }

  if (isTrainingActive.value) {
    if (trainingStep.value?.id !== 'create') {
      formError.value = {
        title: 'Учебный режим',
        text: 'Следуйте шагам квеста — сейчас нужно выполнить другое действие.'
      };
      return;
    }
    addTrainingRequest({ employee: employeeName.value, start: form.start, end: form.end });
    form.start = '';
    form.end = '';
    clearSelection();
    return;
  }

  submitting.value = true;
  try {
    const created = await addRequest({ employee: employeeName.value, start: form.start, end: form.end });
    if (created && pendingClarifyReservationId.value) {
      await deleteReservation(pendingClarifyReservationId.value);
      pendingClarifyReservationId.value = null;
      highlightMonthIndex.value = null;
      clarifyHint.value = '';
    } else if (created && isTrainingActive.value && trainingStep.value?.id === 'reservation-clarify') {
      highlightMonthIndex.value = null;
      clarifyHint.value = '';
    }
    form.start = '';
    form.end = '';
    clearSelection();
  } catch {
    formError.value = {
      title: 'Не сохранилось',
      text: 'Заявка не дошла до сервера. Проверьте сеть и попробуйте ещё раз.'
    };
  } finally {
    submitting.value = false;
  }
};

const refreshData = () => {
  hydrateEmployees();
  hydrateVacations();
};

watch(
  () => user.value?.id,
  () => refreshData(),
  { immediate: true }
);

watch(
  () => trainingStep.value?.id,
  (stepId, prevStepId) => {
    if (!isTrainingActive.value) return;
    if (stepId === 'reservation-book' && calendarScope.value === 'team') {
      setCalendarScope('mine');
    }
    if (stepId === 'calendar' && prevStepId === 'create') {
      form.start = '';
      form.end = '';
      formError.value = null;
      clearSelection();
    }
  }
);

onMounted(() => {
  refreshData();
});
</script>
