<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="org-confirm-overlay vac-admin-add-overlay"
      role="presentation"
      @click.self="close"
    >
      <form
        class="vac-admin-add-card card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vac-admin-add-title"
        @submit.prevent="submit"
      >
        <h3 id="vac-admin-add-title" class="vac-admin-add-title">Добавить отпуск</h3>
        <p class="vac-admin-add-hint">
          Отпуск будет сразу отмечен как согласованный. Можно указать прошедшие даты.
        </p>

        <label class="vac-admin-add-field">
          <span class="vac-admin-add-label">Сотрудник</span>
          <select v-model="form.employee" class="vac-admin-add-select" required>
            <option value="" disabled>Выберите сотрудника</option>
            <optgroup v-for="dep in departmentsGrouped" :key="dep.name" :label="dep.name">
              <option v-for="emp in dep.employees" :key="emp.id" :value="emp.name">
                {{ emp.name }}
              </option>
            </optgroup>
          </select>
        </label>

        <div class="vac-admin-add-dates">
          <label class="vac-admin-add-field">
            <span class="vac-admin-add-label">С</span>
            <input v-model="form.start" type="date" class="vac-emp-input vac-admin-add-input" required />
          </label>
          <label class="vac-admin-add-field">
            <span class="vac-admin-add-label">По</span>
            <input v-model="form.end" type="date" class="vac-emp-input vac-admin-add-input" required />
          </label>
        </div>

        <p v-if="formError" class="vac-admin-add-error" role="alert">{{ formError }}</p>

        <div class="vac-admin-add-actions row">
          <button type="button" class="button ghost" :disabled="submitting" @click="close">
            Отмена
          </button>
          <button type="submit" class="button primary" :disabled="submitting">
            {{ submitting ? 'Сохранение…' : 'Добавить' }}
          </button>
        </div>
      </form>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  added: [];
}>();

const { departmentsGrouped } = useEmployees();
const { addRequest, approveRequest, state, viewYear } = useVacations();

const form = reactive({ employee: '', start: '', end: '' });
const formError = ref('');
const submitting = ref(false);

const allRequests = computed(() => Object.values(state.value.requestsByYear).flat());

const resetForm = () => {
  form.employee = '';
  form.start = '';
  form.end = '';
  formError.value = '';
};

const close = () => {
  if (submitting.value) return;
  emit('update:open', false);
  resetForm();
};

const hasConflict = (employee: string, start: string, end: string) =>
  allRequests.value.some(
    (r) =>
      r.employee === employee &&
      (r.status === 'approved' || r.status === 'pending') &&
      !(end < r.start || start > r.end)
  );

const submit = async () => {
  formError.value = '';
  const employee = form.employee.trim();
  const start = form.start.trim();
  const end = form.end.trim();

  if (!employee || !start || !end) {
    formError.value = 'Заполните сотрудника и даты отпуска.';
    return;
  }
  if (end < start) {
    formError.value = 'Дата окончания не может быть раньше даты начала.';
    return;
  }
  if (hasConflict(employee, start, end)) {
    formError.value = 'На эти даты у сотрудника уже есть отпуск.';
    return;
  }

  const year = Number(start.split('-')[0]);
  if (!Number.isFinite(year)) {
    formError.value = 'Некорректная дата начала.';
    return;
  }

  submitting.value = true;
  try {
    const created = await addRequest({
      employee,
      start,
      end,
      year,
      comment: 'Добавлено администратором'
    });
    if (!created) {
      formError.value = 'Не удалось создать отпуск. Попробуйте ещё раз.';
      return;
    }

    const approved = await approveRequest(created.id, null, { force: true });
    if (!approved) {
      formError.value = 'Отпуск создан, но не удалось сразу согласовать. Проверьте очередь согласования.';
      return;
    }

    viewYear.value = year;
    emit('added');
    emit('update:open', false);
    resetForm();
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string }; statusMessage?: string; message?: string };
    formError.value =
      err.data?.statusMessage || err.statusMessage || err.message || 'Ошибка сохранения. Попробуйте ещё раз.';
  } finally {
    submitting.value = false;
  }
};

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) resetForm();
  }
);
</script>
