<template>
  <div class="nk-search">
    <header class="nk-search__head">
      <div>
        <h2 class="nk-search__title">{{ stage.minigame.title }}</h2>
        <p class="nk-search__sub">
          Кабинет Аркадия. Найдите {{ hotspots.length }} предметов.
          Попытка {{ stage.minigame.attempts }} из {{ attemptsTotal }}.
        </p>
      </div>
      <p class="nk-search__timer" :class="{ 'is-low': left <= 15 }" role="timer">
        {{ timerLabel }}
      </p>
    </header>

    <div ref="frameEl" class="nk-search__frame" @pointerdown="onShoot">
      <img
        class="nk-search__bg"
        :src="stage.minigame.background"
        alt="Кабинет Аркадия"
        draggable="false"
      />
      <span
        v-for="h in hotspots"
        v-show="found.includes(h.evidenceId)"
        :key="h.evidenceId"
        class="nk-search__mark"
        :style="{
          left: `${h.x * 100}%`,
          top: `${h.y * 100}%`,
          width: `${h.w * 100}%`,
          height: `${h.h * 100}%`
        }"
      >
        {{ h.label }}
      </span>
      <span
        v-for="m in misses"
        :key="m.id"
        class="nk-search__miss"
        :style="{ left: `${m.x * 100}%`, top: `${m.y * 100}%` }"
        aria-hidden="true"
      />
    </div>

    <footer class="nk-search__foot">
      <ul class="nk-search__checklist">
        <li
          v-for="h in hotspots"
          :key="h.evidenceId"
          :class="{ 'is-found': found.includes(h.evidenceId) }"
        >
          {{ h.label }}
        </li>
      </ul>
      <p v-if="result" class="nk-search__result" role="status">{{ result }}</p>
    </footer>
  </div>
</template>

<script setup lang="ts">
import type { NokturnStageView } from '~/events/nokturn/types';

const props = defineProps<{ stage: NokturnStageView; attemptsTotal: number }>();

const emit = defineEmits<{
  solved: [string[]];
  failed: [];
}>();

const hotspots = computed(() => props.stage.minigame.hotspots);
const total = computed(() => props.stage.minigame.attemptSeconds || 90);

const frameEl = ref<HTMLElement | null>(null);
const found = ref<string[]>([]);
const misses = ref<{ id: number; x: number; y: number }[]>([]);
const left = ref(total.value);
const result = ref('');
const over = ref(false);
let timer: ReturnType<typeof setInterval> | null = null;
let missSeq = 0;

const timerLabel = computed(() => {
  const m = Math.floor(left.value / 60);
  const s = left.value % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
});

function onShoot(e: PointerEvent) {
  if (over.value) return;
  const rect = frameEl.value?.getBoundingClientRect();
  if (!rect || !rect.width || !rect.height) return;
  const x = (e.clientX - rect.left) / rect.width;
  const y = (e.clientY - rect.top) / rect.height;

  const hit = hotspots.value.find(
    (h) => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h
  );
  if (!hit) {
    missSeq += 1;
    const id = missSeq;
    misses.value = [...misses.value, { id, x, y }];
    setTimeout(() => {
      misses.value = misses.value.filter((m) => m.id !== id);
    }, 600);
    return;
  }
  if (found.value.includes(hit.evidenceId)) return;
  found.value = [...found.value, hit.evidenceId];
  if (found.value.length === hotspots.value.length) finish(true);
}

function finish(win: boolean) {
  if (over.value) return;
  over.value = true;
  if (timer) clearInterval(timer);
  timer = null;
  if (win) {
    result.value = `Все предметы изъяты (${hotspots.value.length}). Улики ушли в сейф.`;
    emit('solved', [...found.value]);
  } else {
    result.value = 'Время вышло.';
    emit('failed');
  }
}

onMounted(() => {
  left.value = total.value;
  timer = setInterval(() => {
    left.value -= 1;
    if (left.value <= 0) finish(false);
  }, 1000);
});

onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});
</script>
