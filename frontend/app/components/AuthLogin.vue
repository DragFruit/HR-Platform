<template>
  <section class="auth-screen">
    <div class="auth-screen__glow auth-screen__glow--a" aria-hidden="true" />
    <div class="auth-screen__glow auth-screen__glow--b" aria-hidden="true" />
    <article class="auth-card">
      <div class="auth-brand">
        <span class="brand-title">VBI HR Gamification</span>
        <p class="muted">Войдите, чтобы начать работу в платформе</p>
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

        <p v-if="error" class="gift-error">{{ error }}</p>

        <button class="button primary auth-submit" type="submit" :disabled="loading">
          {{ loading ? 'Входим...' : 'Войти' }}
        </button>
      </form>

      <details class="auth-demo" open>
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
    </article>
  </section>
</template>

<script setup lang="ts">
import { roleLabels } from '~/composables/usePermissions';

const emit = defineEmits<{
  success: [];
}>();

const { login, demoAccounts } = useAuth();

const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

const fillDemo = (account: { email: string; password: string }) => {
  email.value = account.email;
  password.value = account.password;
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
