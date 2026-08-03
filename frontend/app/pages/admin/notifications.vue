<template>
  <section class="creative-hero page-hero">
    <div>
      <p class="eyebrow">Администрирование</p>
      <h2>Уведомления</h2>
      <p class="muted">
        Изменения в Битрикс24, сбои синка отпусков и заявки на юбилейные наборы.
      </p>
    </div>
    <button
      v-if="unseenCount > 0"
      type="button"
      class="button ghost"
      :disabled="loading"
      @click="markAllSeen"
    >
      Прочитать все ({{ unseenCount }})
    </button>
  </section>

  <section v-if="loading || error || notifications.length" class="card section-card">
    <p v-if="loading" class="soft">Загрузка…</p>
    <p v-else-if="error" class="gift-error">{{ error }}</p>

    <ul v-else class="admin-notifications-page list-reset">
      <li
        v-for="item in notifications"
        :key="item.id"
        class="admin-notifications-page__item"
        :class="{ 'admin-notifications-page__item--unseen': !item.admin_seen }"
      >
        <div class="admin-notifications-page__main">
          <p class="admin-notifications-page__title">{{ formatNotificationTitle(item) }}</p>
          <p class="admin-notifications-page__body">{{ formatNotificationBody(item) }}</p>
          <p class="soft admin-notifications-page__date">{{ formatDate(item.created_at) }}</p>
        </div>
        <div class="admin-notifications-page__actions">
          <NuxtLink
            :to="notificationActionTo(item)"
            class="button ghost"
            @click="markIfUnseen(item.id, item.admin_seen)"
          >
            {{ notificationActionLabel(item) }}
          </NuxtLink>
          <button
            v-if="!item.admin_seen"
            type="button"
            class="button primary"
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
  notificationActionLabel,
  notificationActionTo
} = useAdminNotifications();

const markIfUnseen = async (id: string, seen: boolean) => {
  if (!seen) await markSeen(id).catch(() => {});
};

onMounted(() => {
  loadNotifications().catch(() => {});
});
</script>
