<template>
  <aside v-if="visible" class="kb-rate-cat" aria-label="Оценка страницы">
    <div
      ref="slideRef"
      class="kb-rate-cat__slide"
      :class="{ 'is-parked': parked, 'is-out': leaving }"
    >
      <div
        v-if="step === 'thanks' || step === 'comment'"
        class="kb-rate-cat__panel"
        :class="{ 'is-comment': step === 'comment' }"
      >
        <p class="kb-rate-cat__thanks">Спасибо!</p>
        <form v-if="step === 'comment'" class="kb-rate-cat__form" @submit.prevent="sendFeedback">
          <div
            class="kb-rate-cat__comment-wrap"
            :style="commentHeight ? { height: `${commentHeight}px` } : undefined"
          >
            <textarea
              v-model="comment"
              class="kb-rate-cat__comment"
              rows="2"
              maxlength="2000"
              placeholder="Как можно улучшить этот раздел?"
            />
            <button
              type="button"
              class="kb-rate-cat__resize"
              aria-label="Растянуть поле вверх"
              @pointerdown="onCommentResizeStart"
            />
          </div>
          <div class="kb-rate-cat__actions">
            <input
              ref="photoInputRef"
              class="kb-rate-cat__photo-input"
              type="file"
              accept="image/*"
              capture="environment"
              @change="onPhotoPicked"
            />
            <button
              type="button"
              class="kb-rate-cat__photo-btn"
              :class="{ 'is-on': Boolean(photoPreview) }"
              :aria-label="photoPreview ? 'Заменить фото' : 'Добавить фото'"
              @click="photoInputRef?.click()"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M16.5 7.5v7.2a4.5 4.5 0 0 1-9 0V6.8a3 3 0 0 1 6 0v7.4a1.5 1.5 0 0 1-3 0V7.5"
                />
              </svg>
            </button>
            <div v-if="photoPreview" class="kb-rate-cat__photo-preview">
              <img :src="photoPreview" alt="" />
              <button
                type="button"
                class="kb-rate-cat__photo-clear"
                aria-label="Убрать фото"
                @click="clearPhoto"
              >
                ×
              </button>
            </div>
            <button type="submit" class="kb-rate-cat__send" :disabled="sending">
              {{ sending ? 'Отправка…' : 'Отправить' }}
            </button>
          </div>
        </form>
      </div>

      <div
        ref="stageRef"
        class="kb-rate-cat__stage"
        :class="{ 'is-ready': ready, [`is-${step}`]: true }"
      >
        <p v-if="ready && step === 'stars'" class="kb-rate-cat__ask">
          Оцените удобство этой страницы, пожалуйста
        </p>
        <video
          ref="videoRef"
          class="kb-rate-cat__video"
          muted
          playsinline
          preload="auto"
          @ended="onEnded"
        />
        <img
          class="kb-rate-cat__tail"
          src="/knowledge/rating-paper-tail.png"
          alt=""
          width="106"
          height="180"
          draggable="false"
        />
        <div
          class="kb-rate-cat__paper"
          :class="{ 'is-live': ready }"
          role="group"
          aria-label="Оценка от 1 до 5"
        >
          <button
            v-for="n in 5"
            :key="n"
            type="button"
            class="kb-rate-cat__star"
            :class="{ 'is-on': n <= (hover || stars) }"
            :disabled="!ready || step !== 'stars'"
            :aria-label="`${n} из 5`"
            @mouseenter="hover = n"
            @mouseleave="hover = 0"
            @click="pickStars(n)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 2.4l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.2 6.2 20.3l1.1-6.5L2.6 9.2l6.5-.9L12 2.4z"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
const props = defineProps<{
  page: string;
  pageLabel?: string;
}>();

const emit = defineEmits<{ done: [] }>();

const { markRatedThisPeriod, markShownThisPeriod } = usePageRatingGate();

