<template>
  <section v-if="loading || error || notifications.length" class="card section-card admin-notifications-page">
    <header class="section-head">
      <h3 class="section-title">Уведомления по отпускам</h3>
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
        <div class="admin-notifications-page__main">
          <p class="admin-notifications-page__title">{{ formatNotificationTitle(item) }}</p>
          <p class="admin-notifications-page__body">{{ formatNotificationBody(item) }}</p>
          <p class="soft admin-notifications-page__date">{{ formatDate(item.created_at) }}</p>
        </div>
        <div class="admin-notifications-page__actions">
          <NuxtLink to="/vacations" class="button ghost" @click="handleOpen(item)">
            {{ isManagerAction(item) ? 'Согласование' : 'Открыть отпуска' }}
          </NuxtLink>
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
  formatNotificationTitle,
  formatNotificationBody,
  formatDate,
  isManagerAction
} = useUserNotifications();

const handleOpen = async (item: UserNotification) => {
  if (!item.seen) {
    await markSeen(item.id).catch(() => {});
  }
};

const handleMarkAll = async () => {
  await markAllSeen().catch(() => {});
};

onMounted(() => {
  loadNotifications().catch(() => {});
});
</script>
