<template>
  <section class="auth-screen">
    <div class="auth-screen__glow auth-screen__glow--a" aria-hidden="true" />
    <div class="auth-screen__glow auth-screen__glow--b" aria-hidden="true" />
    <article class="auth-card">
      <div class="auth-brand">
        <span class="brand-title">VBI HR Gamification</span>
        <p class="muted">
          {{
            showBitrixLogin
              ? 'Войдите через корпоративный портал Битрикс24'
              : 'Войдите, чтобы начать работу в платформе'
          }}
        </p>
      </div>

      <div v-if="showBitrixLogin" class="auth-form">
        <button class="button primary auth-submit" type="button" @click="goBitrixLogin">
          Войти через Битрикс24
        </button>
        <p v-if="error" class="gift-error">{{ error }}</p>
        <p class="muted auth-bitrix-hint">
          При входе список сотрудников автоматически синхронизируется из структуры компании.
        </p>
      </div>

      <template v-if="showDemoLogin">
        <div v-if="showBitrixLogin" class="auth-divider" role="separator">
          <span>или демо-доступ</span>
        </div>

        <form class="auth-form" @submit.prevent="submit">
          <label class="gift-field">
            <span>Логин (email)</span>
            <input v-model="email" class="org-input" type="email" placeholder="name@vbi.local" required />
          </label>

          <label class="gift-field">
            <span>Пароль</span>
            <input v-model="password" class="org-input" type="password" placeholder="Введите пароль" required />
          </label>

          <p v-if="!showBitrixLogin && error" class="gift-error">{{ error }}</p>

          <button class="button primary auth-submit" type="submit" :disabled="loading">
            {{ loading ? 'Входим...' : 'Войти' }}
          </button>
        </form>

        <details class="auth-demo" :open="!showBitrixLogin">
          <summary>Учётные записи для входа (пароли в описании)</summary>
          <ul class="list-reset demo-accounts-list">
            <li v-for="account in demoAccounts" :key="account.email">
              <button type="button" class="demo-account-btn" @click="fillDemo(account)">
                <strong>{{ account.name ?? roleLabels[account.role] }}</strong>
                <span class="soft">{{ account.email }} · {{ account.password }}</span>
                <span class="muted demo-account-desc">{{ account.description }}</span>
              </button>
            </li>
          </ul>
        </details>
      </template>
    </article>
  </section>
</template>

<script setup lang="ts">
import { roleLabels } from '~/composables/usePermissions';

const emit = defineEmits<{
  success: [];
}>();

const route = useRoute();
const router = useRouter();
const { isDevelopment } = useAppEnv();
const { login, demoAccounts } = useAuth();
const { bitrixAuthEnabled, configReady, preferBitrixLogin, bitrixLoginUrl } = useBitrixAuthConfig();

const showBitrixLogin = computed(() => preferBitrixLogin.value);
const showDemoLogin = computed(() => {
  if (!configReady.value && preferBitrixLogin.value) return false;
  if (bitrixAuthEnabled.value) return false;
  return isDevelopment.value;
});

const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

const readAuthError = () => {
  const raw = route.query.auth_error;
  if (!raw) return;
  error.value = Array.isArray(raw) ? String(raw[0]) : String(raw);
  const { auth_error: _e, ...rest } = route.query;
  router.replace({ path: route.path, query: rest });
};

onMounted(() => {
  readAuthError();

  if (route.query.auth === 'bitrix' && preferBitrixLogin.value) {
    window.location.href = bitrixLoginUrl.value;
  }
});

watch(
  () => route.query.auth_error,
  () => readAuthError()
);

const fillDemo = (account: { email: string; password: string }) => {
  email.value = account.email;
  password.value = account.password;
};

const goBitrixLogin = () => {
  window.location.href = bitrixLoginUrl.value;
};

const submit = async () => {
  error.value = '';
  loading.value = true;

  await new Promise((resolve) => setTimeout(resolve, 350));

  const result = await login(email.value, password.value);
  loading.value = false;

  if (!result.ok) {
    error.value = result.error;
    return;
  }

  emit('success');
};
</script>

<style scoped>
.auth-bitrix-hint {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.45;
}

.auth-divider {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 1.25rem 0 1rem;
  color: var(--text-muted, #6b7280);
  font-size: 0.8125rem;
}

.auth-divider::before,
.auth-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: color-mix(in srgb, var(--border, #d1d5db) 80%, transparent);
}
</style>
