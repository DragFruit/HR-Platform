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
let checkTimer: ReturnType<typeof setInterval> | null = null;

const refresh = () => {
  const next = sectionForRoute(route.path);
  section.value = next;
  startDwell(next);
  showCat.value = canShowCat(next) && !isOccupied.value;
};

const onDone = () => {
  showCat.value = false;
};

watch(
  () => route.path,
  () => {
    refresh();
  },
  { immediate: true }
);

watch(isOccupied, () => {
  showCat.value = canShowCat(section.value) && !isOccupied.value;
});

onMounted(() => {
  refresh();
  // Длительность растёт тиками — периодически перепроверяем порог 1 ч и день окна
  checkTimer = setInterval(() => {
    showCat.value = canShowCat(section.value) && !isOccupied.value;
  }, 15_000);
});

onBeforeUnmount(() => {
  if (checkTimer) clearInterval(checkTimer);
  stopDwell();
});
</script>
