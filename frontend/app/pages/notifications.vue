<template>
  <section v-if="loading || error || notifications.length" class="card section-card admin-notifications-page">
    <header class="section-head">
      <h3 class="section-title">Уведомления</h3>
      <button
        v-if="unseenCount > 0"
        type="button"
        class="button ghost"
        @click="handleMarkAll"
      >
        Прочитать все
      </button>
    </header>

    <p v-if="loading" class="soft">Загрузка…</p>
    <p v-else-if="error" class="gift-error">{{ error }}</p>

    <ul v-else class="admin-notifications-page list-reset">
      <li
        v-for="item in notifications"
        :key="item.id"
        class="admin-notifications-page__item"
        :class="{ 'admin-notifications-page__item--unseen': !item.seen }"
      >
        <button
          type="button"
          class="admin-notifications-bell__dismiss"
          aria-label="Закрыть уведомление"
          @click="handleDismiss(item)"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
            <path d="M4 4l8 8M12 4 4 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          </svg>
        </button>
        <div class="admin-notifications-page__main">
          <p class="admin-notifications-page__title">{{ formatNotificationTitle(item) }}</p>
          <p class="admin-notifications-page__body">{{ formatNotificationBody(item) }}</p>
          <p class="soft admin-notifications-page__date">{{ formatDate(item.created_at) }}</p>
        </div>
        <div class="admin-notifications-page__actions">
          <button type="button" class="button ghost" @click="goToNotification(item)">
            {{ notificationActionLabel(item) }}
          </button>
          <button
            v-if="!item.seen"
            type="button"
            class="button ghost"
            @click="markSeen(item.id)"
          >
            Прочитано
          </button>
        </div>
      </li>
    </ul>
  </section>

  <EmptyNotificationsSketch v-else />
</template>

<script setup lang="ts">
import type { UserNotification } from '~/composables/useUserNotifications';

const {
  notifications,
  unseenCount,
  loading,
  error,
  loadNotifications,
  markSeen,
  markAllSeen,
  dismiss,
  notificationLink,
  formatNotificationTitle,
  formatNotificationBody,
  formatDate,
  notificationActionLabel
} = useUserNotifications();

const goToNotification = async (item: UserNotification) => {
  if (!item.seen) {
    await markSeen(item.id).catch(() => {});
  }
  await navigateTo(notificationLink(item));
};

const handleDismiss = async (item: UserNotification) => {
  await dismiss(item.id).catch(() => {});
};

const handleMarkAll = async () => {
  await markAllSeen().catch(() => {});
};

onMounted(() => {
  loadNotifications().catch(() => {});
});
</script>
