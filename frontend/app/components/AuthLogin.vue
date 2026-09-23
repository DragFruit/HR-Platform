<template>
  <section class="auth-screen">
    <div class="auth-screen__glow auth-screen__glow--a" aria-hidden="true" />
    <div class="auth-screen__glow auth-screen__glow--b" aria-hidden="true" />
    <article class="auth-card">
      <div class="auth-brand">
        <span class="brand-title">{{ platformName }}</span>
        <p class="muted">
          {{
            showVibePasswordForm
              ? 'Войдите логином Vibe или через Битрикс24'
              : showBitrixLogin
                ? 'Войдите через корпоративный портал Битрикс24'
                : 'Войдите, чтобы начать работу в платформе'
          }}
        </p>
      </div>

      <div v-if="showBitrixLogin || showVibePasswordForm" class="auth-form">
        <p v-if="oauthMisconfigured && oauthMisconfiguredHint" class="gift-error auth-oauth-misconfig">
          {{ oauthMisconfiguredHint }}
        </p>

        <template v-if="showVibePasswordForm">
          <form class="auth-form auth-form--password" @submit.prevent="submitVibePassword">
            <label class="gift-field">
              <span>Email или логин</span>
              <input
                v-model="email"
                class="org-input"
                type="text"
                autocomplete="username"
                placeholder="name@vbi.ru"
                required
              />
            </label>

            <label class="gift-field">
              <span>Пароль Vibe</span>
              <input
                v-model="password"
                class="org-input"
                type="password"
                autocomplete="current-password"
                placeholder="Пароль платформы"
                required
              />
            </label>

            <button class="button primary auth-submit" type="submit" :disabled="loading">
              {{ loading ? 'Входим...' : 'Войти' }}
            </button>
          </form>

          <div v-if="showBitrixLogin" class="auth-divider" role="separator">
            <span>или</span>
          </div>
        </template>

        <button
          v-if="showBitrixLogin"
          class="button auth-submit"
          :class="showVibePasswordForm ? '' : 'primary'"
          type="button"
          :disabled="oauthMisconfigured"
          @click="goBitrixLogin"
        >
          Войти через Битрикс24
        </button>
        <p v-if="error" class="gift-error">{{ error }}</p>
      </div>

      <template v-if="showDemoLogin">
        <div v-if="showBitrixLogin || showVibePasswordForm" class="auth-divider" role="separator">
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

          <p v-if="!showBitrixLogin && !showVibePasswordForm && error" class="gift-error">{{ error }}</p>

          <button class="button primary auth-submit" type="submit" :disabled="loading">
            {{ loading ? 'Входим...' : 'Войти' }}
          </button>
        </form>

        <details class="auth-demo" :open="showDemoLogin">
          <summary>Демо-аккаунты для показа (пароли в описании)</summary>
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
import { PLATFORM_NAME } from '~/data/platformBrand';
import { roleLabels } from '~/composables/usePermissions';

const platformName = PLATFORM_NAME;

const emit = defineEmits<{
  success: [];
}>();

const route = useRoute();
const router = useRouter();
const { isDevelopment } = useAppEnv();
const { login, loginWithVibePassword, demoAccounts } = useAuth();
const BITRIX_LOGIN_PATH = '/api/auth/bitrix';

const {
  configReady,
  preferBitrixLogin,
  vibePasswordLoginEnabled,
  oauthMisconfigured,
  oauthMisconfiguredHint
} = useBitrixAuthConfig();

const showBitrixLogin = computed(() => preferBitrixLogin.value);
const showVibePasswordForm = computed(() => vibePasswordLoginEnabled.value);
const showDemoLogin = computed(() => {
  if (!isDevelopment.value) return false;
  if (!configReady.value && preferBitrixLogin.value) return false;
  return true;
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
  window.location.href = BITRIX_LOGIN_PATH;
};

const submitVibePassword = async () => {
  error.value = '';
  loading.value = true;
  const result = await loginWithVibePassword(email.value, password.value);
  loading.value = false;
  if (!result.ok) {
    error.value = result.error;
    return;
  }
  emit('success');
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
.auth-oauth-misconfig {
  margin: 0 0 12px;
  line-height: 1.45;
  font-size: 0.86rem;
}

.auth-form--password {
  margin-bottom: 0;
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
