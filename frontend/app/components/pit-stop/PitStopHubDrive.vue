<template>
  <div class="ps-drive" aria-label="Заезд по трассе">
    <div
      class="ps-drive__car"
      :style="{
        left: `${(car.x / TRACK_W) * 100}%`,
        top: `${(car.y / TRACK_H) * 100}%`,
        width: `${((CAR_WIDTH * CAR_SPRITE_SCALE) / TRACK_W) * 100}%`,
        height: `${((CAR_LEN * CAR_SPRITE_SCALE) / TRACK_H) * 100}%`,
        transform: `translate(-50%, -50%) rotate(${car.angleDeg}deg)`
      }"
    >
      <img :src="carImg" alt="" draggable="false" />
    </div>

    <div class="ps-drive__hud" aria-live="polite">
      <div class="ps-drive__hud-row is-main">
        <span class="ps-drive__hud-label">{{ finished ? 'Финиш' : 'Круг' }}</span>
        <span class="ps-drive__hud-time">{{ formatLapMs(finished ? lastLapMs : lapStartTs == null ? null : currentMs) }}</span>
      </div>
      <div class="ps-drive__hud-row">
        <span class="ps-drive__hud-label">Прошлый</span>
        <span class="ps-drive__hud-time">{{ formatLapMs(lastLapMs) }}</span>
      </div>
      <div class="ps-drive__hud-row is-best">
        <span class="ps-drive__hud-label">Рекорд</span>
        <span class="ps-drive__hud-time">{{ formatLapMs(bestMs) }}</span>
      </div>
      <div class="ps-drive__hud-zones" aria-hidden="true">
        <i v-for="(z, i) in zonesHit" :key="i" :class="{ 'is-hit': z }" />
      </div>
    </div>

    <p v-if="finished" class="ps-drive__again" role="status">
      <kbd>Пробел</kbd> — проехать ещё раз
    </p>
    <p v-else-if="flash" class="ps-drive__flash" :class="`is-${flash.kind}`">{{ flash.text }}</p>
    <p v-else-if="!started" class="ps-drive__hint">
      <span class="ps-drive__hint-desk">W / ↑ — газ · A D / ← → — руль · R — на старт</span>
      <span class="ps-drive__hint-touch">Тяни круг — болид едет туда</span>
    </p>

    <button type="button" class="ps-drive__reset" @click="restartRace">На старт</button>

    <div
      v-show="!paused && !finished"
      ref="stickRoot"
      class="ps-drive__stick"
      :class="{ 'is-active': stickActive }"
      @pointerdown.prevent="onStickDown"
    >
      <div class="ps-drive__stick-base" aria-hidden="true" />
      <div
        class="ps-drive__stick-knob"
        :style="{ transform: `translate(${stickX}px, ${stickY}px)` }"
        aria-hidden="true"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  CAR_LEN,
  CAR_SPRITE_SCALE,
  CAR_WIDTH,
  LAP_ZONES,
  LAP_ZONE_R,
  MIN_LAP_MS,
  START_LINE,
  TRACK_H,
  TRACK_SPAWN,
  TRACK_W,
  carFitsOnTrack,
  carSrc,
  formatLapMs,
  loadTrackMask,
  type CarColorId,
  type TrackMask
} from '~/events/pit-stop-14/trackDrive';
import {
  hushEngine,
  playBump,
  playTriumph,
  setEngine,
  setSteer,
  unlockRaceAudio
} from '~/events/pit-stop-14/raceAudio';

const props = defineProps<{
  color: CarColorId;
  bestMs: number | null;
  paused?: boolean;
}>();

const emit = defineEmits<{
  lap: [ms: number];
  finish: [payload: { ms: number; improved: boolean }];
}>();

const finished = ref(false);
const carImg = computed(() => carSrc(props.color));

const car = reactive({ x: TRACK_SPAWN.x, y: TRACK_SPAWN.y, angleDeg: TRACK_SPAWN.angleDeg });
let speed = 0;

const keys = reactive({ up: false, down: false, left: false, right: false });

