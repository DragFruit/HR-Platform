<script setup lang="ts">
export type MobileNavIconId = 'knowledge' | 'vacation' | 'home' | 'ideas' | 'store';

defineProps<{
  name: MobileNavIconId;
  locked?: boolean;
}>();
</script>

<template>
  <svg class="mob-nav-ico" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <!-- База знаний — книга -->
    <template v-if="name === 'knowledge'">
      <path
        d="M4.5 5.5h6.2c.9 0 1.8.4 2.3 1.1.5-.7 1.4-1.1 2.3-1.1H21.5v12.2c0 .7-.6 1.3-1.3 1.3h-5.4c-.8 0-1.5.3-2 0.9-.5-.6-1.2-.9-2-.9H5.8c-.7 0-1.3-.6-1.3-1.3V5.5Z"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linejoin="round"
      />
      <path d="M12 6.8v11.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
    </template>

    <!-- Отпуск — календарь -->
    <template v-else-if="name === 'vacation'">
      <rect
        x="3.5"
        y="5.5"
        width="17"
        height="15"
        rx="2.5"
        stroke="currentColor"
        stroke-width="1.7"
      />
      <path d="M3.5 10h17" stroke="currentColor" stroke-width="1.7" />
      <path
        d="M8 3.5v4M16 3.5v4"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"
      />
      <rect x="7.2" y="13.2" width="3.2" height="3.2" rx="0.6" fill="currentColor" />
    </template>

    <!-- Главная — дом -->
    <template v-else-if="name === 'home'">
      <path
        d="M4 11.2 12 4.5l8 6.7"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M6.2 10.5V19a1 1 0 0 0 1 1h3.3v-4.2h2.8V20H16.8a1 1 0 0 0 1-1v-8.5"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linejoin="round"
      />
      <g v-if="locked" class="mob-nav-ico__lock">
        <rect x="14.2" y="3.2" width="6.2" height="5" rx="1" fill="var(--accent-lime)" stroke="#111" stroke-width="1.2" />
        <path d="M15.6 3.2V2.4a1.5 1.5 0 0 1 3 0v.8" stroke="#111" stroke-width="1.2" stroke-linecap="round" />
      </g>
    </template>

    <!-- Банк идей — лампочка -->
    <template v-else-if="name === 'ideas'">
      <path
        d="M9.2 16.5h5.6M10 18.8h4M12 3.5a5.2 5.2 0 0 0-3.2 9.3c.6.5 1 1.2 1.1 2h4.2c.1-.8.5-1.5 1.1-2A5.2 5.2 0 0 0 12 3.5Z"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path d="M10.5 13.8h3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
    </template>

    <!-- Магазин — сумка -->
    <template v-else-if="name === 'store'">
      <path
        d="M6.2 9.2h11.6l-.8 9.2a2 2 0 0 1-2 1.8H9a2 2 0 0 1-2-1.8l-.8-9.2Z"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linejoin="round"
      />
      <path
        d="M9 9.2V7.4a3 3 0 0 1 6 0v1.8"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"
      />
      <g v-if="locked" class="mob-nav-ico__lock">
        <rect x="14.2" y="2.8" width="6.2" height="5" rx="1" fill="var(--accent-lime)" stroke="#111" stroke-width="1.2" />
        <path d="M15.6 2.8V2a1.5 1.5 0 0 1 3 0v.8" stroke="#111" stroke-width="1.2" stroke-linecap="round" />
      </g>
    </template>
  </svg>
</template>

<style scoped>
.mob-nav-ico {
  width: 24px;
  height: 24px;
  display: block;
}
.mob-nav-ico__lock {
  pointer-events: none;
}
</style>
