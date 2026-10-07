<template>
  <div ref="rootRef" class="admin-notifications-bell">
    <button
      type="button"
      class="admin-notifications-bell__btn"
      :aria-expanded="open"
      aria-haspopup="true"
      aria-label="Уведомления администратора"
      @click="toggleOpen"
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
        <path
          d="M12 3a5 5 0 0 0-5 5v2.2c0 .6-.2 1.2-.6 1.7L5 14.5V16h14v-1.5l-1.4-2.6a2.8 2.8 0 0 1-.6-1.7V8a5 5 0 0 0-5-5Z"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linejoin="round"
        />
        <path d="M10 18a2 2 0 0 0 4 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
      </svg>
      <span v-if="unseenCount > 0" class="admin-notifications-bell__badge">{{ badgeLabel }}</span>
    </button>

    <div v-if="open" class="admin-notifications-bell__panel card" role="dialog" aria-label="Уведомления">
      <div class="admin-notifications-bell__head">
        <strong>Уведомления</strong>
        <button
          v-if="unseenCount > 0"
          type="button"
          class="button ghost admin-notifications-bell__mark-all"
          @click="handleMarkAll"
        >
          Прочитать все
        </button>
      </div>

      <p v-if="loading" class="soft admin-notifications-bell__empty">Загрузка…</p>
      <p v-else-if="!notifications.length" class="soft admin-notifications-bell__empty">
        Новых уведомлений нет
      </p>
      <ul v-else class="admin-notifications-bell__list list-reset">
        <li
          v-for="item in previewItems"
          :key="item.id"
          class="admin-notifications-bell__item"
          :class="{ 'admin-notifications-bell__item--unseen': !item.admin_seen }"
        >
          <p class="admin-notifications-bell__title">{{ formatNotificationTitle(item) }}</p>
          <p class="admin-notifications-bell__body">{{ formatNotificationBody(item) }}</p>
          <a
            v-if="item.kind === 'page_feedback' && item.photo_id"
            class="admin-notifications-bell__photo"
            :href="`/api/knowledge/feedback/photo/${item.photo_id}`"
            target="_blank"
            rel="noopener"
            @click.stop
          >
            <img
              :src="`/api/knowledge/feedback/photo/${item.photo_id}`"
              alt="Фото к оценке"
            />
            Открыть фото
          </a>
          <div class="admin-notifications-bell__meta">
            <span class="soft">{{ formatDate(item.created_at) }}</span>
            <NuxtLink
              :to="notificationActionTo(item)"
              class="admin-notifications-bell__link"
              @click="handleOpenItem(item)"
            >
              {{ notificationActionLabel(item) }}
            </NuxtLink>
          </div>
        </li>
      </ul>

      <NuxtLink
        v-if="notifications.length"
        to="/admin/notifications"
        class="admin-notifications-bell__footer"
        @click="open = false"
      >
        Все уведомления
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
const {
  notifications,
  unseenCount,
  loading,
  loadNotifications,
  markSeen,
  markAllSeen,
  formatNotificationTitle,
  formatNotificationBody,
  formatDate,
  notificationActionLabel,
  notificationActionTo
} = useAdminNotifications();

const open = ref(false);
const rootRef = ref<HTMLElement | null>(null);

const previewItems = computed(() => notifications.value.slice(0, 5));
const badgeLabel = computed(() => (unseenCount.value > 99 ? '99+' : String(unseenCount.value)));

const toggleOpen = async () => {
  open.value = !open.value;
  if (open.value) {
    await loadNotifications().catch(() => {});
  }
};

const handleMarkAll = async () => {
  await markAllSeen().catch(() => {});
};

const handleOpenItem = async (item: (typeof notifications.value)[number]) => {
  if (!item.admin_seen) {
    await markSeen(item.id).catch(() => {});
  }
  open.value = false;
};

const onDocumentClick = (event: MouseEvent) => {
  if (!open.value || !rootRef.value) return;
  if (!rootRef.value.contains(event.target as Node)) {
    open.value = false;
  }
};

onMounted(() => {
  loadNotifications().catch(() => {});
  document.addEventListener('click', onDocumentClick);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick);
});
</script>
