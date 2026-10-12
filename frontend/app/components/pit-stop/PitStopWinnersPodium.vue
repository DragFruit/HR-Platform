<template>
  <div class="ps-podium" role="img" :aria-label="ariaLabel">
    <img
      class="ps-podium__bg"
      :src="PODIUM_IMG"
      alt=""
      width="1280"
      height="720"
      draggable="false"
    />
    <div class="ps-podium__title-patch" aria-hidden="true" />
    <div class="ps-podium__flag ps-podium__flag--left" aria-hidden="true">
      <video
        ref="flagVideoLeft"
        class="ps-podium__flag-video"
        :src="FLAG_VIDEO"
        autoplay
        muted
        playsinline
      />
    </div>
    <div class="ps-podium__flag ps-podium__flag--right" aria-hidden="true">
      <video
        ref="flagVideoRight"
        class="ps-podium__flag-video"
        :src="FLAG_VIDEO"
        autoplay
        muted
        playsinline
      />
    </div>
    <div
      v-for="slot in slots"
      :key="slot.rank"
      class="ps-podium__slot"
      :class="`is-r${slot.rank}`"
      :style="slot.style"
    >
      <div class="ps-podium__face">
        <img
          v-if="slot.winner && WINNER_PHOTOS[slot.winner.userId]"
          class="ps-podium__avatar ps-podium__photo"
          :src="WINNER_PHOTOS[slot.winner.userId]"
          :alt="slot.winner.name"
          draggable="false"
        />
        <UserAvatar
          v-else-if="slot.winner"
          class="ps-podium__avatar"
          :user-id="slot.winner.userId"
          :name="slot.winner.name"
          :size="240"
        />
        <span v-else class="ps-podium__empty" aria-hidden="true" />
      </div>
      <div v-if="slot.winner" class="ps-podium__label">
        <span class="ps-podium__name">{{ slot.winner.name }}</span>
        <span class="ps-podium__time">{{ formatLapMs(slot.winner.bestMs) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Ref } from 'vue';
import { formatLapMs } from '~/events/pit-stop-14/trackDrive';

/**
 * Геометрия кругов под маску — % от кадра 1280×720.
 * Перемерено по пикселям самого winners-podium.jpg (поиск внутренней тёмной
 * области каждой рамки): прежние d были занижены, из-за чего между фото и
 * рамкой оставался зазор фона.
 */
const FACE_LAYOUT: Record<1 | 2 | 3, { cx: number; cy: number; d: number }> = {
  1: { cx: 49.96, cy: 33.82, d: 17.2 },
  2: { cx: 27.54, cy: 59.03, d: 16.9 },
  3: { cx: 71.84, cy: 58.82, d: 17.4 }
};

export type PodiumWinner = {
  userId: number;
  rank: number;
  name: string;
  bestMs: number;
};

/** Реальные фото финализированных победителей Pit Stop (перекрывают generic-аватар). */
const WINNER_PHOTOS: Record<number, string> = {
  2533: '/events/pit-stop-14/winners/rank-1.jpg',
  2680: '/events/pit-stop-14/winners/rank-2.jpg',
  2697: '/events/pit-stop-14/winners/rank-3.jpg'
};

const props = defineProps<{
  winners: PodiumWinner[];
}>();

const PODIUM_IMG = '/events/pit-stop-14/winners-podium.jpg?v=2';
const FLAG_VIDEO = '/events/pit-stop-14/flag-anim.webm?v=1';

const flagVideoLeft = ref<HTMLVideoElement | null>(null);
const flagVideoRight = ref<HTMLVideoElement | null>(null);

/**
 * flag-anim.webm не зациклен бесшовно (последний кадр ≠ первому), поэтому
 * нативный `loop` даёт заметный рывок. Вместо этого — пинг-понг: доиграли
 * вперёд до конца → вручную отматываем currentTime назад кадр за кадром
 * через rAF → дошли до 0 → снова .play() вперёд. Для каждого флага —
 * независимый контроллер (левый/правый могут разойтись по фазе, это ок).
 */
function createPingPong(videoRef: Ref<HTMLVideoElement | null>) {
  let rafId: number | null = null;
  let lastTs: number | null = null;

  const stepReverse = (ts: number) => {
    const video = videoRef.value;
    if (!video) return;
    if (lastTs === null) lastTs = ts;
    const deltaSec = Math.max(0, (ts - lastTs) / 1000);
    lastTs = ts;
    const next = video.currentTime - deltaSec;
    if (next <= 0) {
      video.currentTime = 0;
      lastTs = null;
      rafId = null;
      void video.play().catch(() => {});
      return;
    }
    video.currentTime = next;
    rafId = requestAnimationFrame(stepReverse);
  };

  const onEnded = () => {
    const video = videoRef.value;
    if (!video) return;
    video.pause();
    lastTs = null;
    rafId = requestAnimationFrame(stepReverse);
  };

  const stop = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    lastTs = null;
  };

  return { onEnded, stop };
}

const pingPongLeft = createPingPong(flagVideoLeft);
const pingPongRight = createPingPong(flagVideoRight);