const RATE_WALK_END_SEC = 2.8;
const RATE_STAGE_W = 944;
const RATE_STAGE_H = 720;
const RATE_TAIL_W = 106;
const RATE_TAIL_OVERLAP = 16;
const RATE_NOTCH = 52;
const RATE_PAPER_KEYS: number[][] = [
  [0, 439, 319, 791, 471],
  [0.0667, 438, 316, 791, 468],
  [0.1333, 440, 306, 790, 459],
  [0.2, 441, 317, 793, 468],
  [0.2667, 443, 359, 801, 511],
  [0.3333, 444, 356, 803, 507],
  [0.4, 445, 349, 803, 501],
  [0.4667, 446, 339, 804, 490],
  [0.5333, 446, 329, 804, 481],
  [0.6, 447, 325, 804, 476],
  [0.6667, 448, 313, 804, 466],
  [0.7333, 448, 310, 804, 463],
  [0.8, 451, 326, 810, 479],
  [0.8667, 452, 348, 814, 501],
  [0.9333, 455, 355, 818, 509],
  [1, 456, 343, 821, 497],
  [1.0667, 458, 332, 820, 486],
  [1.1333, 460, 326, 822, 480],
  [1.2, 462, 316, 822, 472],
  [1.2667, 465, 315, 825, 471],
  [1.3333, 469, 355, 837, 510],
  [1.4, 471, 359, 838, 515],
  [1.4667, 473, 349, 839, 507],
  [1.5333, 474, 333, 841, 490],
  [1.6, 476, 319, 841, 475],
  [1.6667, 481, 322, 847, 479],
  [1.7333, 483, 341, 847, 498],
  [1.8, 488, 364, 847, 521],
  [1.8667, 489, 357, 847, 515],
  [1.9333, 493, 339, 847, 495],
  [2, 496, 326, 847, 484],
  [2.0667, 498, 319, 847, 477],
  [2.1333, 502, 319, 847, 478],
  [2.2, 505, 343, 847, 501],
  [2.2667, 509, 365, 847, 523],
  [2.3333, 513, 355, 847, 514],
  [2.4, 516, 345, 847, 505],
  [2.4667, 521, 343, 847, 502],
  [2.5333, 524, 331, 847, 492],
  [2.6, 531, 328, 847, 490],
  [2.6667, 538, 355, 847, 516],
  [2.7333, 541, 363, 847, 525],
  [2.8, 551, 374, 847, 535],
  [2.8667, 557, 364, 847, 527],
  [2.9333, 567, 356, 847, 520],
  [3, 578, 355, 847, 518],
  [3.0667, 582, 353, 847, 517],
  [3.1333, 593, 352, 847, 517],
  [3.2, 596, 363, 847, 528],
  [3.2667, 596, 385, 847, 553],
  [3.3333, 596, 392, 847, 562],
  [3.4, 596, 392, 847, 562],
  [3.4667, 596, 391, 847, 562]
];

type RateStep = 'stars' | 'thanks' | 'comment';

const visible = ref(false);
const ready = ref(false);
const parked = ref(false);
const leaving = ref(false);
const step = ref<RateStep>('stars');
const stars = ref(0);
const hover = ref(0);
const comment = ref('');
const commentHeight = ref<number | null>(null);
const photoFile = ref<File | null>(null);
const photoPreview = ref('');
const photoInputRef = ref<HTMLInputElement | null>(null);
const sending = ref(false);
const videoRef = ref<HTMLVideoElement | null>(null);
const stageRef = ref<HTMLElement | null>(null);
const slideRef = ref<HTMLElement | null>(null);

let hideTimer: ReturnType<typeof setTimeout> | null = null;
let showTimer: ReturnType<typeof setTimeout> | null = null;
let raf = 0;
let syncing = false;
let lastT = 0;
let minPct = 100;
let resizeStartY = 0;
let resizeStartH = 0;
let resizeMove: ((ev: PointerEvent) => void) | null = null;
let resizeUp: (() => void) | null = null;

