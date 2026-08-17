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
      v-if="isAuthenticated && showOnboarding && user && !tenureCelebrationActive"
      :user-name="user.name"
      :user-id="user.id"
      :initial-step="onboardingStep"
      @complete="onOnboardingComplete"
    />

    <PostVacationMemo v-if="isAuthenticated && user && !showOnboarding" />

    <TenureCelebrationOverlay v-if="isAuthenticated && user" />
    <EmployeeVisitingCard v-if="isAuthenticated" />
    <ClientOnly>
      <PageRateCatHost v-if="isAuthenticated" />
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { PLATFORM_NAME } from '~/data/platformBrand';

const { balance } = useWallet();
const { user, showOnboarding, onboardingStep, authReady, isAuthenticated, restoreSession, logout, finishOnboarding } =
  useAuth();
const { isActive: tenureCelebrationActive } = useTenureCelebration();
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
  // Кошелёк открывается из Магазина — подсвечиваем «Магазин»
  if (to === '/store') {
    return (
      route.path === '/store' ||
      route.path.startsWith('/store/') ||
      route.path === '/wallet' ||
      route.path.startsWith('/wallet/')
    );
  }
  return route.path === to || route.path.startsWith(`${to}/`);
};

const resolveHomePath = () => homePath(user.value?.role === 'admin');

const clearAuthQuery = () => {
  if (!route.query.auth && !route.query.auth_error && !route.query.ticket && !route.query.bitrix_notify) {
    return;
  }
  const { auth: _a, auth_error: _e, ticket: _t, bitrix_notify: _n, ...rest } = route.query;
  router.replace({ path: route.path, query: rest });
};

const exchangeBitrixTicket = async () => {
  const raw = route.query.ticket;
  const ticket = Array.isArray(raw) ? String(raw[0] || '') : String(raw || '');
  if (!ticket) return false;
  try {
    const res = await $fetch<{ ok: boolean; user: import('~/composables/useAuth').AuthSessionUser }>(
      '/api/auth/bitrix-ticket',
      { method: 'POST', body: { ticket } }
    );
    if (res.ok && res.user) {
      user.value = res.user;
      if (import.meta.client) {
        localStorage.setItem('vbi-auth-session', JSON.stringify(res.user));
      }
      return true;
    }
  } catch {
    /* ticket spent / expired */
  }
  return false;
};

const restoreSessionWithRetry = async () => {
  for (let attempt = 0; attempt < 4; attempt++) {
    await restoreSession();
    if (isAuthenticated.value) return;
    await new Promise((r) => setTimeout(r, 120 * (attempt + 1)));
  }
};

const handleBitrixReturn = async () => {
  if (route.query.auth !== 'bitrix') return false;

  finishingBitrixLogin.value = true;

  try {
    await exchangeBitrixTicket();

    if (!isAuthenticated.value) {
      await restoreSessionWithRetry();
    }

    if (!isAuthenticated.value) {
      clearAuthQuery();
      await router.replace({
        path: route.path,
        query: {
          auth_error:
            'Сессия после Битрикс не сохранилась. Нажмите «Войти через Битрикс24» ещё раз.'
        }
      });
      return true;
    }

    syncRoleFromAuth();
    // Сначала снимаем экран «Завершаем вход…», bootstrap не должен его блокировать.
    finishingBitrixLogin.value = false;
    clearAuthQuery();
    await router.replace(resolveHomePath());
    await bootstrapAppData();
    return true;
  } finally {
    finishingBitrixLogin.value = false;
  }
};

onMounted(async () => {
  // Всегда заново — ранняя сессия из plugin может быть перетёрта SSR payload.
  await restoreSession();

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
