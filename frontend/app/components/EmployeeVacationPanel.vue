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
            :get-month-entries="getMonthEntries"
            :year="props.viewYear"
          />
          <EmployeeYearCalendar
            v-else-if="employeeName"
            compact
            :employee-name="employeeName"
            :year="props.viewYear"
            :requests="displayRequests"
            :range-pick-start="rangePickStart"
            :range-pick-hover="rangePickHover"
            :selected-range-start="form.start || null"
            :selected-range-end="form.end || null"
            :min-selectable-iso="minIso"
            @day-click="handleDayClick"
            @day-hover="handleDayHover"
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

      <EmployeeVacationAside v-if="!embedded" :view-year="viewYear" :ui-mode="uiMode" :team-mode-label="teamModeLabel" @update:ui-mode="onUiModeChange" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { buildDaySetsForEmployee } from '~/utils/vacationCalendar';
import { assessVacationBalance } from '~/utils/vacationBalance';

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
  addRequest,
  hydrate: hydrateVacations,
  state,
  getMonthEntries
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
  notifyCalendarRangeSelected,
  mergeRequestsForDisplay
} = useVacationTraining();

const yearRequests = computed(() => requestsForYear(props.viewYear));
const displayRequests = computed(() => mergeRequestsForDisplay(props.viewYear, yearRequests.value));

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
    await addRequest({ employee: employeeName.value, start: form.start, end: form.end });
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