onMounted(() => {
  if (typeof window === 'undefined') return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) {
    flagVideoLeft.value?.pause();
    flagVideoRight.value?.pause();
    return;
  }
  flagVideoLeft.value?.addEventListener('ended', pingPongLeft.onEnded);
  flagVideoRight.value?.addEventListener('ended', pingPongRight.onEnded);
});

onBeforeUnmount(() => {
  pingPongLeft.stop();
  pingPongRight.stop();
  flagVideoLeft.value?.removeEventListener('ended', pingPongLeft.onEnded);
  flagVideoRight.value?.removeEventListener('ended', pingPongRight.onEnded);
});

const byRank = computed(() => {
  const map = new Map<number, PodiumWinner>();
  for (const w of props.winners) map.set(w.rank, w);
  return map;
});

const slots = computed(() =>
  ([1, 2, 3] as const).map((rank) => {
    const layout = FACE_LAYOUT[rank];
    const winner = byRank.value.get(rank) ?? null;
    return {
      rank,
      winner,
      style: {
        left: `${layout.cx}%`,
        top: `${layout.cy}%`,
        width: `${layout.d}%`
      }
    };
  })
);

const ariaLabel = computed(() => {
  const names = ([1, 2, 3] as const)
    .map((r) => byRank.value.get(r)?.name)
    .filter(Boolean);
  return names.length
    ? `Победители Pit Stop: ${names.join(', ')}`
    : 'Подиум победителей Pit Stop';
});
</script>

<style scoped>
.ps-podium {
  position: relative;
  width: 100%;
  height: 100%;
  line-height: 0;
  overflow: hidden;
}
.ps-podium__bg {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  user-select: none;
  pointer-events: none;
}

/*
 * Надпись "WINNERS" впечатана в саму фотографию (top-center, ~x45-54%,
 * y3-5.5% кадра 1280×720). AI-инструмента для чистого inpaint в этом
 * окружении нет (см. creative-images-via-ai.mdc) — это временная CSS-
 * заплатка поверх почти-чёрного фона вокруг надписи, не настоящий ретушь
 * картинки. Полноценная переделка фона — отдельная задача на будущее.
 */
.ps-podium__title-patch {
  position: absolute;
  left: 50%;
  top: 1.5%;
  width: 14%;
  height: 6%;
  transform: translateX(-50%);
  z-index: 1;
  pointer-events: none;
  background: rgb(9, 9, 12);
  border-radius: 45%;
  /* Мягкая растушёванная кромка тем же тоном, что фон вокруг — глаз не ловит
     прямоугольник, а само пятно полностью непрозрачно в центре. */
  box-shadow:
    0 0 10px 10px rgb(9, 9, 12),
    0 0 26px 22px rgba(9, 9, 12, 0.75),
    0 0 46px 34px rgba(9, 9, 12, 0.35);
}

.ps-podium__flag {
  position: absolute;
  top: -4%;
  width: 52%;
  z-index: 2;
  pointer-events: none;
}
.ps-podium__flag--left {
  left: -23%;
}
.ps-podium__flag--right {
  right: -23%;
}
.ps-podium__flag-video {
  display: block;
  width: 100%;
  height: auto;
  filter: drop-shadow(2px 4px 6px rgba(0, 0, 0, 0.55));
}
.ps-podium__flag--right .ps-podium__flag-video {
  transform: scaleX(-1);
}

.ps-podium__slot {
  position: absolute;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  transform: translate(-50%, -50%);
}
.ps-podium__face {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 50%;
  overflow: hidden;
  background: #0a0a0a;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.35);
}
.ps-podium__empty {
  display: block;
  width: 100%;
  height: 100%;
  background: #111;
}
.ps-podium__avatar {
  display: block !important;
  width: 100% !important;
  height: 100% !important;
}
.ps-podium__photo {
  object-fit: cover;
  object-position: center top;
}
.ps-podium__face :deep(.user-avatar) {
  display: block;
  width: 100% !important;
  height: 100% !important;
  border-radius: 0;
}
.ps-podium__face :deep(.user-avatar__img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center top;
}
.ps-podium__face :deep(.user-avatar__fallback) {
  width: 100%;
  height: 100%;
  font-size: clamp(1.2rem, 4vw, 2.4rem);
  background: #2b2b2e;
  color: #eeeee8;
}

.ps-podium__label {
  margin-top: 0.35em;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15em;
  width: max-content;
  max-width: 9.5em;
  padding: 0.22em 0.5em 0.28em;
  border-radius: 0.5em;
  background: rgba(0, 0, 0, 0.45);
  pointer-events: none;
}
.ps-podium__name {
  font-weight: 800;
  font-size: clamp(0.62rem, 1.6vw, 0.86rem);
  line-height: 1.2;
  color: #fff;
  text-align: center;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9), 0 0 8px rgba(0, 0, 0, 0.6);
  white-space: normal;
  overflow-wrap: break-word;
  max-width: 100%;
}
.ps-podium__time {
  font-family: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  font-size: clamp(0.56rem, 1.35vw, 0.74rem);
  color: var(--ps-lime, #ddf365);
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
}
.ps-podium__slot.is-r1 .ps-podium__name {
  font-size: clamp(0.72rem, 1.9vw, 1rem);
}
.ps-podium__slot.is-r1 .ps-podium__time {
  font-size: clamp(0.62rem, 1.5vw, 0.82rem);
}
</style>
