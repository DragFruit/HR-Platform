<template>
  <div class="notifications-empty-state" aria-live="polite">
    <img
      class="notifications-empty-state__art"
      :src="illustrationSrc"
      alt=""
      width="1041"
      height="989"
      decoding="async"
    />
    <p class="notifications-empty-state__caption">Новых уведомлений нет</p>
  </div>
</template>

<script setup lang="ts">
const illustrationSrc = '/images/notifications-empty-dragon.png?v=2';
</script>
