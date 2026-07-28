<template>
  <article class="tenure-gift-banner" :data-years="years" aria-label="Юбилейный набор">
    <div class="tenure-gift-banner__shot">
      <img
        class="tenure-gift-banner__art"
        :src="bannerSrc"
        :alt="`Купон: набор ${years} лет`"
        width="1024"
        height="536"
        draggable="false"
      />

      <button
        type="button"
        class="tenure-gift-banner__hit"
        :class="{ 'tenure-gift-banner__hit--pressed': pressed }"
        :disabled="disabled"
        :aria-busy="disabled"
        aria-label="Использовать купон"
        @pointerdown="pressed = true"
        @pointerup="pressed = false"
        @pointercancel="pressed = false"
        @pointerleave="pressed = false"
        @click="emit('use')"
      />
    </div>
  </article>
</template>

<script setup lang="ts">
import type { TenureGiftYears } from '~/utils/tenureAnniversary';

const props = defineProps<{
  years: TenureGiftYears;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  use: [];
}>();

const pressed = ref(false);

const BANNER_BY_YEARS: Partial<Record<TenureGiftYears, string>> = {
  /** v=18 — эталонный купон (~3:2) в первой карточке каталога */
  5: '/store/tenure-gift-banner-5y.png?v=18'
};

const bannerSrc = computed(
  () => BANNER_BY_YEARS[props.years] ?? BANNER_BY_YEARS[5]!
);
</script>
