<script setup lang="ts">
defineProps<{
  displayName: string;
  userId?: number | null;
  showBell?: boolean;
  adminBell?: boolean;
  canSwitchRole?: boolean;
  isAdmin?: boolean;
  managerSwitch?: boolean;
  managerMode?: 'manager' | 'employee';
}>();

const emit = defineEmits<{
  switchRole: [role: 'employee' | 'admin'];
  switchManagerMode: [mode: 'manager' | 'employee'];
}>();
</script>

<template>
  <header class="mob-top" aria-label="Шапка">
    <div class="mob-top__left">
      <p class="mob-top__hello">{{ displayName }}</p>
      <div v-if="canSwitchRole" class="mob-top__roles" role="group" aria-label="Режим">
        <button
          type="button"
          class="mob-top__role"
          :class="{ 'is-on': !isAdmin }"
          @click="emit('switchRole', 'employee')"
        >
          Я
        </button>
        <button
          type="button"
          class="mob-top__role"
          :class="{ 'is-on': isAdmin }"
          @click="emit('switchRole', 'admin')"
        >
          Админ
        </button>
      </div>
      <div v-else-if="managerSwitch" class="mob-top__roles" role="group" aria-label="Режим отпусков">
        <button
          type="button"
          class="mob-top__role"
          :class="{ 'is-on': managerMode === 'employee' }"
          @click="emit('switchManagerMode', 'employee')"
        >
          Я
        </button>
        <button
          type="button"
          class="mob-top__role"
          :class="{ 'is-on': managerMode !== 'employee' }"
          @click="emit('switchManagerMode', 'manager')"
        >
          Руководитель
        </button>
      </div>
    </div>

    <div class="mob-top__actions">
      <AdminNotificationsBell v-if="adminBell" />
      <VacationNotificationsBell v-else-if="showBell" />

      <div class="mob-top__profile-stack">
        <NuxtLink
          to="/profile"
          class="mob-top__profile"
          :aria-label="`Профиль: ${displayName}`"
        >
          <UserAvatar :user-id="userId ?? 0" :name="displayName" :size="36" />
        </NuxtLink>
      </div>
    </div>
  </header>
</template>

<style scoped>
.mob-top {
  display: none;
}

@media (max-width: 900px) {
  .mob-top {
    position: sticky;
    top: 0;
    z-index: 30;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    min-height: 52px;
    /* Ниже Dynamic Island / шторки */
    padding: calc(10px + env(safe-area-inset-top, 0px)) 14px 10px;
    border-bottom: 2px solid #111;
    background-color: #7451f4;
    background-image: var(--noise-url);
    background-size: 180px 180px;
    color: #fff;
  }

  .mob-top__left {
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-self: stretch;
    gap: 3px;
  }

  .mob-top__hello {
    margin: 0;
    font-family: Unbounded, 'Golos Text', sans-serif;
    font-size: 0.92rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mob-top__roles {
    display: inline-flex;
    gap: 3px;
  }

  .mob-top__role {
    min-height: 22px;
    padding: 1px 7px;
    border: 1px solid rgba(255, 255, 255, 0.45);
    border-radius: 999px;
    background: transparent;
    color: rgba(255, 255, 255, 0.8);
    font: inherit;
    font-size: 0.64rem;
    font-weight: 700;
  }

  .mob-top__role.is-on {
    background: #ddf365;
    border-color: #111;
    color: #111;
  }

  .mob-top__actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  /* Только кнопка-колокольчик: раньше :deep(button) делал 40×40 и кнопки внутри панели уведомлений */
  .mob-top__actions :deep(.admin-notifications-bell__btn),
  .mob-top__actions :deep(.vac-notifications-bell__btn) {
    width: 40px;
    height: 40px;
  }

  .mob-top__profile-stack {
    position: relative;
    width: 40px;
    height: 40px;
  }

  .mob-top__profile {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: 999px;
    border: none;
    background: transparent;
    box-shadow: none;
    overflow: hidden;
  }

  .mob-top__profile :deep(img),
  .mob-top__profile :deep(.user-avatar),
  .mob-top__profile :deep(.user-avatar__img) {
    border: none !important;
    box-shadow: none !important;
  }

}
</style>
