<template>
  <div class="og-pal" role="radiogroup" aria-label="Цвет">
    <div v-for="fam in OGONEK_FAMILIES" :key="fam.id" class="og-pal__family">
      <button
        v-for="tone in tonesOf(fam)"
        :key="tone.key"
        type="button"
        class="og-pal__swatch"
        :class="{ 'is-active': modelValue === tone.key }"
        :style="{ background: OGONEK_PALETTE[tone.key] }"
        role="radio"
        :aria-checked="modelValue === tone.key"
        :title="tone.label"
        @click="$emit('update:modelValue', tone.key)"
      />
    </div>

    <div class="og-pal__family">
      <button
        type="button"
        class="og-pal__swatch"
        :class="{ 'is-active': modelValue === OGONEK_OUTLINE_KEY }"
        :style="{ background: OGONEK_PALETTE[OGONEK_OUTLINE_KEY] }"
        role="radio"
        :aria-checked="modelValue === OGONEK_OUTLINE_KEY"
        title="Контур"
        @click="$emit('update:modelValue', OGONEK_OUTLINE_KEY)"
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
  </div>
</template>

<script setup lang="ts">
/**
 * Палитра для рисования: шесть семейств столбиками, в каждом тень / база /
 * свет сверху вниз. Столбик вместо общей кучи цветов — чтобы человек видел,
 * что тона берутся из одного семейства, и игрушка выходила объёмной, а не
 * пёстрой аппликацией.
 */
import {
  OGONEK_FAMILIES,
  OGONEK_OUTLINE_KEY,
  OGONEK_PALETTE,
  ogonekToneTitle,
  type OgonekTone
} from '~/events/ogonek/palette';

defineProps<{ modelValue: string }>();
defineEmits<{ 'update:modelValue': [ch: string] }>();

type Fam = (typeof OGONEK_FAMILIES)[number];

function tonesOf(fam: Fam) {
  const order: OgonekTone[] = ['light', 'base', 'shadow'];
  return order
    .map((tone) => ({ tone, key: fam.keys[tone] }))
    .filter((t): t is { tone: OgonekTone; key: string } => Boolean(t.key))
    .map((t) => ({ key: t.key, label: ogonekToneTitle(fam, t.tone) }));
}
</script>

<style scoped>
.og-pal {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.og-pal__family {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.og-pal__swatch {
  width: 28px;
  height: 22px;
  border: 2px solid rgba(26, 20, 18, 0.65);
  border-radius: 3px;
  cursor: pointer;
  padding: 0;
  transition: transform 0.15s ease, border-color 0.15s ease;
}

.og-pal__swatch:hover {
  transform: translateX(2px);
}

.og-pal__swatch.is-active {
  border-color: #f5efe3;
  box-shadow: 0 0 0 2px rgba(217, 154, 43, 0.65);
}

.og-pal__swatch--erase {
  background: repeating-linear-gradient(45deg, #2a2320 0 4px, #1a1412 4px 8px);
  color: #e8d7b4;
  font-size: 12px;
  line-height: 1;
}

@media (prefers-reduced-motion: reduce) {
  .og-pal__swatch { transition: none; }
  .og-pal__swatch:hover { transform: none; }
}
</style>