const stickRoot = ref<HTMLElement | null>(null);
const stickActive = ref(false);
const stickX = ref(0);
const stickY = ref(0);
const stickVec = { x: 0, y: 0 };
const STICK_R = 42;
let stickPtr: number | null = null;

const started = ref(false);
const lapStartTs = ref<number | null>(null);
const currentMs = ref(0);
const lastLapMs = ref<number | null>(null);
const zonesHit = ref<boolean[]>(LAP_ZONES.map(() => false));
const flash = ref<{ kind: 'ok' | 'bad' | 'record'; text: string } | null>(null);
let flashTimer: ReturnType<typeof setTimeout> | null = null;

let mask: TrackMask | null = null;
let raf = 0;
let lastTs = 0;

/** px/с и рад/с в координатах трассы 1280×720 */
const MAX_SPEED = 290;
const MAX_REVERSE = 90;
const ACCEL = 260;
const BRAKE = 520;
const DRAG = 150;
const TURN = 3.1;

const showFlash = (kind: 'ok' | 'bad' | 'record', text: string, ms = 1800) => {
  flash.value = { kind, text };
  if (flashTimer) clearTimeout(flashTimer);
  flashTimer = setTimeout(() => {
    flash.value = null;
    flashTimer = null;
  }, ms);
};

const resetLap = () => {
  lapStartTs.value = null;
  currentMs.value = 0;
  zonesHit.value = LAP_ZONES.map(() => false);
};

const restartRace = () => {
  void unlockRaceAudio();
  car.x = TRACK_SPAWN.x;
  car.y = TRACK_SPAWN.y;
  car.angleDeg = TRACK_SPAWN.angleDeg;
  speed = 0;
  finished.value = false;
  started.value = false;
  flash.value = null;
  resetLap();
  hushEngine();
};

const onKey = (e: KeyboardEvent, down: boolean) => {
  const t = e.target as HTMLElement | null;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  if (props.paused && down) return;

  if (down && (e.code === 'Space' || e.key === ' ')) {
    if (finished.value) {
      e.preventDefault();
      restartRace();
      return;
    }
  }

  void unlockRaceAudio();

  if (finished.value) return;

  const k = e.key.toLowerCase();
  if (k === 'arrowup' || k === 'w' || k === 'ц') keys.up = down;
  else if (k === 'arrowdown' || k === 's' || k === 'ы') keys.down = down;
  else if (k === 'arrowleft' || k === 'a' || k === 'ф') keys.left = down;
  else if (k === 'arrowright' || k === 'd' || k === 'в') keys.right = down;
  else if ((k === 'r' || k === 'к') && down) restartRace();
  else return;
  e.preventDefault();
};

const keyDown = (e: KeyboardEvent) => onKey(e, true);
const keyUp = (e: KeyboardEvent) => onKey(e, false);

const setStickFromEvent = (ev: PointerEvent) => {
  const el = stickRoot.value;
  if (!el) return;
  const r = el.getBoundingClientRect();
  let dx = ev.clientX - (r.left + r.width / 2);
  let dy = ev.clientY - (r.top + r.height / 2);
  const len = Math.hypot(dx, dy) || 1;
  if (len > STICK_R) {
    dx = (dx / len) * STICK_R;
    dy = (dy / len) * STICK_R;
  }
  stickX.value = dx;
  stickY.value = dy;
  stickVec.x = dx / STICK_R;
  stickVec.y = dy / STICK_R;
};

const onStickDown = (ev: PointerEvent) => {
  if (finished.value || props.paused) return;
  void unlockRaceAudio();
  stickActive.value = true;
  stickPtr = ev.pointerId;
  stickRoot.value?.setPointerCapture(ev.pointerId);
  setStickFromEvent(ev);
};

const onStickMove = (ev: PointerEvent) => {
  if (!stickActive.value || ev.pointerId !== stickPtr) return;
  setStickFromEvent(ev);
};

const onStickUp = (ev: PointerEvent) => {
  if (ev.pointerId !== stickPtr) return;
  stickActive.value = false;
  stickPtr = null;
  stickX.value = 0;
  stickY.value = 0;
  stickVec.x = 0;
  stickVec.y = 0;
};

