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
    <div class="ps-podium__flag ps-podium__flag--left" aria-hidden="true">
      <img class="ps-podium__flag-img" :src="FLAG_IMG" alt="" draggable="false" />
    </div>
    <div class="ps-podium__flag ps-podium__flag--right" aria-hidden="true">
      <img class="ps-podium__flag-img" :src="FLAG_IMG" alt="" draggable="false" />
    </div>
    <div
      v-for="slot in slots"
      :key="slot.rank"
      class="ps-podium__face"
      :class="`is-r${slot.rank}`"
      :style="slot.style"
    >
      <UserAvatar
        v-if="slot.winner"
        class="ps-podium__avatar"
        :user-id="slot.winner.userId"
        :name="slot.winner.name"
        :size="240"
      />
      <span v-else class="ps-podium__empty" aria-hidden="true" />
    </div>
  </div>
</template>

<script setup lang="ts">
/** Геометрия кругов под маску — % от кадра 1280×720 (c4 clean). */
const FACE_LAYOUT: Record<1 | 2 | 3, { cx: number; cy: number; d: number }> = {
  1: { cx: 49.92, cy: 33.89, d: 16.0 },
  2: { cx: 27.5, cy: 58.47, d: 15.2 },
  3: { cx: 71.8, cy: 58.33, d: 15.6 }
};

export type PodiumWinner = {
  userId: number;
  rank: number;
  name: string;
};

const props = defineProps<{
  winners: PodiumWinner[];
}>();

const PODIUM_IMG = '/events/pit-stop-14/winners-podium.jpg?v=2';
const FLAG_IMG = '/events/pit-stop-14/flag-cloth.png?v=1';

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

.ps-podium__flag {
  position: absolute;
  top: 5%;
  width: 13.5%;
  z-index: 2;
  pointer-events: none;
  will-change: transform;
}
.ps-podium__flag--left {
  left: 0.6%;
  transform-origin: 8% 12%;
  animation: ps-flag-wave-l 2.6s ease-in-out infinite;
}
.ps-podium__flag--right {
  right: 0.6%;
  transform-origin: 92% 12%;
  animation: ps-flag-wave-r 2.6s ease-in-out infinite;
  animation-delay: -1.2s;
}
.ps-podium__flag-img {
  display: block;
  width: 100%;
  height: auto;
  filter: drop-shadow(2px 4px 6px rgba(0, 0, 0, 0.55));
}
.ps-podium__flag--right .ps-podium__flag-img {
  transform: scaleX(-1);
}

@keyframes ps-flag-wave-l {
  0%,
  100% {
    transform: rotate(-7deg) skewX(-4deg) skewY(1.5deg);
  }
  25% {
    transform: rotate(-1deg) skewX(3deg) skewY(-2deg);
  }
  50% {
    transform: rotate(8deg) skewX(-2deg) skewY(2deg);
  }
  75% {
    transform: rotate(2deg) skewX(4deg) skewY(-1deg);
  }
}
@keyframes ps-flag-wave-r {
  0%,
  100% {
    transform: rotate(7deg) skewX(4deg) skewY(-1.5deg);
  }
  25% {
    transform: rotate(1deg) skewX(-3deg) skewY(2deg);
  }
  50% {
    transform: rotate(-8deg) skewX(2deg) skewY(-2deg);
  }
  75% {
    transform: rotate(-2deg) skewX(-4deg) skewY(1deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ps-podium__flag--left,
  .ps-podium__flag--right {
    animation: none;
  }
}

.ps-podium__face {
  position: absolute;
  z-index: 3;
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
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
</style>
