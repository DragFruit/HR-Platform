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
        <p class="vibe-creds-hint muted">Логин и пароль для входа без Битрикса.</p>

        <label class="vibe-creds-field">
          <span class="vibe-creds-label">Логин (email)</span>
          <input
            v-model="login"
            type="email"
            class="table-input"
            autocomplete="username"
            placeholder="name@company.ru"
            :readonly="!editing"
            required
          />
        </label>

        <div class="vibe-creds-field">
          <span class="vibe-creds-label">Пароль</span>
          <div class="vibe-creds-password-row">
            <div class="vibe-creds-password-wrap">
              <input
                :key="passwordVisible ? 'pw-visible' : 'pw-hidden'"
                ref="passwordInput"
                v-model="password"
                class="table-input vibe-creds-password-input"
                :type="passwordVisible ? 'text' : 'password'"
                autocomplete="new-password"
                :readonly="!editing"
                :placeholder="passwordPlaceholder"
                :required="editing && !hasPassword"
                @keydown.enter.prevent="editing && submit()"
              />
              <button
                type="button"
                class="vibe-creds-eye"
                :aria-label="passwordVisible ? 'Скрыть пароль' : 'Показать пароль'"
                :title="passwordVisible ? 'Скрыть' : 'Показать'"
                @click="togglePasswordVisible"
              >
                <svg
                  v-if="passwordVisible"
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linejoin="round"
                  />
                  <circle cx="12" cy="12" r="2.6" stroke="currentColor" stroke-width="1.8" />
                </svg>
                <svg
                  v-else
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linejoin="round"
                  />
                  <circle cx="12" cy="12" r="2.6" stroke="currentColor" stroke-width="1.8" />
                  <path
                    d="M4 20 20 4"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
            </div>
            <button
              type="button"
              class="vibe-creds-pencil"
              aria-label="Изменить пароль"
              title="Изменить"
              :disabled="editing"
              @click="startEdit"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                <path
                  d="M14.5 5.5 18.5 9.5M4 20l.8-3.7L16.2 5 20 8.8 8.7 20.1 5 20.9 4 20Z"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>

        <p v-if="formError" class="vibe-creds-error" role="alert">{{ formError }}</p>
        <p v-if="formOk" class="vibe-creds-ok" role="status">{{ formOk }}</p>

        <div v-if="editing" class="vibe-creds-actions row">
          <button type="button" class="button ghost" :disabled="submitting" @click="cancelEdit">
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
const initialLogin = ref('');
const password = ref('');
const storedPassword = ref('');
const hasPassword = ref(false);
const editing = ref(false);
const passwordVisible = ref(false);
const formError = ref('');
const formOk = ref('');
const submitting = ref(false);
const passwordInput = ref<HTMLInputElement | null>(null);

const passwordPlaceholder = computed(() => {
  if (editing.value) return hasPassword.value ? '' : 'Минимум 8 символов';
  if (hasPassword.value && !storedPassword.value) return '••••••••';
  return '';
});

const applyViewPassword = () => {
  password.value = storedPassword.value;
  passwordVisible.value = false;
};

const load = async () => {
  formError.value = '';
  formOk.value = '';
  editing.value = false;
  passwordVisible.value = false;
  try {
    const data = await $fetch<{
      login: string;
      has_password: boolean;
      password: string | null;
    }>('/api/profile/vibe-credentials');
    login.value = data.login || user.value?.email || '';
    initialLogin.value = login.value;
    hasPassword.value = data.has_password;
    storedPassword.value = data.password || '';
  } catch {
    login.value = user.value?.email || '';
    initialLogin.value = login.value;
    hasPassword.value = false;
    storedPassword.value = '';
  }
  applyViewPassword();
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

const togglePasswordVisible = () => {
  passwordVisible.value = !passwordVisible.value;
};

const startEdit = () => {
  if (editing.value) return;
  formError.value = '';
  formOk.value = '';
  editing.value = true;
  password.value = storedPassword.value;
  passwordVisible.value = false;
  nextTick(() => {
    const el = passwordInput.value;
    if (!el) return;
    el.focus();
    el.select?.();
  });
};

const cancelEdit = () => {
  if (submitting.value) return;
  formError.value = '';
  formOk.value = '';
  editing.value = false;
  login.value = initialLogin.value;
  applyViewPassword();
};

const submit = async () => {
  if (!editing.value) return;

  const nextLogin = login.value.trim().toLowerCase();
  if (!nextLogin || !nextLogin.includes('@')) {
    formError.value = 'Укажите корректный email — он будет логином для входа';
    return;
  }

  const nextPassword = password.value.trim();
  const loginChanged = nextLogin !== initialLogin.value.trim().toLowerCase();
  const passwordChanged = nextPassword !== storedPassword.value;

  if (!hasPassword.value && nextPassword.length < 8) {
    formError.value = 'Задайте пароль не короче 8 символов';
    return;
  }
  if (hasPassword.value && !passwordChanged && !loginChanged) {
    formError.value = 'Измените пароль или логин';
    return;
  }
  if (passwordChanged && nextPassword.length < 8) {
    formError.value = 'Пароль не короче 8 символов';
    return;
  }

  formError.value = '';
  formOk.value = '';
  submitting.value = true;
  try {
    const body: { login: string; password?: string } = { login: nextLogin };
    if (passwordChanged) body.password = nextPassword;

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
    initialLogin.value = res.login;
    login.value = res.login;
    if (passwordChanged) storedPassword.value = nextPassword;
    editing.value = false;
    applyViewPassword();
    formOk.value = 'Сохранено';
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

.vibe-creds-password-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.vibe-creds-password-wrap {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
}

.vibe-creds-password-input {
  width: 100%;
  padding-right: 2.5rem;
}

.vibe-creds-password-input[readonly] {
  cursor: default;
  background: #f7f7f4;
}

.vibe-creds-eye,
.vibe-creds-pencil {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  color: #333;
  cursor: pointer;
  transition: color 0.12s ease, opacity 0.12s ease, transform 0.12s ease;
}

.vibe-creds-eye {
  position: absolute;
  top: 50%;
  right: 0.55rem;
  transform: translateY(-50%);
  width: 28px;
  height: 28px;
}

.vibe-creds-eye:hover {
  color: #111;
}

.vibe-creds-pencil {
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
}

.vibe-creds-pencil:hover:not(:disabled) {
  color: #111;
  transform: scale(1.08);
}

.vibe-creds-pencil:disabled {
  opacity: 0.35;
  cursor: default;
}

.vibe-creds-eye:focus-visible,
.vibe-creds-pencil:focus-visible {
  outline: 2px solid #7451f4;
  outline-offset: 2px;
  border-radius: 4px;
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