const angleDiff = (target: number, from: number) => {
  let d = (target - from) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
};

/** У бортика поворот не должен клинить: ищем сдвиг на 1–3 px, где болид помещается. */
const findNudge = (m: TrackMask, angleDeg: number) => {
  for (const r of [1.5, 3]) {
    for (let k = 0; k < 8; k++) {
      const x = Math.cos((k * Math.PI) / 4) * r;
      const y = Math.sin((k * Math.PI) / 4) * r;
      if (carFitsOnTrack(m, car.x + x, car.y + y, angleDeg)) return { x, y };
    }
  }
  return null;
};

const completeLap = (ms: number) => {
  lastLapMs.value = ms;
  currentMs.value = ms;
  lapStartTs.value = null;
  const improved = props.bestMs == null || ms < props.bestMs;
  finished.value = true;
  speed = 0;
  keys.up = keys.down = keys.left = keys.right = false;
  stickVec.x = 0;
  stickVec.y = 0;
  hushEngine();
  emit('lap', ms);
  emit('finish', { ms, improved });
  if (improved) {
    showFlash('record', `Рекорд! ${formatLapMs(ms)}`, 3200);
    playTriumph();
  } else {
    showFlash('ok', formatLapMs(ms), 2200);
  }
};

const checkLine = (px: number, py: number, nx: number, ny: number, now: number) => {
  if (finished.value) return;
  const inBand = (ny >= START_LINE.yMin && ny <= START_LINE.yMax) || (py >= START_LINE.yMin && py <= START_LINE.yMax);
  if (!inBand) return;
  if (px < START_LINE.x && nx >= START_LINE.x) {
    if (lapStartTs.value != null && zonesHit.value.every(Boolean)) {
      const ms = Math.round(now - lapStartTs.value);
      if (ms >= MIN_LAP_MS) {
        completeLap(ms);
        return;
      }
    }
    zonesHit.value = LAP_ZONES.map(() => false);
    lapStartTs.value = now;
    currentMs.value = 0;
  } else if (px >= START_LINE.x && nx < START_LINE.x) {
    if (lapStartTs.value != null) showFlash('bad', 'Против хода — заезд сначала');
    resetLap();
  }
};

const tick = (ts: number) => {
  raf = requestAnimationFrame(tick);
  if (!mask) return;
  const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0;
  lastTs = ts;
  if (!dt) return;

  if (finished.value || props.paused) {
    hushEngine();
    return;
  }

  let throttle = 0;
  let steer = 0;
  if (keys.up) throttle += 1;
  if (keys.down) throttle -= 1;
  if (keys.left) steer -= 1;
  if (keys.right) steer += 1;

  const stickMag = Math.hypot(stickVec.x, stickVec.y);
  if (stickMag > 0.15) {
    const target = (Math.atan2(stickVec.x, -stickVec.y) * 180) / Math.PI;
    const d = angleDiff(target, car.angleDeg);
    steer = Math.max(-1, Math.min(1, d / 35));
    throttle = Math.abs(d) > 120 ? 0.35 : Math.min(1, stickMag * 1.15);
  }

  if (!started.value && (throttle !== 0 || steer !== 0)) started.value = true;

  if (throttle > 0) {
    speed += (speed < 0 ? BRAKE : ACCEL) * throttle * dt;
  } else if (throttle < 0) {
    speed += (speed > 0 ? BRAKE : ACCEL * 0.6) * throttle * dt;
  } else if (speed !== 0) {
    const d = Math.min(Math.abs(speed), DRAG * dt);
    speed -= Math.sign(speed) * d;
  }
  speed = Math.max(-MAX_REVERSE, Math.min(MAX_SPEED, speed));

  const speedNorm = Math.min(1, Math.abs(speed) / MAX_SPEED);
  setEngine(speedNorm, throttle);
  setSteer(steer, speedNorm);

  if (steer !== 0 && Math.abs(speed) > 1) {
    const grip = Math.min(1, Math.abs(speed) / 90) * (1 - 0.25 * Math.min(1, Math.abs(speed) / MAX_SPEED));
    const turnDeg = (steer * TURN * grip * Math.sign(speed) * dt * 180) / Math.PI;
    const nextAngle = car.angleDeg + turnDeg;
    if (carFitsOnTrack(mask, car.x, car.y, nextAngle)) {
      car.angleDeg = nextAngle;
    } else {
      const nudge = findNudge(mask, nextAngle);
      if (nudge) {
        car.x += nudge.x;
        car.y += nudge.y;
        car.angleDeg = nextAngle;
      }
    }
  }

  const now = performance.now();
  if (lapStartTs.value != null) currentMs.value = now - lapStartTs.value;

  if (Math.abs(speed) < 0.5) return;

  const a = (car.angleDeg * Math.PI) / 180;
  const dx = Math.sin(a) * speed * dt;
  const dy = -Math.cos(a) * speed * dt;
  const px = car.x;
  const py = car.y;

  if (carFitsOnTrack(mask, px + dx, py + dy, car.angleDeg)) {
    car.x = px + dx;
    car.y = py + dy;
  } else if (carFitsOnTrack(mask, px + dx, py, car.angleDeg)) {
    car.x = px + dx;
    speed *= 0.55;
    playBump(0.35);
  } else if (carFitsOnTrack(mask, px, py + dy, car.angleDeg)) {
    car.y = py + dy;
    speed *= 0.55;
    playBump(0.35);
  } else {
    speed *= -0.25;
    playBump(0.7);
  }

  checkLine(px, py, car.x, car.y, now);

  if (lapStartTs.value != null) {
    LAP_ZONES.forEach((z, i) => {
      if (!zonesHit.value[i] && Math.hypot(car.x - z.x, car.y - z.y) <= LAP_ZONE_R) {
        zonesHit.value[i] = true;
      }
    });
  }
};

