<template>
  <button
    type="button"
    class="vac-overlap-count"
    :aria-expanded="open"
    :title="open ? 'Скрыть таймлайн пересечений' : 'Показать таймлайн пересечений'"
    @click="emit('toggle')"
  >
    пересекается с {{ count }}
    <svg
      class="vac-overlap-count__chevron"
      :class="{ 'is-open': open }"
      viewBox="0 0 12 12"
      width="12"
      height="12"
      aria-hidden="true"
    >
      <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </button>
</template>

<script setup lang="ts">
defineProps<{ count: number; open: boolean }>();
const emit = defineEmits<{ toggle: [] }>();
</script>
