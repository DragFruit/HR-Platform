<template>
  <button
    ref="rootRef"
    type="button"
    class="ogs"
    :class="{
      'is-torn': day.opened,
      'is-done': day.done,
      'is-locked': locked,
      'is-today': day.today && !day.opened,
      'is-missed': day.missed,
      'is-lifting': lifting
    }"
    :aria-label="ariaLabel"
    @click="$emit('open', day.id, rootRef)"
  >
    <!-- Под листком: предмет окна, название и статус -->
    <span class="ogs__under">
      <OgonekSprite class="ogs__ico" :rows="objectRows" width-css="52%" />
      <span class="ogs__t">{{ day.opened ? day.title : '' }}</span>
      <span v-if="day.done" class="ogs__chip ogs__chip--ok">ВЫПОЛНЕНО</span>
      <span v-else-if="day.opened" class="ogs__chip ogs__chip--new">ЖДЁТ ВАС</span>
      <span class="ogs__n">№{{ day.id }}</span>
    </span>

    <!-- Корешок с дырками — к нему крепится листок -->
    <span class="ogs__stub" aria-hidden="true" />

    <!-- Сам листок: отрывается при первом открытии -->
    <span v-if="!day.opened" ref="sheetRef" class="ogs__sheet" aria-hidden="true">
      <span class="ogs__m">Декабрь 2026</span>
      <span class="ogs__big" :class="{ 'is-red': red }">{{ dayOfMonth }}</span>
      <span class="ogs__wd" :class="{ 'is-red': red }">{{ day.weekday }}</span>
      <span class="ogs__sun">Восход {{ sun.rise }} · Заход {{ sun.set }}<br>Долгота дня {{ sun.len }}</span>
    </span>
  </button>
</template>

<script setup lang="ts">
/**
 * Листок отрывного календаря. Под ним лежит предмет окна; при первом
 * открытии листок отрывается и улетает, дальше карточка показывает
 * название и статус.
 *
 * Оторванный листок — серверное состояние (`day.opened`), а не анимация:
 * перезагрузка страницы не возвращает его на место.
 */
import { OGONEK_OBJECTS } from '~/events/ogonek/sprites';
import { ogonekSun } from '~/events/ogonek/sun';
import type { OgonekDayView } from '~/events/ogonek/types';

const props = defineProps<{ day: OgonekDayView }>();
defineEmits<{ open: [id: number, el: HTMLElement | null] }>();

const rootRef = ref<HTMLElement | null>(null);
const sheetRef = ref<HTMLElement | null>(null);
const lifting = ref(false);

const objectRows = computed(() => OGONEK_OBJECTS[props.day.object] ?? OGONEK_OBJECTS.ogonek);
const sun = computed(() => ogonekSun(props.day.dateIso));
const dayOfMonth = computed(() => Number(props.day.dateIso.slice(8, 10)));
/** Красным — день Огонька: праздник, как красная дата на настоящем листке. */
const red = computed(() => props.day.kind === 'final');
/** Закрыт календарём: дата ещё не наступила. Очередь — отдельная история. */
const locked = computed(() => !props.day.opened && !props.day.scheduleOpen);

const ariaLabel = computed(() => {
  const when = `${dayOfMonth.value} декабря, ${props.day.weekday}.`;
  if (locked.value) return `${when} Ещё закрыт.`;
  if (props.day.done) return `${when} ${props.day.title}. Выполнено.`;
  if (props.day.opened) return `${when} ${props.day.title}. Задание ждёт.`;
  return `${when} Нажмите, чтобы оторвать листок.`;
});

const reduce = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/** Крошки бумаги с линии отрыва. */
function crumbs(r: DOMRect) {
  for (let i = 0; i < 10; i++) {
    const c = document.createElement('i');
    c.className = 'ogs-crumb';
    c.style.left = `${r.left + Math.random() * r.width}px`;
    c.style.top = `${r.top - 2}px`;
    document.body.appendChild(c);
    const dx = (Math.random() - 0.5) * 60;
    const dy = 40 + Math.random() * 70;
    c.animate(
      [
        { transform: 'translate(0,0) rotate(0)', opacity: 1 },
        { transform: `translate(${dx}px,${dy}px) rotate(${Math.random() * 360}deg)`, opacity: 0 }
      ],
      { duration: 600 + Math.random() * 400, easing: 'cubic-bezier(.3,.1,.7,1)' }
    ).onfinish = () => c.remove();
  }
}