onMounted(async () => {
  window.addEventListener('keydown', keyDown, { passive: false });
  window.addEventListener('keyup', keyUp);
  window.addEventListener('pointermove', onStickMove);
  window.addEventListener('pointerup', onStickUp);
  window.addEventListener('pointercancel', onStickUp);
  try {
    mask = await loadTrackMask();
  } catch {
    showFlash('bad', 'Трасса не загрузилась — обнови страницу', 6000);
  }
  raf = requestAnimationFrame(tick);
});

onBeforeUnmount(() => {
  cancelAnimationFrame(raf);
  if (flashTimer) clearTimeout(flashTimer);
  hushEngine();
  window.removeEventListener('keydown', keyDown);
  window.removeEventListener('keyup', keyUp);
  window.removeEventListener('pointermove', onStickMove);
  window.removeEventListener('pointerup', onStickUp);
  window.removeEventListener('pointercancel', onStickUp);
});

defineExpose({ restartRace });
</script>

<style scoped>
.ps-drive {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
  font-family: 'Golos Text', system-ui, sans-serif;
}
.ps-drive__car {
  position: absolute;
  pointer-events: none;
  filter: drop-shadow(2px 3px 0 rgba(0, 0, 0, 0.45));
  will-change: left, top, transform;
  z-index: 4;
}
.ps-drive__car img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  user-select: none;
}

.ps-drive__hud {
  position: absolute;
  left: 50%;
  bottom: 1.2%;
  transform: translateX(-50%);
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 5px 12px;
  background: rgba(17, 17, 17, 0.9);
  border: 2px solid #111;
  border-radius: 10px;
  box-shadow: 3px 3px 0 #ddf365;
  color: #eeeee8;
  line-height: 1.1;
  white-space: nowrap;
}
.ps-drive__hud-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.ps-drive__hud-label {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(238, 238, 232, 0.6);
}
.ps-drive__hud-time {
  font-family: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
  font-variant-numeric: tabular-nums;
  font-size: 0.78rem;
  font-weight: 700;
}
.ps-drive__hud-row.is-main .ps-drive__hud-time {
  font-size: 1.05rem;
  color: #fff;
}
.ps-drive__hud-row.is-best .ps-drive__hud-time {
  color: #ddf365;
}
.ps-drive__hud-zones {
  display: flex;
  gap: 3px;
}
.ps-drive__hud-zones i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(238, 238, 232, 0.18);
}
.ps-drive__hud-zones i.is-hit {
  background: #ddf365;
}

