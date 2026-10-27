<template>
  <div v-if="section && showCat" class="page-rate-cat-host" aria-hidden="false">
    <KnowledgeRateCat :page="section.path" :page-label="section.label" @done="onDone" />
  </div>
</template>

<script setup lang="ts">
import type { PageRatingSection } from '~/utils/pageRatingSections';

const route = useRoute();
const { startDwell, stopDwell, canShowCat, sectionForRoute } = usePageRatingGate();
const { isOccupied } = useBottomRightSlot();

const section = ref<PageRatingSection | null>(null);
const showCat = ref(false);
/**
 * Кот уже на экране. Дальше убрать его может только сам человек: оценил или
 * закрыл. Перепроверки гасить его не должны — `markShownThisPeriod()` при
 * монтировании сразу делает `canShowCat()` ложным, и кот пропадал через
 * 15 секунд, не дав поставить оценку.
 */
const sticky = ref(false);
let checkTimer: ReturnType<typeof setInterval> | null = null;

/** Перепроверка может только показать кота, но не спрятать показанного. */
const applyVisibility = () => {
  if (sticky.value) return;
  if (canShowCat(section.value) && !isOccupied.value) {
    showCat.value = true;
    sticky.value = true;
  }
};

const refresh = () => {
  const next = sectionForRoute(route.path);
  section.value = next;
  startDwell(next);
  showCat.value = false;
  sticky.value = false;
  applyVisibility();
};

const onDone = () => {
  showCat.value = false;
  sticky.value = false;
};

watch(
  () => route.path,
  () => {
    refresh();
  },
  { immediate: true }
);

watch(isOccupied, applyVisibility);

onMounted(() => {
  refresh();
  // Длительность растёт тиками — периодически перепроверяем порог 1 ч и день окна
  checkTimer = setInterval(applyVisibility, 15_000);
});

onBeforeUnmount(() => {
  if (checkTimer) clearInterval(checkTimer);
  stopDwell();
});
</script>
