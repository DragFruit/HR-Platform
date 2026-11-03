<template>
  <div ref="sentinelRef" class="ogg-sentinel" aria-hidden="true" />
  <div ref="barRef" class="ogg" :class="{ 'is-stuck': stuck }">
    <div class="ogg__wire" aria-hidden="true">
      <span
        v-for="d in days"
        :key="d.id"
        :ref="(el) => setBulb(d.id, el)"
        class="ogg__bulb"
        :class="{ 'is-on': d.done }"
        :style="{ '--c': color(d.id) }"
      ><i /></span>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Гирлянда-прогресс: огонёк N — окно N. Загорается, когда в окне выполнено
 * действие. Липнет к верху экрана, чтобы зажигание было видно и с конца
 * календаря.
 *
 * Это не баллы и не лидерборд: свою гирлянду видит только сам человек.
 */
import type { OgonekDayView } from '~/events/ogonek/types';

defineProps<{ days: OgonekDayView[] }>();

const COLORS = ['#ffcf4a', '#5aa8ff', '#3fbf68', '#ff7fb0', '#ffffff'];
const color = (id: number) => COLORS[id % COLORS.length];

const bulbs = new Map<number, HTMLElement>();
function setBulb(id: number, el: unknown) {
  if (el instanceof HTMLElement) bulbs.set(id, el);
  else bulbs.delete(id);
}

const sentinelRef = ref<HTMLElement | null>(null);
const barRef = ref<HTMLElement | null>(null);
const stuck = ref(false);
let io: IntersectionObserver | null = null;

onMounted(() => {
  if (!sentinelRef.value || typeof IntersectionObserver === 'undefined') return;
  // Гирлянда липнет под шапкой платформы, а не к краю окна — на ту же
  // высоту сдвигаем и линию, по которой ловим «прилипла».
  const top = parseFloat(barRef.value ? getComputedStyle(barRef.value).top : '0') || 0;
  io = new IntersectionObserver(([e]) => { stuck.value = !e?.isIntersecting; }, {
    rootMargin: `-${Math.round(top)}px 0px 0px 0px`
  });
  io.observe(sentinelRef.value);
});
onBeforeUnmount(() => io?.disconnect());

const reduce = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/** Огонёк виден на экране — значит «пуф» можно показать сразу. */
function isVisible(id: number): boolean {
  const b = bulbs.get(id);
  if (!b) return false;
  const r = b.getBoundingClientRect();
  return r.bottom > 0 && r.top < window.innerHeight;
}

/** Облачко пикселей и вспышка: огонёк загорается. */
function puff(id: number) {
  const b = bulbs.get(id);
  if (!b || reduce()) return;
  const r = b.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height * 0.6;
  const col = color(id) ?? '#ffcf4a';
  b.querySelector('i')?.animate(
    [
      { transform: 'scale(.3)', filter: 'brightness(3)' },
      { transform: 'scale(1.6)', filter: 'brightness(2)', offset: 0.35 },
      { transform: 'scale(1)', filter: 'brightness(1)' }
    ],
    { duration: 600, easing: 'ease-out' }
  );
  for (let i = 0; i < 12; i++) {
    const p = document.createElement('i');
    p.className = 'ogg-puff';
    p.style.background = i % 3 ? 'rgba(255,240,230,.9)' : col;
    p.style.left = `${cx}px`;
    p.style.top = `${cy}px`;
    document.body.appendChild(p);
    const a = (i / 12) * Math.PI * 2 + Math.random() * 0.4;
    const dist = 12 + Math.random() * 14;
    const s = 1 + Math.random() * 1.5;
    p.animate(
      [
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
        {
          transform: `translate(calc(-50% + ${Math.cos(a) * dist}px), calc(-50% + ${Math.sin(a) * dist - 6}px)) scale(${s})`,
          opacity: 0
        }
      ],
      { duration: 550 + Math.random() * 250, easing: 'cubic-bezier(.1,.7,.3,1)' }
    ).onfinish = () => p.remove();
  }
}

defineExpose({ puff, isVisible });
</script>

<style scoped>
.ogg-sentinel { height: 0; }

.ogg {
  position: sticky;
  /* Высоту липкой шапки платформы подставляет страница */
  top: var(--og-sticky-top, 0px);
  z-index: 44;
  margin-inline: -6px;
  padding: 4px 6px 6px;
  transition: background 0.2s;
}

.ogg.is-stuck {
  background: var(--og-bg);
  box-shadow: 0 4px 0 var(--og-shade);
}

.ogg__wire {
  position: relative;
  display: flex;
  justify-content: space-between;
  gap: 2px;
  padding: 14px 2px 2px;
}

/* Провод провисает между крайними огоньками */
.ogg__wire::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 6px;
  height: 12px;
  border-top: 2px dashed #b0434e;
  border-radius: 50%;
}

.ogg__bulb {
  position: relative;
  width: 12px;
  height: 16px;
  flex: none;
}

.ogg__bulb i {
  position: absolute;
  inset: 0;
  background: #5e1c26;
  border: 2px solid #7d2c37;
  clip-path: polygon(30% 0, 70% 0, 70% 20%, 100% 35%, 100% 85%, 70% 100%, 30% 100%, 0 85%, 0 35%, 30% 20%);
}

.ogg__bulb.is-on i {
  background: var(--c);
  border-color: var(--c);
  filter: drop-shadow(0 0 6px var(--c));
}

.ogg__bulb.is-on::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 60%;
  width: 26px;
  height: 26px;
  transform: translate(-50%, -50%);
  background: radial-gradient(circle, var(--c) 0, transparent 65%);
  opacity: 0.45;
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .ogg { transition: none; }
}
</style>

<style>
.ogg-puff {
  position: fixed;
  width: 4px;
  height: 4px;
  z-index: 70;
  pointer-events: none;
}
</style>
