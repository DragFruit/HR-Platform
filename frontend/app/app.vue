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
        <span class="brand-title">{{ platformName }}</span>
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
          <NuxtLink
            v-if="!item.locked"
            :to="item.to"
            class="nav-link"
            :class="{ 'router-link-active': isNavItemActive(item.to) }"
          >
            {{ item.label }}
          </NuxtLink>
          <span
            v-else
            class="nav-link nav-link--locked"
            role="link"
            aria-disabled="true"
            :title="lockedNavHint"
          >
            <span class="nav-link__label">{{ item.label }}</span>
            <svg class="nav-link__lock" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M4.5 7V5a3.5 3.5 0 1 1 7 0v2"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
              />
              <rect
                x="3.25"
                y="7"
                width="9.5"
                height="6.75"
                rx="1.5"
                stroke="currentColor"
                stroke-width="1.5"
              />
            </svg>
          </span>
        </li>
      </ul>

      <button class="button ghost logout-btn" type="button" @click="handleLogout">Выйти</button>
    </aside>

    <div class="shell-main">
      <header class="topbar">
        <h1>{{ pageTitle }}</h1>
        <div class="topbar-right">
          <AdminNotificationsBell v-if="showAdminNotificationsBell" />
          <VacationNotificationsBell v-else />
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
import { PLATFORM_NAME } from '~/data/platformBrand';

const { balance } = useWallet();
const { user, showOnboarding, onboardingStep, authReady, isAuthenticated, restoreSession, logout, finishOnboarding } =
  useAuth();
const { roleLabel } = usePermissions();
const { isAdmin, navItems, switchRole, pageTitle, syncRoleFromAuth, canSwitchRole, isVacationsOnly } =
  usePlatformContext();
const { homePath } = useLaunchScope();
const platformName = PLATFORM_NAME;

const lockedNavHint = 'Раздел скоро откроется';

const showAdminNotificationsBell = computed(
  () => isAdmin.value || user.value?.role === 'hr'
);

const route = useRoute();
const router = useRouter();
const finishingBitrixLogin = ref(route.query.auth === 'bitrix');

const isNavItemActive = (to: string) => {
  if (to === '/') return route.path === '/';
  if (to === '/profile') return route.path === '/profile' || route.path.startsWith('/profile/');
  return route.path === to || route.path.startsWith(`${to}/`);
};

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
    await router.replace({
      path: route.path,
      query: { auth_error: 'Сессия после Битрикс не сохранилась. Нажмите «Войти через Битрикс24» ещё раз.' }
    });
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