const stopCommentResize = () => {
  if (resizeMove) window.removeEventListener('pointermove', resizeMove);
  if (resizeUp) window.removeEventListener('pointerup', resizeUp);
  resizeMove = null;
  resizeUp = null;
};

/** Тянем верхний правый угол внутреннего поля — растёт вверх, низ пузыря/хвостик на месте. */
const onCommentResizeStart = (event: PointerEvent) => {
  if (step.value !== 'comment') return;
  const wrap = (event.currentTarget as HTMLElement | null)?.closest('.kb-rate-cat__comment-wrap');
  if (!wrap) return;
  event.preventDefault();
  stopCommentResize();
  resizeStartY = event.clientY;
  resizeStartH = wrap.getBoundingClientRect().height;
  commentHeight.value = resizeStartH;
  resizeMove = (ev: PointerEvent) => {
    const next = resizeStartH + (resizeStartY - ev.clientY);
    commentHeight.value = Math.min(280, Math.max(56, next));
  };
  resizeUp = () => stopCommentResize();
  window.addEventListener('pointermove', resizeMove);
  window.addEventListener('pointerup', resizeUp);
};

function lerpPaper(t: number): number[] {
  const keys = RATE_PAPER_KEYS;
  if (t <= keys[0][0]) return keys[0];
  const last = keys[keys.length - 1];
  if (t >= last[0]) return last;
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const a = keys[i - 1];
      const b = keys[i];
      const p = (t - a[0]) / (b[0] - a[0] || 1);
      return a.map((v, idx) => v + (b[idx] - v) * p);
    }
  }
  return last;
}

function paperCssVars(box: number[]): Record<string, string> {
  const left = box[1];
  const top = box[2];
  const right = box[3];
  const bot = box[4];
  const join = right - RATE_TAIL_OVERLAP;
  const ph = bot - top;
  const starLeft = left + ph * 0.22;
  const starRight = join + RATE_TAIL_W - RATE_NOTCH - ph * 0.12;
  const starTop = top + ph * 0.16;
  const starH = ph * 0.68;
  const pct = (n: number, den: number) => `${((n / den) * 100).toFixed(3)}%`;
  return {
    '--tail-left': pct(join, RATE_STAGE_W),
    '--tail-top': pct(top - 1, RATE_STAGE_H),
    '--tail-h': pct(ph + 2, RATE_STAGE_H),
    '--stars-left': pct(starLeft, RATE_STAGE_W),
    '--stars-top': pct(starTop, RATE_STAGE_H),
    '--stars-w': pct(Math.max(8, starRight - starLeft), RATE_STAGE_W),
    '--stars-h': pct(starH, RATE_STAGE_H)
  };
}

const syncPaper = (t: number) => {
  const el = stageRef.value;
  if (!el) return;
  const vars = paperCssVars(lerpPaper(t));
  for (const [key, value] of Object.entries(vars)) {
    el.style.setProperty(key, value);
  }
};

const applyWalk = (t: number) => {
  const host = slideRef.value;
  if (!host || leaving.value) return;
  lastT = Math.max(lastT, t);
  if (parked.value || lastT >= RATE_WALK_END_SEC) {
    host.style.transform = 'translateX(0)';
    if (!parked.value) parked.value = true;
    return;
  }
  let pct = (1 - lastT / RATE_WALK_END_SEC) * 100;
  if (pct > minPct) pct = minPct;
  else minPct = pct;
  host.style.transform = `translateX(${pct.toFixed(3)}%)`;
};

const syncFrame = (t: number) => {
  applyWalk(t);
  syncPaper(t);
};

const stopSync = () => {
  syncing = false;
  if (raf) {
    cancelAnimationFrame(raf);
    raf = 0;
  }
};

