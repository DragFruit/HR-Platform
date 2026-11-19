<template>
  <div class="ogsc" role="radiogroup" aria-label="Формат Тайного Санты">
    <button
      v-for="f in FORMATS"
      :key="f.id"
      type="button"
      role="radio"
      class="ogsc__card"
      :class="{ 'is-on': modelValue === f.id }"
      :aria-checked="modelValue === f.id"
      :disabled="disabled"
      @click="$emit('pick', modelValue === f.id ? '' : f.id)"
    >
      <span class="ogsc__icon" aria-hidden="true">{{ f.icon }}</span>
      <span class="ogsc__title">{{ f.title }}</span>
      <span class="ogsc__lead">{{ f.lead }}</span>
      <ul class="ogsc__points">
        <li v-for="pt in f.points" :key="pt">{{ pt }}</li>
      </ul>
      <span class="ogsc__foot">
        <span>{{ counts?.[f.id] ?? 0 }} {{ word(counts?.[f.id] ?? 0) }}</span>
        <span class="ogsc__state">{{ modelValue === f.id ? 'Вы здесь · выйти' : 'Выбрать' }}</span>
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
/**
 * Выбор формата Тайного Санты: классический или «Белый слон». Одна и та же
 * карточка в окне 2 и на странице Санты. Повторный клик по выбранному —
 * выйти из игры.
 */
import { OGONEK_SANTA_FORMATS as FORMATS } from '~/events/ogonek/santa';

defineProps<{
  modelValue: string;
  counts?: Record<string, number>;
  disabled?: boolean;
}>();
defineEmits<{ pick: [format: string] }>();

function word(n: number) {
  const d = n % 10;
  const dd = n % 100;
  if (d === 1 && dd !== 11) return 'участник';
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return 'участника';
  return 'участников';
}
</script>

<style scoped>
.ogsc {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.ogsc__card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: left;
  padding: 16px 16px 14px;
  background: var(--og-paper, #f3efe9);
  color: #2a1216;
  border: 2px solid transparent;
  box-shadow: 5px 5px 0 var(--og-shade, #1c0307);
  font: inherit;
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease;
}
.ogsc__card:hover:not(:disabled) { transform: translateY(-2px); }
.ogsc__card:disabled { cursor: not-allowed; opacity: 0.7; }
.ogsc__card.is-on { border-color: var(--og-gold, #ffcf4a); box-shadow: 5px 5px 0 #6b2a00, 0 0 0 3px rgba(255, 207, 74, 0.35); }

.ogsc__icon { font-size: 26px; line-height: 1; }
.ogsc__title { font-family: var(--og-pixel); font-size: 11px; line-height: 1.5; color: #8c1d2b; }
.ogsc__lead { font-size: 15px; line-height: 1.4; }
.ogsc__points { margin: 0; padding-left: 18px; font-size: 14px; line-height: 1.4; color: #5a3a3e; }
.ogsc__foot {
  margin-top: auto;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px dashed rgba(42, 18, 22, 0.25);
  font-size: 13px;
  color: #7a5a5e;
}
.ogsc__state { font-weight: 700; color: #8c1d2b; }
.ogsc__card.is-on .ogsc__state { color: #2f6b3a; }

@media (max-width: 700px) {
  .ogsc { grid-template-columns: 1fr; }
}
</style>
