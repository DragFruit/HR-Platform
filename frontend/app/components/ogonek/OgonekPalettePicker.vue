<template>
  <div class="og-pal" role="radiogroup" aria-label="Цвет">
    <button
      v-for="c in colors"
      :key="c.ch"
      type="button"
      class="og-pal__swatch"
      :class="{ 'is-active': modelValue === c.ch }"
      :style="{ background: c.color }"
      role="radio"
      :aria-checked="modelValue === c.ch"
      :title="c.label"
      @click="$emit('update:modelValue', c.ch)"
    />
    <button
      type="button"
      class="og-pal__swatch og-pal__swatch--erase"
      :class="{ 'is-active': modelValue === '.' }"
      role="radio"
      :aria-checked="modelValue === '.'"
      title="Стереть"
      @click="$emit('update:modelValue', '.')"
    >
      ✕
    </button>
  </div>
</template>

<script setup lang="ts">
import { OGONEK_COLOR_NAMES, OGONEK_PALETTE, type OgonekColorIndex } from '~/events/ogonek/palette';

defineProps<{ modelValue: string }>();
defineEmits<{ 'update:modelValue': [ch: string] }>();

/** Ровно восемь цветов спеки — других в игрушке быть не должно. */
const colors = OGONEK_PALETTE.map((color, i) => ({
  ch: String(i),
  color,
  label: OGONEK_COLOR_NAMES[i as OgonekColorIndex]
}));
</script>

<style scoped>
.og-pal {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.og-pal__swatch {
  width: 30px;
  height: 30px;
  border: 2px solid rgba(26, 20, 18, 0.6);
  border-radius: 4px;
  cursor: pointer;
  padding: 0;
  transition: transform 0.15s ease, border-color 0.15s ease;
}

.og-pal__swatch:hover {
  transform: translateY(-2px);
}

.og-pal__swatch.is-active {
  border-color: #f5efe3;
  transform: translateY(-2px);
  box-shadow: 0 0 0 2px rgba(217, 154, 43, 0.6);
}

.og-pal__swatch--erase {
  background: repeating-linear-gradient(45deg, #2a2320 0 4px, #1a1412 4px 8px);
  color: #e8d7b4;
  font-size: 13px;
  line-height: 1;
}

@media (prefers-reduced-motion: reduce) {
  .og-pal__swatch { transition: none; }
  .og-pal__swatch:hover { transform: none; }
}
</style>
