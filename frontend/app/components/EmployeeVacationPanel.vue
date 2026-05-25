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
        />
        <p v-else class="vac-emp-empty">
          Войдите как <strong>Катя</strong>, <strong>Вася</strong> или <strong>Маша</strong>.
        </p>
      </section>

      <EmployeeVacationAside v-if="!embedded" :view-year="viewYear" />
    </div>
  </div>
</template>

<script setup lang="ts">
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
const { requestsForYear, addRequest, employeeRequests, hydrate: hydrateVacations } = useVacations();

const yearRequests = computed(() => requestsForYear(props.viewYear));

const form = reactive({ start: '', end: '' });
const formError = ref<{ title: string; text: string } | null>(null);
const openMenuId = ref<number | null>(null);
const editingId = ref<number | null>(null);
const editForm = reactive({ start: '', end: '' });
const editError = ref('');

const currentEmployee = computed(() => findByUserForAuth(user.value));
const employeeName = computed(() => currentEmployee.value?.name ?? '');
const hireIso = computed(() => currentEmployee.value?.hired_at ?? '');

const balance = computed(() =>
  calcEmployeeBalance(employeeName.value, hireIso.value, yearRequests.value, new Date(), props.viewYear)
);

const hasConflict = (start: string, end: string, excludeId?: number) =>
  yearRequests.value.some(
    (r) =>
      r.id !== excludeId &&
      r.employee === employeeName.value &&
      (r.status === 'approved' || r.status === 'pending') &&
      !(end < r.start || start > r.end)
  );

const closeRequestMenu = () => {
  openMenuId.value = null;
};

const toggleRequestMenu = (id: number) => {
  openMenuId.value = openMenuId.value === id ? null : id;
  editingId.value = null;
  editError.value = '';
};

const startEditRequest = (req: VacationRequest) => {
  editingId.value = req.id;
  editForm.start = req.start;
  editForm.end = req.end;
  editError.value = '';
  closeRequestMenu();
};

const cancelEditRequest = () => {
  editingId.value = null;
  editError.value = '';
};

const saveEditRequest = (id: number) => {
  editError.value = '';
  if (!editForm.start || !editForm.end) {
    editError.value = 'Укажите обе даты.';
    return;
  }
  if (editForm.end < editForm.start) {
    editError.value = 'Дата окончания не может быть раньше начала.';
    return;
  }
  if (hasConflict(editForm.start, editForm.end, id)) {
    editError.value = 'Пересечение с другим отпуском.';
    return;
  }
  if (updateRequestDates(id, editForm.start, editForm.end)) {
    editingId.value = null;
  } else {
    editError.value = 'Не удалось сохранить.';
  }
};

const removeRequest = (req: VacationRequest) => {
  closeRequestMenu();
  if (editingId.value === req.id) cancelEditRequest();
  deleteRequest(req.id);
};

const onDocumentClick = () => {
  closeRequestMenu();
};

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
