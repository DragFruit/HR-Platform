<template>
  <NuxtRouteAnnouncer />

  <div v-if="!authReady" class="auth-loading">Загрузка...</div>

  <AuthLogin v-else-if="!isAuthenticated" @success="onLoginSuccess" />

  <template v-else>
    <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-title">VBI HR Gamification</span>
        <span class="brand-subtitle">
          {{ isAdmin ? 'Панель администратора' : 'Рабочее пространство сотрудника' }}
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
      <header class="topbar">
        <h1>{{ pageTitle }}</h1>
        <div class="topbar-right">
          <span class="soft">{{ user?.name }}</span>
          <span v-if="roleLabel" class="pill role-pill">{{ roleLabel }}</span>
          <div v-if="!isAdmin" class="pill">Баланс: {{ balance }}</div>
          <div v-else class="pill admin-pill">Режим: администрирование</div>
        </div>
      </header>

      <main class="content">
        <NuxtPage />
      </main>
    </div>
    </div>

    <WelcomeCelebration
      v-if="showWelcome && user"
      :user-name="user.name"
      @close="finishWelcome"
    />
  </template>
</template>

<script setup lang="ts">
const { balance } = useWallet();
const { user, showWelcome, authReady, isAuthenticated, restoreSession, logout, markWelcomed } = useAuth();
const { roleLabel } = usePermissions();
const { isAdmin, navItems, switchRole, pageTitle, syncRoleFromAuth, canSwitchRole } = usePlatformContext();

onMounted(() => {
  restoreSession();
  syncRoleFromAuth();
  useEmployees().hydrate();
  useVacations().hydrate();
});

const onLoginSuccess = () => {
  syncRoleFromAuth();
};

const finishWelcome = () => {
  if (user.value) {
    markWelcomed(user.value.id);
  }
};

const handleLogout = () => {
  logout();
};
</script>