/**
 * Отрыв листка: дёрнуть, сорвать, уронить. Возвращает промис — страница
 * ждёт его, прежде чем раскрывать день.
 */
async function tear(): Promise<void> {
  const sheet = sheetRef.value;
  if (!sheet) return;
  lifting.value = true;
  if (reduce()) {
    await sheet.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }).finished;
    return;
  }
  const r = sheet.getBoundingClientRect();
  await sheet.animate(
    [
      { transform: 'none' },
      { transform: 'translateY(5px) rotate(.8deg)', offset: 0.45 },
      { transform: 'translateY(2px) rotate(-1.6deg)' }
    ],
    { duration: 260, easing: 'ease-out', fill: 'forwards' }
  ).finished;
  crumbs(r);
  await sheet.animate(
    [
      { transform: 'translateY(2px) rotate(-1.6deg)', opacity: 1, boxShadow: '4px 4px 0 #1c0307' },
      { transform: 'translate(-18%, 30%) rotate(-22deg)', opacity: 1, boxShadow: '14px 18px 0 rgba(28,3,7,.6)', offset: 0.4 },
      { transform: 'translate(-45%, 170%) rotate(-58deg)', opacity: 0, boxShadow: '24px 30px 0 rgba(28,3,7,0)' }
    ],
    { duration: 720, easing: 'cubic-bezier(.45,.05,.7,.4)', fill: 'forwards' }
  ).finished;
}

/** Закрытый день: потрясти карточку. */
function shake() {
  const el = rootRef.value;
  if (!el || reduce()) return;
  el.animate(
    [
      { transform: 'none' },
      { transform: 'translateX(-4px)', offset: 0.2 },
      { transform: 'translateX(4px)', offset: 0.4 },
      { transform: 'translateX(-3px)', offset: 0.6 },
      { transform: 'translateX(2px)', offset: 0.8 },
      { transform: 'none' }
    ],
    { duration: 400 }
  );
}

/** Вернулись из дня: вспышка вокруг карточки. */
function pulse() {
  const el = rootRef.value?.querySelector('.ogs__under') as HTMLElement | null;
  if (!el || reduce()) return;
  el.animate(
    [
      { boxShadow: '0 0 0 0 rgba(255,207,74,.9), 4px 4px 0 #1c0307' },
      { boxShadow: '0 0 0 18px rgba(255,207,74,0), 4px 4px 0 #1c0307' }
    ],
    { duration: 1000, easing: 'ease-out' }
  );
}

function settle() {
  lifting.value = false;
}

defineExpose({ tear, shake, pulse, settle, el: rootRef });
</script>

<style scoped>
.ogs {
  position: relative;
  aspect-ratio: 3 / 4;
  border: 0;
  padding: 0;
  background: none;
  cursor: pointer;
  text-align: left;
  max-width: 100%;
  font: inherit;
  color: inherit;
}

.ogs.is-lifting { z-index: 20; }

.ogs__under {
  position: absolute;
  inset: 0;
  background: var(--og-bg-3);
  border: 2px solid #9a2836;
  box-shadow: 4px 4px 0 var(--og-shade);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 20% 8px 10px;
  overflow: hidden;
}

.ogs__ico { max-width: 96px; }

.ogs__t {
  font-size: 13px;
  line-height: 1.25;
  text-align: center;
  color: #ffe6e3;
  font-weight: 700;
}

.ogs__chip {
  font-family: var(--og-pixel);
  font-size: 7px;
  letter-spacing: 0.06em;
  padding: 4px 5px;
  background: #9a2836;
  color: #ffd9d6;
}

