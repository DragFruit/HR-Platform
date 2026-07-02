<template>
  <div v-if="shouldShowPrompt" class="vac-training-prompt">
    <article class="vac-training-prompt__card">
      <p class="vac-training-prompt__eyebrow">Тренировочный полигон</p>
      <h4 class="vac-training-prompt__title">Пройти обучение?</h4>
      <p class="vac-training-prompt__text">
        Короткий квест по заявкам на отпуск.
      </p>
      <button class="button primary vac-training-prompt__start" type="button" @click="startTraining">
        Начать квест
      </button>
      <button class="button ghost vac-training-prompt__skip" type="button" @click="skipTraining">
        Пропустить
      </button>
    </article>

    <svg
      ref="arrowRef"
      class="vac-training-prompt__arrow"
      aria-hidden="true"
      :viewBox="`0 0 ${arrowWidth} ${arrowHeight}`"
      :style="{ height: `${arrowHeight}px` }"
      preserveAspectRatio="none"
    >
      <path
        :d="arrowPath"
        class="vac-training-prompt__arrow-path"
        fill="none"
        stroke="#ec4899"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        pathLength="1"
      />
    </svg>
  </div>
</template>

<script setup lang="ts">
const { shouldShowPrompt, startTraining, skipTraining } = useVacationTraining();

const arrowRef = ref<SVGElement | null>(null);
const arrowWidth = ref(120);
const arrowHeight = ref(72);

const arrowPath = computed(() => {
  const w = arrowWidth.value;
  const h = arrowHeight.value;
  const mid = w * 0.45;
  return `M ${mid} 4 Q ${w * 0.55} ${h * 0.35} ${w * 0.35} ${h * 0.62} T ${w * 0.5} ${h - 6}`;
});

onMounted(() => {
  if (!import.meta.client) return;
  const footer = document.querySelector('.app-site-footer');
  const card = document.querySelector('.vac-training-prompt__card');
  if (!footer || !card) return;

  const footerTop = footer.getBoundingClientRect().top;
  const cardBottom = card.getBoundingClientRect().bottom;
  const gap = Math.max(48, Math.min(140, footerTop - cardBottom - 8));
  arrowHeight.value = gap;
});
</script>
