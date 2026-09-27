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

const vel = reactive({ x: 0, y: 0 });

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

const ACCEL = 28;
const MAX_SPEED = 14;
const FRICTION = 9;
const BOUNCE = 0.42;

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

  let ix = 0;
  let iy = 0;
  if (keys.left) ix -= 1;
  if (keys.right) ix += 1;
  if (keys.up) iy -= 1;
  if (keys.down) iy += 1;
  ix += stickVec.x;
  iy += stickVec.y;
  const inputMag = Math.hypot(ix, iy);
  if (inputMag > 0.08) {
    ix /= inputMag;
    iy /= inputMag;
    vel.x += ix * ACCEL * dt;
    vel.y += iy * ACCEL * dt;
  }

  const speed = Math.hypot(vel.x, vel.y);
  if (speed > 0.001) {
    const decel = Math.min(speed, FRICTION * dt);
    vel.x -= (vel.x / speed) * decel;
    vel.y -= (vel.y / speed) * decel;
  } else {
    vel.x = 0;
    vel.y = 0;
  }

  const sp2 = Math.hypot(vel.x, vel.y);
  if (sp2 > MAX_SPEED) {
    vel.x = (vel.x / sp2) * MAX_SPEED;
    vel.y = (vel.y / sp2) * MAX_SPEED;
  }

  if (Math.hypot(vel.x, vel.y) < 0.05 && inputMag < 0.08) return;

  const tryLeft = car.left + vel.x * dt;
  const tryTop = car.top + vel.y * dt;

  const okFull = carFitsOnTrack(mask, tryLeft, tryTop);
  if (okFull) {
    car.left = tryLeft;
    car.top = tryTop;
  } else {
    const okX = carFitsOnTrack(mask, tryLeft, car.top);
    const okY = carFitsOnTrack(mask, car.left, tryTop);
    if (okX && !okY) {
      car.left = tryLeft;
      vel.y *= -BOUNCE;
      vel.x *= 0.85;
    } else if (okY && !okX) {
      car.top = tryTop;
      vel.x *= -BOUNCE;
      vel.y *= 0.85;
    } else {
      vel.x *= -BOUNCE;
      vel.y *= -BOUNCE;
      const back = 0.15;
      const bx = car.left - Math.sign(vel.x || 1) * back;
      const by = car.top - Math.sign(vel.y || 1) * back;
      if (carFitsOnTrack(mask, bx, car.top)) car.left = bx;
      if (carFitsOnTrack(mask, car.left, by)) car.top = by;
    }
  }

  const moveSp = Math.hypot(vel.x, vel.y);
  if (moveSp > 0.4) {
    car.angleDeg = (Math.atan2(vel.x, -vel.y) * 180) / Math.PI;
  } else if (inputMag > 0.08) {
    car.angleDeg = (Math.atan2(ix, -iy) * 180) / Math.PI;
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
    /* без маски */
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
  background: repeating-linear-gradient(90deg, #111 0 6px, #eeeee8 6px 12px);
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

/* Стик только на телефоне/таче; на ПК/ноуте — WASD */
@media (hover: hover) and (pointer: fine) {
  .ps-drive__stick {
    display: none;
  }
}
</style>
