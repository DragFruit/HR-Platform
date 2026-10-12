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
      <video
        ref="flagVideoLeft"
        class="ps-podium__flag-video"
        :src="FLAG_VIDEO"
        autoplay
        loop
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
        loop
        muted
        playsinline
      />
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
const FLAG_VIDEO = '/events/pit-stop-14/flag-anim.webm?v=1';

const flagVideoLeft = ref<HTMLVideoElement | null>(null);
const flagVideoRight = ref<HTMLVideoElement | null>(null);

onMounted(() => {
  if (typeof window === 'undefined') return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) {
    flagVideoLeft.value?.pause();
    flagVideoRight.value?.pause();
  }
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

.ps-podium__flag {
  position: absolute;
  top: 2%;
  width: 40%;
  z-index: 2;
  pointer-events: none;
}
.ps-podium__flag--left {
  left: -10%;
}
.ps-podium__flag--right {
  right: -10%;
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
