<template>
  <div class="ps-drive" aria-label="Управление болидом">
    <div
      class="ps-drive__start"
      :style="{
        left: `${startLine.left}%`,
        top: `${startLine.top}%`,
        width: `${startLine.widthPct}%`,
        transform: `translate(-50%, -50%) rotate(${startLine.angleDeg}deg)`
      }"
      aria-hidden="true"
    />

    <div
      class="ps-drive__car"
      :style="{
        left: `${car.left}%`,
        top: `${car.top}%`,
        transform: `translate(-50%, -50%) rotate(${car.angleDeg}deg)`
      }"
    >
      <img :src="carSrc" alt="" draggable="false" />
    </div>

    <div
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
      <span class="ps-drive__stick-hint">ездить</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  TRACK_CAR_SRC,
  TRACK_START,
  TRACK_START_LINE,
  carFitsOnTrack,
  clampCarToTrack,
  loadTrackMask,
  type TrackMask
} from '~/events/pit-stop-14/trackDrive';

const carSrc = TRACK_CAR_SRC;
const startLine = TRACK_START_LINE;

const car = reactive({
  left: TRACK_START.left,
  top: TRACK_START.top,
  angleDeg: TRACK_START.angleDeg
});

const keys = reactive({
  up: false,
  down: false,
  left: false,
  right: false
});

const stickRoot = ref<HTMLElement | null>(null);
const stickActive = ref(false);
const stickX = ref(0);
const stickY = ref(0);
const stickVec = reactive({ x: 0, y: 0 });
const STICK_R = 42;

let mask: TrackMask | null = null;
let raf = 0;
let lastTs = 0;
let stickPtr: number | null = null;

const SPEED = 9.5; // % карты в секунду

const onKey = (e: KeyboardEvent, down: boolean) => {
  const k = e.key.toLowerCase();
  if (k === 'arrowup' || k === 'w' || k === 'ц') {
    keys.up = down;
    e.preventDefault();
  } else if (k === 'arrowdown' || k === 's' || k === 'ы') {
    keys.down = down;
    e.preventDefault();
  } else if (k === 'arrowleft' || k === 'a' || k === 'ф') {
    keys.left = down;
    e.preventDefault();
  } else if (k === 'arrowright' || k === 'd' || k === 'в') {
    keys.right = down;
    e.preventDefault();
  }
};

const keyDown = (e: KeyboardEvent) => onKey(e, true);
const keyUp = (e: KeyboardEvent) => onKey(e, false);

const setStickFromEvent = (ev: PointerEvent) => {
  const el = stickRoot.value;
  if (!el) return;
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  let dx = ev.clientX - cx;
  let dy = ev.clientY - cy;
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

const tick = (ts: number) => {
  raf = requestAnimationFrame(tick);
  if (!mask) return;
  const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0;
  lastTs = ts;
  if (!dt) return;

  let mx = 0;
  let my = 0;
  if (keys.left) mx -= 1;
  if (keys.right) mx += 1;
  if (keys.up) my -= 1;
  if (keys.down) my += 1;
  mx += stickVec.x;
  my += stickVec.y;

  const mag = Math.hypot(mx, my);
  if (mag < 0.08) return;
  mx /= mag;
  my /= mag;

  const step = SPEED * dt;
  const next = clampCarToTrack(
    mask,
    { left: car.left, top: car.top },
    { left: car.left + mx * step, top: car.top + my * step }
  );
  car.left = next.left;
  car.top = next.top;
  car.angleDeg = (Math.atan2(mx, -my) * 180) / Math.PI;
};

onMounted(async () => {
  window.addEventListener('keydown', keyDown, { passive: false });
  window.addEventListener('keyup', keyUp);
  window.addEventListener('pointermove', onStickMove);
  window.addEventListener('pointerup', onStickUp);
  window.addEventListener('pointercancel', onStickUp);
  try {
    mask = await loadTrackMask();
    if (!carFitsOnTrack(mask, car.left, car.top)) {
      outer: for (let r = 0.3; r <= 3; r += 0.3) {
        for (let a = 0; a < 360; a += 30) {
          const rad = (a * Math.PI) / 180;
          const p = {
            left: TRACK_START.left + Math.cos(rad) * r,
            top: TRACK_START.top + Math.sin(rad) * r
          };
          if (carFitsOnTrack(mask, p.left, p.top)) {
            car.left = p.left;
            car.top = p.top;
            break outer;
          }
        }
      }
    }
  } catch {
    /* без маски машинка стоит на старте */
  }
  raf = requestAnimationFrame(tick);
});

onBeforeUnmount(() => {
  cancelAnimationFrame(raf);
  window.removeEventListener('keydown', keyDown);
  window.removeEventListener('keyup', keyUp);
  window.removeEventListener('pointermove', onStickMove);
  window.removeEventListener('pointerup', onStickUp);
  window.removeEventListener('pointercancel', onStickUp);
});
</script>

<style scoped>
.ps-drive {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
}
.ps-drive__start {
  position: absolute;
  height: 8px;
  border: 1.5px solid #111;
  border-radius: 1px;
  background: repeating-linear-gradient(
    90deg,
    #111 0 6px,
    #eeeee8 6px 12px
  );
  box-shadow: 0 0 0 1px rgba(221, 243, 101, 0.35);
  pointer-events: none;
  z-index: 2;
}
.ps-drive__car {
  position: absolute;
  width: clamp(34px, 5vmin, 52px);
  height: clamp(34px, 5vmin, 52px);
  pointer-events: none;
  filter: drop-shadow(2px 2px 0 rgba(0, 0, 0, 0.55));
  will-change: left, top, transform;
  z-index: 4;
  background: transparent;
}
.ps-drive__car img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  user-select: none;
  background: transparent;
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
.ps-drive__stick-hint {
  position: absolute;
  left: 0;
  right: 0;
  bottom: -2px;
  text-align: center;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(238, 238, 232, 0.55);
  pointer-events: none;
}

@media (min-width: 900px) {
  .ps-drive__stick {
    /* на десктопе тоже доступен, но меньше мешает */
    opacity: 0.72;
  }
  .ps-drive__stick:hover,
  .ps-drive__stick.is-active {
    opacity: 1;
  }
}
</style>
