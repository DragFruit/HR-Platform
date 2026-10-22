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
          <UserAvatar :user-id="userId ?? 0" :name="displayName" :size="32" />
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
  /* iOS HIG: навбар 44pt + safe-area; имя — Headline 17, режим — сегмент 28pt, кнопки 44×44 (визуально 32–36) */
  .mob-top {
    position: sticky;
    top: 0;
    z-index: 30;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    box-sizing: border-box;
    height: calc(44px + env(safe-area-inset-top, 0px));
    /* Ниже Dynamic Island / шторки */
    padding: env(safe-area-inset-top, 0px) 8px 0 16px;
    border-bottom: 1px solid #111;
    background-color: #7451f4;
    background-image: var(--noise-url);
    background-size: 180px 180px;
    color: #fff;
  }

  .mob-top__left {
    min-width: 0;
    flex: 1 1 auto;
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
  }

  .mob-top__hello {
    min-width: 0;
    flex: 0 1 auto;
    margin: 0;
    font-family: var(--font-body);
    font-size: 17px;
    font-weight: 600;
    line-height: 22px;
    letter-spacing: -0.01em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mob-top__roles {
    flex: 0 0 auto;
    display: inline-flex;
    gap: 2px;
    height: 28px;
    padding: 2px;
    box-sizing: border-box;
    border-radius: 9px;
    background: rgba(17, 17, 17, 0.22);
  }

  .mob-top__role {
    position: relative;
    min-height: 0;
    height: 24px;
    padding: 0 8px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: rgba(255, 255, 255, 0.85);
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    line-height: 24px;
  }

  /* Зона нажатия 44pt по высоте при визуальных 24 */
  .mob-top__role::after {
    content: '';
    position: absolute;
    inset: -10px 0;
  }

  .mob-top__role.is-on {
    background: #ddf365;
    color: #111;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.18);
  }

  .mob-top__actions {
    display: flex;
    align-items: center;
    gap: 0;
    flex-shrink: 0;
  }

  /* Колокольчик: 36 визуально, 44 — зона нажатия (поля 4px) */
  .mob-top__actions :deep(.admin-notifications-bell__btn),
  .mob-top__actions :deep(.vac-notifications-bell__btn) {
    width: 36px;
    height: 36px;
    margin: 4px;
    border-width: 1.5px;
  }

  .mob-top__actions :deep(.admin-notifications-bell__btn)::after,
  .mob-top__actions :deep(.vac-notifications-bell__btn)::after {
    content: '';
    position: absolute;
    inset: -5px;
  }

  .mob-top__actions :deep(.admin-notifications-bell__badge) {
    top: -3px;
    right: -3px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    font-size: 10px;
    line-height: 16px;
  }

  .mob-top__profile-stack {
    position: relative;
    width: 44px;
    height: 44px;
  }

  .mob-top__profile {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
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
