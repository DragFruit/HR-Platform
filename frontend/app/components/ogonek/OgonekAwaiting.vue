<template>
  <div class="og-await">
    <OgonekSprite :rows="OGONEK_DECOR.borderStraight" class="og-await__tile" :width="144" />
    <div>
      <p class="og-await__label">{{ label }}</p>
      <p v-if="text" class="og-await__text">{{ text }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Честная заглушка окна. Выдуманные цифры и программа сюда не подставляются:
 * показать заказчику свою фантазию под видом его данных хуже, чем показать
 * пустое место с подписью.
 */
import { OGONEK_DECOR } from '~/events/ogonek/sprites';

defineProps<{ label: string; text?: string }>();
</script>

<style scoped>
.og-await {
  display: flex;
  gap: 14px;
  align-items: center;
  padding: 14px 16px;
  border: 1px dashed rgba(217, 154, 43, 0.6);
  border-radius: 8px;
  background: rgba(26, 20, 18, 0.32);
}

.og-await__tile { opacity: 0.55; flex: none; }

.og-await__label {
  margin: 0;
  font-weight: 700;
  color: #d99a2b;
  letter-spacing: 0.02em;
}

.og-await__text {
  margin: 4px 0 0;
  font-size: 14px;
  line-height: 1.5;
  color: #e8d7b4;
}

@media (max-width: 600px) {
  .og-await { flex-direction: column; align-items: flex-start; }
}
</style>