.ps-drive__flash,
.ps-drive__hint,
.ps-drive__again {
  position: absolute;
  left: 50%;
  top: 4%;
  transform: translateX(-50%);
  z-index: 5;
  margin: 0;
  padding: 7px 14px;
  border: 2px solid #111;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 800;
  white-space: nowrap;
  line-height: 1.2;
}
.ps-drive__again {
  background: #ddf365;
  color: #111;
  box-shadow: 3px 3px 0 #7451f4;
  pointer-events: none;
}
.ps-drive__again kbd {
  display: inline-block;
  padding: 1px 7px;
  margin-right: 4px;
  border: 2px solid #111;
  border-radius: 6px;
  background: #eeeee8;
  font: inherit;
  font-weight: 800;
  box-shadow: 1px 1px 0 #111;
}
.ps-drive__hint {
  background: rgba(17, 17, 17, 0.85);
  color: #eeeee8;
  font-weight: 600;
}
.ps-drive__flash.is-ok {
  background: #eeeee8;
  color: #111;
  font-family: 'JetBrains Mono', ui-monospace, Menlo, monospace;
}
.ps-drive__flash.is-record {
  background: #ddf365;
  color: #111;
  box-shadow: 3px 3px 0 #7451f4;
}
.ps-drive__flash.is-bad {
  background: #ff6b5b;
  color: #111;
}
.ps-drive__hint-touch {
  display: none;
}

.ps-drive__reset {
  position: absolute;
  right: 1.2%;
  top: 2%;
  z-index: 5;
  pointer-events: auto;
  padding: 6px 12px;
  border: 2px solid #111;
  border-radius: 8px;
  background: #eeeee8;
  color: #111;
  font: inherit;
  font-size: 0.74rem;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 2px 2px 0 #111;
}
.ps-drive__reset:active {
  transform: translate(1px, 1px);
  box-shadow: 1px 1px 0 #111;
}

.ps-drive__stick {
  position: fixed;
  left: max(16px, env(safe-area-inset-left));
  bottom: max(20px, env(safe-area-inset-bottom));
  z-index: 20;
  width: 112px;
  height: 112px;
  pointer-events: auto;
  touch-action: none;
  user-select: none;
}
.ps-drive__stick-base {
  position: absolute;
  inset: 8px;
  border-radius: 50%;
  border: 2px solid rgba(238, 238, 232, 0.45);
  background: rgba(29, 29, 31, 0.55);
  box-shadow: inset 0 0 0 2px rgba(116, 81, 244, 0.25);
}
.ps-drive__stick.is-active .ps-drive__stick-base {
  border-color: #ddf365;
}
.ps-drive__stick-knob {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 44px;
  height: 44px;
  margin: -22px 0 0 -22px;
  border-radius: 50%;
  border: 2px solid #111;
  background: #ddf365;
  box-shadow: 2px 2px 0 #111;
  will-change: transform;
}

/* Стик только на телефоне/таче; на ПК/ноуте — клавиатура */
@media (hover: hover) and (pointer: fine) {
  .ps-drive__stick {
    display: none;
  }
}
@media (hover: none), (pointer: coarse) {
  .ps-drive__hint-desk {
    display: none;
  }
  .ps-drive__hint-touch {
    display: inline;
  }
}
@media (max-width: 720px) {
  .ps-drive__hud {
    gap: 8px;
    padding: 3px 8px;
  }
  .ps-drive__hud-label {
    font-size: 0.5rem;
  }
  .ps-drive__hud-time {
    font-size: 0.66rem;
  }
  .ps-drive__hud-row.is-main .ps-drive__hud-time {
    font-size: 0.78rem;
  }
  .ps-drive__hud-zones {
    display: none;
  }
  .ps-drive__flash,
  .ps-drive__hint,
  .ps-drive__again {
    font-size: 0.66rem;
    top: 2%;
  }
  .ps-drive__reset {
    padding: 4px 8px;
    font-size: 0.64rem;
  }
}
</style>
