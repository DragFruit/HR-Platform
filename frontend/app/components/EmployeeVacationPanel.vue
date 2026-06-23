<template>
  <div class="vac-emp-page" :class="embedded ? 'vac-emp-page--embedded' : 'vac-emp-page--fit'">
    <header class="vac-emp-toolbar">
      <form class="vac-emp-toolbar__form" @submit.prevent="submitRequest">
        <h3 class="vac-emp-toolbar__title">Создать заявку на отпуск</h3>
        <span class="vac-emp-toolbar__word">с</span>
        <input v-model="form.start" type="date" class="vac-emp-input" aria-label="Дата начала" />
        <span class="vac-emp-toolbar__word">по</span>
        <input v-model="form.end" type="date" class="vac-emp-input" aria-label="Дата окончания" />
        <button class="vac-emp-btn" type="submit">Создать заявку</button>
      </form>
    </header>

    <p v-if="formError" class="vac-emp-error">
      <strong>{{ formError.title }}:</strong> {{ formError.text }}
    </p>

    <div class="vac-emp-body" :class="{ 'vac-emp-body--embedded': embedded }">
      <section class="vac-emp-calendar-pane" :class="{ 'vac-emp-calendar-pane--embedded': embedded }">
        <EmployeeYearCalendar
          v-if="employeeName"
          compact
          :employee-name="employeeName"
          :year="props.viewYear"
          :requests="yearRequests"
          :range-pick-start="rangePickStart"
          :range-pick-hover="rangePickHover"
          :min-selectable-iso="minIso"
          @day-click="handleDayClick"
          @day-hover="handleDayHover"
        />
        <p v-else class="vac-emp-empty">
          Нет записи в справочнике сотрудников для вашего аккаунта. Попросите HR добавить вас в справочник с
          вашим email.
        </p>
      </section>

      <EmployeeVacationAside v-if="!embedded" :view-year="viewYear" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { buildDaySetsForEmployee } from '~/utils/vacationCalendar';

const props = defineProps<{
  viewYear: number;
  /** Календарь в колонке руководителя; боковая панель — в ManagerVacationAside */
  embedded?: boolean;
}>();

const emit = defineEmits<{
  'update:viewYear': [value: number];
}>();

const { user } = useAuth();
const { findByUserForAuth, hydrate: hydrateEmployees } = useEmployees();
const { requestsForYear, addRequest, hydrate: hydrateVacations } = useVacations();

const yearRequests = computed(() => requestsForYear(props.viewYear));

const currentEmployee = computed(() => findByUserForAuth(user.value));
const employeeName = computed(() => currentEmployee.value?.name ?? '');

const form = reactive({ start: '', end: '' });
const formError = ref<{ title: string; text: string } | null>(null);

const blockedDays = computed(() => {
  if (!employeeName.value) return new Set<string>();
  const { approved, pending } = buildDaySetsForEmployee(
    employeeName.value,
    props.viewYear,
    yearRequests.value
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
  }
});

const hasConflict = (start: string, end: string, excludeId?: number) =>
  yearRequests.value.some(
    (r) =>
      r.id !== excludeId &&
      r.employee === employeeName.value &&
      (r.status === 'approved' || r.status === 'pending') &&
      !(end < r.start || start > r.end)
  );

const submitRequest = () => {
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
  addRequest({ employee: employeeName.value, start: form.start, end: form.end });
  form.start = '';
  form.end = '';
  clearSelection();
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

onMounted(() => {
  refreshData();
});
</script>