.ogs__chip--ok { background: var(--og-green); color: #06210f; }
.ogs__chip--new { background: var(--og-gold); color: #3a2600; }

.ogs__n {
  position: absolute;
  right: 7px;
  bottom: 6px;
  font-family: var(--og-pixel);
  font-size: 8px;
  color: #d07a83;
}

.ogs.is-done .ogs__under { background: #5f101c; }

/* Галочка выполненного окна */
.ogs.is-done .ogs__under::after {
  content: '';
  position: absolute;
  right: 6px;
  top: 22%;
  width: 14px;
  height: 14px;
  background: var(--og-green);
  clip-path: polygon(0 55%, 15% 40%, 40% 62%, 85% 10%, 100% 25%, 40% 92%);
}

/* Корешок с отверстиями под кольца */
.ogs__stub {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 16%;
  background: var(--og-paper);
  z-index: 2;
  background-image: radial-gradient(circle at 50% 55%, var(--og-bg) 0 3px, transparent 3.5px);
  background-size: 22px 100%;
  background-position: center;
  background-repeat: repeat-x;
}

.ogs.is-torn .ogs__stub {
  clip-path: var(--og-zig);
  height: calc(16% + 6px);
  background-color: var(--og-paper-2);
}

.ogs__sheet {
  position: absolute;
  left: 0;
  right: 0;
  top: 16%;
  bottom: 0;
  z-index: 3;
  background: var(--og-paper);
  color: var(--og-ink);
  border-top: 2px dashed #cdbfb2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 6px 6px 8px;
  box-shadow: 4px 4px 0 var(--og-shade);
  transform-origin: 100% 0;
  will-change: transform;
  transition: transform 0.18s ease;
}

.ogs__m {
  font-family: var(--og-narrow);
  font-size: clamp(10px, 1.1vw, 12px);
  letter-spacing: 0.16em;
  color: var(--og-ink-soft);
  text-transform: uppercase;
}

.ogs__big {
  font-family: var(--og-pixel);
  font-size: clamp(26px, 4.4vw, 46px);
  line-height: 1;
  color: var(--og-ink);
  text-shadow: 3px 3px 0 #ddd0c3;
}

.ogs__wd {
  font-family: var(--og-narrow);
  font-size: clamp(11px, 1.2vw, 14px);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.ogs__big.is-red,
.ogs__wd.is-red { color: var(--og-red); }

.ogs__sun {
  font-size: 10px;
  line-height: 1.25;
  color: var(--og-ink-soft);
  text-align: center;
  font-variant-numeric: tabular-nums;
}

/* Сегодняшний листок светится и подписан */
.ogs.is-today .ogs__sheet {
  box-shadow: 0 0 0 3px var(--og-gold), 0 0 24px rgba(255, 207, 74, 0.6), 4px 4px 0 var(--og-shade);
}

.ogs.is-today .ogs__sheet::after {
  content: 'СЕГОДНЯ';
  position: absolute;
  left: 50%;
  top: -11px;
  transform: translateX(-50%);
  font-family: var(--og-pixel);
  font-size: 7px;
  background: var(--og-gold);
  color: #3a2600;
  padding: 3px 5px;
  white-space: nowrap;
}

/* Закрыт календарём: серый листок с замком */
.ogs.is-locked { cursor: not-allowed; }
.ogs.is-locked .ogs__sheet { background: #d8c6c2; color: #8d6f6f; }
.ogs.is-locked .ogs__big { color: #a48584; text-shadow: none; }

.ogs.is-locked .ogs__sheet::before {
  content: '';
  position: absolute;
  right: 6px;
  top: 6px;
  width: 12px;
  height: 14px;
  background: #a48584;
  clip-path: polygon(20% 40%, 20% 15%, 35% 0, 65% 0, 80% 15%, 80% 40%, 100% 40%, 100% 100%, 0 100%, 0 40%, 35% 40%, 35% 20%, 65% 20%, 65% 40%);
}

/* Пропущенный день: красный уголок */
.ogs.is-missed .ogs__sheet::before {
  content: '';
  position: absolute;
  right: 0;
  top: 0;
  width: 14px;
  height: 14px;
  background: var(--og-red);
  clip-path: polygon(0 0, 100% 0, 100% 100%);
}

@media (hover: hover) {
  .ogs:not(.is-locked):not(.is-torn):hover .ogs__sheet { transform: rotate(-1.2deg) translateY(2px); }
  .ogs.is-torn:hover .ogs__under { border-color: var(--og-gold); }
}

@media (max-width: 620px) {
  /* Узкая карточка: выше и с мелким предметом, иначе его срезает корешок */
  .ogs { aspect-ratio: 3 / 4.7; }
  .ogs__under { justify-content: flex-start; padding: calc(16% + 12px) 4px 6px; gap: 4px; }
  .ogs__ico { max-width: 56px; }
  .ogs__t { font-size: 12px; }
  .ogs__n { display: none; }
  .ogs__sun { display: none; }
  .ogs__sheet { justify-content: space-evenly; }
  .ogs__m { font-size: 9px; letter-spacing: 0.08em; }
}

@media (prefers-reduced-motion: reduce) {
  .ogs__sheet { transition: none; }
}
</style>

<style>
/* Крошки бумаги живут в body — вне scoped-стилей компонента */
.ogs-crumb {
  position: fixed;
  width: 5px;
  height: 5px;
  background: #f3efe9;
  z-index: 60;
  pointer-events: none;
}
</style>
