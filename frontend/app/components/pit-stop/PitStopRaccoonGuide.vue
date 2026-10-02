<template>
  <aside v-if="visible" class="ps-raccoon" :class="[`ps-raccoon--${size}`]" aria-label="Рассказчик">
    <img class="ps-raccoon__art" :src="artSrc" alt="" draggable="false" />
    <div class="ps-raccoon__panel">
      <p class="ps-raccoon__bubble" :aria-label="line" @click="revealAll">
        <span aria-hidden="true">{{ shown }}</span><span
          v-if="typing"
          class="ps-raccoon__cursor"
          aria-hidden="true"
        >▌</span>
      </p>
      <div v-if="showNav" class="ps-raccoon__nav">
        <button v-if="canSkip" type="button" class="ps-raccoon__btn ps-raccoon__btn--ghost" @click="emit('skip')">
          Пропустить
        </button>
        <button type="button" class="ps-raccoon__btn" @click="onNext">
          {{ nextLabel }}
        </button>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { RACCOON_BASE_WAIST_SRC } from '~/events/pit-stop-14/raccoonLines';

const props = withDefaults(
  defineProps<{
    line: string;
    visible?: boolean;
    size?: 'hub' | 'cp';
    showNav?: boolean;
    canSkip?: boolean;
    nextLabel?: string;
    artSrc?: string;
    /** Печать по буквам (как у козла в Dota). false — сразу весь текст. */
    typewriter?: boolean;
  }>(),
  {
    visible: true,
    size: 'cp',
    showNav: false,
    canSkip: false,
    nextLabel: 'Дальше',
    artSrc: RACCOON_BASE_WAIST_SRC,
    typewriter: true
  }
);

const emit = defineEmits<{ next: []; skip: [] }>();

/** Средняя скорость набора; каждая точка многоточия — отдельно и медленно. */
const CHAR_MS = 36;
const SPACE_MS = 18;
/** ~0.35 с на точку: «.» … «.» … «.» с явной паузой. */
const ELLIPSIS_DOT_MS = 340;
const PUNCT_MS = 90;

const shown = ref('');
const typing = ref(false);
let timer: ReturnType<typeof setTimeout> | null = null;
let cursor = 0;
/** Текст для набора: «…» развёрнуто в три точки, чтобы печатать по одной. */
let typeText = '';

const clearTimer = () => {
  if (timer != null) {
    clearTimeout(timer);
    timer = null;
  }
};

const prefersReduced = () =>
  import.meta.client && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** «…» → «...», чтобы каждая точка шла своим тиком. */
const expandEllipsis = (s: string) => s.replaceAll('…', '...');

const isEllipsisDot = (full: string, i: number) => {
  if (full[i] !== '.') return false;
  let left = i;
  while (left > 0 && full[left - 1] === '.') left -= 1;
  let right = i;
  while (right + 1 < full.length && full[right + 1] === '.') right += 1;
  return right - left + 1 >= 3;
};

const delayFor = (full: string, i: number) => {
  const ch = full[i] ?? '';
  if (isEllipsisDot(full, i)) return ELLIPSIS_DOT_MS;
  if (ch === ' ' || ch === '\n') return SPACE_MS;
  if (ch === ',' || ch === '—' || ch === '–') return PUNCT_MS;
  if (ch === '!' || ch === '?' || ch === ';' || ch === ':') return PUNCT_MS + 40;
  return CHAR_MS;
};

const tick = () => {
  const full = typeText;
  if (cursor >= full.length) {
    typing.value = false;
    timer = null;
    return;
  }
  cursor += 1;
  shown.value = full.slice(0, cursor);
  if (cursor >= full.length) {
    typing.value = false;
    timer = null;
    return;
  }
  timer = setTimeout(tick, delayFor(full, cursor - 1));
};

const revealAll = () => {
  if (!typing.value) return;
  clearTimer();
  cursor = typeText.length;
  shown.value = typeText;
  typing.value = false;
};

const startTypewriter = () => {
  clearTimer();
  cursor = 0;
  shown.value = '';
  typeText = expandEllipsis(props.line);
  if (!props.typewriter || prefersReduced() || !typeText) {
    shown.value = typeText;
    typing.value = false;
    return;
  }
  typing.value = true;
  timer = setTimeout(tick, CHAR_MS);
};

const onNext = () => {
  if (typing.value) {
    revealAll();
    return;
  }
  emit('next');
};

watch(
  () => [props.line, props.visible, props.artSrc] as const,
  () => {
    if (!props.visible) {
      clearTimer();
      typing.value = false;
      return;
    }
    startTypewriter();
  },
  { immediate: true }
);

onBeforeUnmount(clearTimer);
</script>

<style scoped>
.ps-raccoon {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 12px;
  align-items: end;
  pointer-events: auto;
}
.ps-raccoon__art {
  display: block;
  width: auto;
  height: auto;
  object-fit: contain;
  object-position: bottom center;
  user-select: none;
  pointer-events: none;
  filter: drop-shadow(4px 4px 0 rgba(0, 0, 0, 0.55));
  background: transparent;
}
.ps-raccoon--hub .ps-raccoon__art {
  width: clamp(168px, 28vmin, 280px);
  max-height: clamp(200px, 42vmin, 340px);
}
.ps-raccoon--cp .ps-raccoon__art {
  width: clamp(140px, 22vmin, 220px);
  max-height: clamp(168px, 32vmin, 260px);
}
.ps-raccoon__panel {
  display: grid;
  gap: 8px;
  min-width: 0;
  padding-bottom: 6px;
}
.ps-raccoon__bubble {
  margin: 0;
  padding: 12px 14px;
  font-size: clamp(0.82rem, 2vw, 0.98rem);
  line-height: 1.4;
  font-weight: 600;
  color: #111;
  background: #eeeee8;
  border: 2px solid #111;
  border-radius: 16px 16px 16px 4px;
  box-shadow: 4px 4px 0 #ddf365;
  cursor: pointer;
  min-height: 3.2em;
}
.ps-raccoon__cursor {
  display: inline-block;
  margin-left: 1px;
  color: #7451f4;
  animation: ps-raccoon-blink 0.7s steps(1, end) infinite;
  font-weight: 800;
}
@keyframes ps-raccoon-blink {
  50% {
    opacity: 0;
  }
}
.ps-raccoon__nav {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}
.ps-raccoon__btn {
  min-height: 44px;
  padding: 0 16px;
  border: 2px solid #111;
  border-radius: 12px;
  background: #ddf365;
  color: #111;
  font-weight: 800;
  font-size: 0.85rem;
  cursor: pointer;
  box-shadow: 2px 2px 0 #111;
  touch-action: manipulation;
}
.ps-raccoon__btn--ghost {
  background: transparent;
  color: #eeeee8;
  box-shadow: none;
  border-color: rgba(238, 238, 232, 0.45);
}
.ps-raccoon__btn--ghost:hover {
  border-color: #ddf365;
  color: #ddf365;
}

@media (max-width: 640px) {
  .ps-raccoon {
    grid-template-columns: 1fr;
    justify-items: center;
    text-align: left;
  }
  .ps-raccoon__art {
    justify-self: start;
  }
  .ps-raccoon__panel {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ps-raccoon__cursor {
    animation: none;
  }
}
</style>
