<template>
  <NuxtRouteAnnouncer />

  <div v-if="!authReady || finishingBitrixLogin" class="auth-loading">
    {{ finishingBitrixLogin ? 'Завершаем вход через Битрикс24...' : 'Загрузка...' }}
  </div>

  <div v-else class="app-viewport">
    <AuthLogin v-if="!isAuthenticated" @success="onLoginSuccess" />

    <div v-else class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-title">VBI HR Gamification</span>
        <span class="brand-subtitle">
          {{
            isVacationsOnly
              ? isAdmin
                ? 'Администрирование отпусков'
                : 'График отпусков'
              : isAdmin
                ? 'Панель администратора'
                : 'Рабочее пространство сотрудника'
          }}
        </span>
      </div>

      <div v-if="canSwitchRole" class="role-switch" role="group" aria-label="Режим платформы">
        <button
          type="button"
          class="role-btn"
          :class="{ active: !isAdmin }"
          @click="switchRole('employee')"
        >
          Сотрудник
        </button>
        <button
          type="button"
          class="role-btn"
          :class="{ active: isAdmin }"
          @click="switchRole('admin')"
        >
          Администратор
        </button>
      </div>

      <ul class="nav-list">
        <li v-for="item in navItems" :key="item.to">
          <NuxtLink :to="item.to" class="nav-link">
            {{ item.label }}
          </NuxtLink>
        </li>
      </ul>

      <button class="button ghost logout-btn" type="button" @click="handleLogout">Выйти</button>
    </aside>

    <div class="shell-main">
      <div v-if="envLabel" class="env-banner" :class="`env-banner--${appEnv}`" role="status">
        {{ envLabel }}
      </div>
      <header class="topbar">
        <h1>{{ pageTitle }}</h1>
        <div class="topbar-right">
          <UserAvatar v-if="user" :user-id="user.id" :name="user.name" :size="36" />
          <span class="soft">{{ user?.name }}</span>
          <span v-if="roleLabel" class="pill role-pill">{{ roleLabel }}</span>
          <div v-if="!isAdmin && !isVacationsOnly" class="pill">Баланс: {{ balance }}</div>
          <div v-else-if="isAdmin && !isVacationsOnly" class="pill admin-pill">Режим: администрирование</div>
        </div>
      </header>

      <main class="content">
        <NuxtPage v-slot="{ Component, route: pageRoute }">
          <Transition name="page">
            <div v-if="Component" :key="pageRoute.path" class="page-root">
              <component :is="Component" />
            </div>
          </Transition>
        </NuxtPage>
      </main>
    </div>
    </div>

    <AppSiteFooter />

    <FirstLoginOnboarding
      v-if="isAuthenticated && showOnboarding && user"
      :user-name="user.name"
      :user-id="user.id"
      :initial-step="onboardingStep"
      @complete="onOnboardingComplete"
    />
  </div>
</template>

<script setup lang="ts">
const { balance } = useWallet();
const { user, showOnboarding, onboardingStep, authReady, isAuthenticated, restoreSession, logout, finishOnboarding } =
  useAuth();
const { roleLabel } = usePermissions();
const { isAdmin, navItems, switchRole, pageTitle, syncRoleFromAuth, canSwitchRole, isVacationsOnly } =
  usePlatformContext();
const { homePath } = useLaunchScope();
const { appEnv, envLabel } = useAppEnv();

const route = useRoute();
const router = useRouter();
const finishingBitrixLogin = ref(route.query.auth === 'bitrix');

const resolveHomePath = () => homePath(user.value?.role === 'admin');

const clearAuthQuery = () => {
  if (!route.query.auth && !route.query.auth_error) return;
  const { auth: _a, auth_error: _e, ...rest } = route.query;
  router.replace({ path: route.path, query: rest });
};

const handleBitrixReturn = async () => {
  if (route.query.auth !== 'bitrix') return false;

  finishingBitrixLogin.value = true;

  if (!isAuthenticated.value) {
    await restoreSession();
  }

  if (!isAuthenticated.value) {
    finishingBitrixLogin.value = false;
    clearAuthQuery();
    window.location.href = '/api/auth/bitrix';
    return true;
  }

  syncRoleFromAuth();
  await bootstrapAppData();
  clearAuthQuery();
  await router.replace(resolveHomePath());
  finishingBitrixLogin.value = false;
  return true;
};

onMounted(async () => {
  if (!authReady.value) {
    await restoreSession();
  }

  if (await handleBitrixReturn()) {
    return;
  }

  syncRoleFromAuth();
  await bootstrapAppData();
});

const onLoginSuccess = async () => {
  syncRoleFromAuth();
  await bootstrapAppData();
  await router.replace(resolveHomePath());
};

const onOnboardingComplete = (characterId: import('~/composables/useAvatars').AvatarCharacterId) => {
  if (user.value) {
    finishOnboarding(user.value.id, characterId);
  }
};

const handleLogout = () => {
  logout();
};
</script>
