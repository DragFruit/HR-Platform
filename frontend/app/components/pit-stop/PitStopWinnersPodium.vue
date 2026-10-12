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
      class="ps-podium__slot"
      :class="`is-r${slot.rank}`"
      :style="slot.faceStyle"
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
    </div>
    <template v-for="slot in slots" :key="`label-${slot.rank}`">
      <div
        v-if="slot.winner"
        class="ps-podium__label"
        :class="`is-r${slot.rank}`"
        :style="slot.labelStyle"
      >
        <span class="ps-podium__name">{{ slot.winner.name }}</span>
        <span class="ps-podium__time">{{ formatLapMs(slot.winner.bestMs) }}</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { formatLapMs } from '~/events/pit-stop-14/trackDrive';

/** Кадр фона фиксирован 1280×720 (см. TRACK_AR в pages/event/pit-stop/index.vue). */
const FRAME_W = 1280;
const FRAME_H = 720;

/**
 * Геометрия кругов под маску — % от кадра 1280×720.
 * Перемерено по пикселям самого winners-podium.jpg: для каждой рамки отсканирована
 * яркость/насыщенность по ~30 парам противоположных углов (декоративные камни на
 * 12/6 часах намеренно исключены — там кольцо нарочно "подрезано" камнем, это не
 * граница маски), получены центр и радиус внутренней границы кольца (где тёмная
 * область переходит в золото/серебро/бронзу).
 *
 * cy — это центр САМОГО КРУГА, не центр блока «круг + подпись»: раньше `top: cy%`
 * вместе с `transform: translate(-50%, -50%)` навешивались на весь `.ps-podium__slot`
 * (круг + подпись друг под другом), поэтому центрировалась вся колонка, а не круг —
 * из-за высоты подписи фактический центр фото уезжал вверх от cy на ~половину высоты
 * подписи (у 3 места с двухстрочным именем это давало заметный уход и перекрытие
 * верхней части рамки). Теперь подпись позиционируется отдельным элементом
 * (computeLabelStyle), круг центрируется сам по себе — cy=истинный центр фото.
 */
const FACE_LAYOUT: Record<1 | 2 | 3, { cx: number; cy: number; d: number }> = {
  1: { cx: 49.95, cy: 33.82, d: 17.47 },
  2: { cx: 27.56, cy: 58.97, d: 17.19 },
  3: { cx: 71.84, cy: 58.81, d: 17.64 }
};

/** Зазор между нижним краем круга и подписью, % высоты кадра (было ~0.35em). */
const LABEL_GAP_PCT = 1.6;

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
/**
 * Предпосчитанный бумеранг (вперёд + развёрнутый назад, склеены в одном файле)
 * вместо JS пинг-понга: тот вручную отматывал currentTime через rAF после `ended`,
 * что на коротком alpha-webm давало заметный рывок/подвисание каждые ~5с (каждая
 * ручная перестановка currentTime форсирует seek к ключевому кадру). Теперь —
 * обычный нативный `loop`, ноль JS поверх видео. Файл собран из исходного
 * flag-anim.webm: `ffmpeg -c:v libvpx-vp9 -i flag-anim.webm -filter_complex
 * "[0:v]split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1[outv]" -map "[outv]"
 * -c:v libvpx-vp9 -pix_fmt yuva420p -auto-alt-ref 0 flag-anim-boomerang.webm`
 * (декодер обязательно `libvpx-vp9`, не нативный `vp9` — иначе альфа теряется).
 * Последний кадр форварда = первый кадр реверса (нет скачка на стыке), и первый
 * кадр форварда = последний кадр реверса (нет скачка на нативном loop-wrap).
 */
const FLAG_VIDEO = '/events/pit-stop-14/flag-anim-boomerang.webm?v=1';

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
    // Радиус круга (в % ширины) переведён в % высоты через AR кадра, чтобы подпись
    // легла сразу под кругом независимо от его диаметра.
    const radiusPctH = (layout.d / 2) * (FRAME_W / FRAME_H);
    return {
      rank,
      winner,
      faceStyle: {
        left: `${layout.cx}%`,
        top: `${layout.cy}%`,
        width: `${layout.d}%`
      },
      labelStyle: {
        left: `${layout.cx}%`,
        top: `${layout.cy + radiusPctH + LABEL_GAP_PCT}%`
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
  position: absolute;
  z-index: 3;
  transform: translateX(-50%);
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
.ps-podium__label.is-r1 .ps-podium__name {
  font-size: clamp(0.72rem, 1.9vw, 1rem);
}
.ps-podium__label.is-r1 .ps-podium__time {
  font-size: clamp(0.62rem, 1.5vw, 0.82rem);
}
</style>