const loopSync = (_now?: number, meta?: { mediaTime: number }) => {
  if (!syncing) return;
  const video = videoRef.value;
  const t = Math.max(lastT, meta?.mediaTime ?? 0, video?.currentTime ?? 0);
  syncFrame(t);
  if (!video || video.ended) {
    syncing = false;
    return;
  }
  if (typeof video.requestVideoFrameCallback === 'function') {
    video.requestVideoFrameCallback(loopSync);
    return;
  }
  raf = requestAnimationFrame(loopSync);
};

const startSync = () => {
  stopSync();
  syncing = true;
  loopSync();
};

const hide = () => {
  leaving.value = true;
  parked.value = true;
  stopSync();
  hideTimer = setTimeout(() => {
    visible.value = false;
    emit('done');
  }, 1100);
};

const onEnded = () => {
  stopSync();
  syncFrame(RATE_PAPER_KEYS[RATE_PAPER_KEYS.length - 1][0]);
  parked.value = true;
  ready.value = true;
};

const playVideo = async () => {
  await nextTick();
  const video = videoRef.value;
  const host = slideRef.value;
  if (!video) return;
  lastT = 0;
  minPct = 100;
  parked.value = false;
  leaving.value = false;
  if (host) {
    host.style.transition = 'none';
    host.style.transform = 'translateX(100%)';
  }
  syncPaper(0);
  try {
    if (!video.src) video.src = '/knowledge/rating-cat.webm';
    video.pause();
    video.currentTime = 0;
    await video.play();
    startSync();
  } catch (err) {
    console.warn('[knowledge] rating video play failed:', err);
    if (host) host.style.transform = 'translateX(0)';
    parked.value = true;
    ready.value = true;
  }
};

const clearPhoto = () => {
  if (photoPreview.value) URL.revokeObjectURL(photoPreview.value);
  photoPreview.value = '';
  photoFile.value = null;
  if (photoInputRef.value) photoInputRef.value.value = '';
};

const onPhotoPicked = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] || null;
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    clearPhoto();
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    clearPhoto();
    return;
  }
  if (photoPreview.value) URL.revokeObjectURL(photoPreview.value);
  photoFile.value = file;
  photoPreview.value = URL.createObjectURL(file);
};

const submitRating = async (text: string) => {
  markRatedThisPeriod();
  try {
    if (photoFile.value) {
      const form = new FormData();
      form.set('stars', String(stars.value));
      form.set('comment', text);
      form.set('page', props.page);
      form.set('page_label', props.pageLabel || props.page);
      form.set('photo', photoFile.value, photoFile.value.name || 'photo.jpg');
      await $fetch('/api/knowledge/feedback', { method: 'POST', body: form });
    } else {
      await $fetch('/api/knowledge/feedback', {
        method: 'POST',
        body: {
          stars: stars.value,
          comment: text,
          page: props.page,
          page_label: props.pageLabel || props.page
        }
      });
    }
  } catch (err) {
    console.warn('[page-rating] feedback failed:', err);
  }
};

const pickStars = async (n: number) => {
  if (!ready.value || step.value !== 'stars') return;
  stars.value = n;
  if (n >= 5) {
    step.value = 'thanks';
    await submitRating('');
    hideTimer = setTimeout(hide, 1600);
    return;
  }
  step.value = 'comment';
  commentHeight.value = null;
  clearPhoto();
};

const sendFeedback = async () => {
  if (sending.value) return;
  sending.value = true;
  try {
    await submitRating(comment.value.trim());
    step.value = 'thanks';
    commentHeight.value = null;
    clearPhoto();
    hideTimer = setTimeout(hide, 1200);
  } finally {
    sending.value = false;
  }
};

onMounted(() => {
  markShownThisPeriod();
  showTimer = setTimeout(() => {
    visible.value = true;
    ready.value = false;
    step.value = 'stars';
    playVideo();
  }, 900);
});

onBeforeUnmount(() => {
  if (hideTimer) clearTimeout(hideTimer);
  if (showTimer) clearTimeout(showTimer);
  stopCommentResize();
  stopSync();
  clearPhoto();
});
</script>
