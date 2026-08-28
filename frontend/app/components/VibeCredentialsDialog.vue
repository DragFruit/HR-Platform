<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="org-confirm-overlay"
      role="presentation"
      @click.self="close"
    >
      <form
        class="vibe-creds-card card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vibe-creds-title"
        @submit.prevent="submit"
      >
        <h3 id="vibe-creds-title" class="vibe-creds-title">Вход Vibe для «{{ employeeLabel }}»</h3>
        <p class="vibe-creds-hint muted">
          Сотрудник входит по логину (email) и паролю. Пустой пароль + «Сохранить» — сбросить пароль.
        </p>

        <label class="vibe-creds-field">
          <span class="vibe-creds-label">Логин (email)</span>
          <input
            v-model="login"
            type="email"
            class="table-input"
            autocomplete="off"
            placeholder="name@company.ru"
            required
          />
        </label>

        <label class="vibe-creds-field">
          <span class="vibe-creds-label">Пароль (не короче 8 символов)</span>
          <input
            v-model="password"
            type="password"
            class="table-input"
            autocomplete="new-password"
            placeholder="Оставьте пустым, чтобы сбросить"
          />
        </label>

        <p v-if="formError" class="vibe-creds-error" role="alert">{{ formError }}</p>

        <div class="vibe-creds-actions row">
          <button type="button" class="button ghost" :disabled="submitting" @click="close">
            Отмена
          </button>
          <button type="submit" class="button primary" :disabled="submitting">
            {{ submitting ? 'Сохранение…' : 'Сохранить' }}
          </button>
        </div>
      </form>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { Employee } from '~/composables/useEmployees';

const props = defineProps<{
  open: boolean;
  employee: Employee | null;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  saved: [];
}>();

const { updateEmployee } = useEmployees();

const login = ref('');
const password = ref('');
const formError = ref('');
const submitting = ref(false);

const employeeLabel = computed(() => props.employee?.name.trim() || `id ${props.employee?.id ?? ''}`);

watch(
  () => [props.open, props.employee?.id, props.employee?.email] as const,
  ([isOpen]) => {
    if (!isOpen) return;
    login.value = props.employee?.email?.trim() ?? '';
    password.value = '';
    formError.value = '';
    submitting.value = false;
  },
  { immediate: true }
);

const close = () => {
  if (submitting.value) return;
  emit('update:open', false);
};

const submit = async () => {
  const emp = props.employee;
  if (!emp) return;

  const nextLogin = login.value.trim().toLowerCase();
  if (!nextLogin || !nextLogin.includes('@')) {
    formError.value = 'Укажите корректный email — он будет логином для входа';
    return;
  }

  formError.value = '';
  submitting.value = true;

  try {
    if (nextLogin !== emp.email.trim().toLowerCase()) {
      updateEmployee(emp.id, { email: nextLogin });
    }

    if (!password.value.trim()) {
      await $fetch(`/api/admin/employees/${emp.id}/vibe-password`, {
        method: 'PUT',
        body: { clear: true }
      });
      emit('saved');
      emit('update:open', false);
      return;
    }

    await $fetch(`/api/admin/employees/${emp.id}/vibe-password`, {
      method: 'PUT',
      body: { password: password.value }
    });
    emit('saved');
    emit('update:open', false);
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string }; statusMessage?: string };
    formError.value =
      fetchErr.data?.statusMessage || fetchErr.statusMessage || 'Не удалось сохранить учётные данные';
  } finally {
    submitting.value = false;
  }
};
</script>

<style scoped>
.vibe-creds-card {
  width: min(420px, calc(100vw - 2rem));
  padding: 1.25rem 1.5rem 1.5rem;
}

.vibe-creds-title {
  margin: 0 0 0.5rem;
  font-size: 1.125rem;
}

.vibe-creds-hint {
  margin: 0 0 1rem;
  font-size: 0.875rem;
  line-height: 1.45;
}

.vibe-creds-field {
  display: grid;
  gap: 0.35rem;
  margin-bottom: 0.85rem;
}

.vibe-creds-label {
  font-size: 0.8125rem;
  font-weight: 600;
}

.vibe-creds-error {
  margin: 0 0 0.75rem;
  color: var(--danger, #c0392b);
  font-size: 0.875rem;
}

.vibe-creds-actions {
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.25rem;
}
</style>
