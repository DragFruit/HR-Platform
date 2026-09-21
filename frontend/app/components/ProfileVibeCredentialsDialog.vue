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
        aria-labelledby="profile-vibe-creds-title"
        @submit.prevent="submit"
      >
        <h3 id="profile-vibe-creds-title" class="vibe-creds-title">Вход в Vibe</h3>
        <p class="vibe-creds-hint muted">
          Логин и пароль для входа без Битрикса. Сохраняются в справочнике — HR видит тот же логин в
          админке.
        </p>

        <label class="vibe-creds-field">
          <span class="vibe-creds-label">Логин (email)</span>
          <input
            v-model="login"
            type="email"
            class="table-input"
            autocomplete="username"
            placeholder="name@company.ru"
            required
          />
        </label>

        <label class="vibe-creds-field">
          <span class="vibe-creds-label">
            {{
              hasPassword
                ? 'Новый пароль (пусто — не менять)'
                : 'Пароль (не короче 8 символов)'
            }}
          </span>
          <input
            v-model="password"
            type="password"
            class="table-input"
            autocomplete="new-password"
            :placeholder="hasPassword ? 'Оставьте пустым, чтобы не менять' : 'Минимум 8 символов'"
            :required="!hasPassword"
          />
        </label>

        <p v-if="formError" class="vibe-creds-error" role="alert">{{ formError }}</p>
        <p v-if="formOk" class="vibe-creds-ok" role="status">{{ formOk }}</p>

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
import type { AuthSessionUser } from '~/composables/useAuth';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{
  'update:open': [value: boolean];
  saved: [payload: { login: string; user: AuthSessionUser }];
}>();

const { user } = useAuth();
const { reloadFromServer } = useEmployees();

const login = ref('');
const password = ref('');
const hasPassword = ref(false);
const formError = ref('');
const formOk = ref('');
const submitting = ref(false);

const load = async () => {
  formError.value = '';
  formOk.value = '';
  password.value = '';
  try {
    const data = await $fetch<{ login: string; has_password: boolean }>(
      '/api/profile/vibe-credentials'
    );
    login.value = data.login || user.value?.email || '';
    hasPassword.value = data.has_password;
  } catch {
    login.value = user.value?.email || '';
    hasPassword.value = false;
  }
};

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) void load();
  }
);

const close = () => {
  if (submitting.value) return;
  emit('update:open', false);
};

const submit = async () => {
  const nextLogin = login.value.trim().toLowerCase();
  if (!nextLogin || !nextLogin.includes('@')) {
    formError.value = 'Укажите корректный email — он будет логином для входа';
    return;
  }
  if (!hasPassword.value && password.value.trim().length < 8) {
    formError.value = 'Задайте пароль не короче 8 символов';
    return;
  }
  if (password.value.trim() && password.value.trim().length < 8) {
    formError.value = 'Пароль не короче 8 символов';
    return;
  }

  formError.value = '';
  formOk.value = '';
  submitting.value = true;
  try {
    const body: { login: string; password?: string } = { login: nextLogin };
    if (password.value.trim()) body.password = password.value.trim();

    const res = await $fetch<{
      ok: boolean;
      login: string;
      has_password: boolean;
      user: AuthSessionUser;
    }>('/api/profile/vibe-credentials', {
      method: 'PUT',
      body
    });

    if (user.value) {
      user.value = { ...user.value, ...res.user, email: res.login };
      if (import.meta.client) {
        localStorage.setItem('vbi-auth-session', JSON.stringify(user.value));
      }
    }
    hasPassword.value = res.has_password;
    password.value = '';
    formOk.value = 'Сохранено. Можно входить по логину и паролю без Битрикса.';
    await reloadFromServer().catch(() => {});
    emit('saved', { login: res.login, user: res.user });
    window.setTimeout(() => emit('update:open', false), 700);
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string }; statusMessage?: string };
    formError.value =
      fetchErr.data?.statusMessage || fetchErr.statusMessage || 'Не удалось сохранить';
  } finally {
    submitting.value = false;
  }
};
</script>

<style scoped>
.vibe-creds-card {
  width: min(420px, calc(100vw - 2rem));
  padding: 1.25rem 1.5rem 1.5rem;
  border: 2px solid #111;
  box-shadow: 4px 4px 0 #ddf365;
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

.vibe-creds-ok {
  margin: 0 0 0.75rem;
  color: #2d6a4f;
  font-size: 0.875rem;
}

.vibe-creds-actions {
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.25rem;
}
</style>
