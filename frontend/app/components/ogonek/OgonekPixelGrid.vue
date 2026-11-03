<template>
  <div
    ref="gridRef"
    class="og-grid"
    :style="{ '--og-grid-n': String(size), '--og-grid-px': `${cell}px` }"
    @pointerdown.prevent="onDown"
    @pointermove="onMove"
    @pointerup="stop"
    @pointercancel="stop"
    @pointerleave="stop"
  >
    <button
      v-for="cellInfo in cells"
      :key="cellInfo.key"
      type="button"
      tabindex="-1"
      class="og-grid__cell"
      :style="{ background: cellInfo.color || 'transparent' }"
      :aria-label="`Клетка ${cellInfo.x + 1}, ${cellInfo.y + 1}`"
      @keydown.enter.prevent="applyOne(cellInfo.x, cellInfo.y, brush)"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * Пиксельная сетка, по которой рисуют руками.
 *
 * Симметрия `octal` нужна снежинке: лист складывают, и вырез повторяется
 * восемь раз — как в детстве с ножницами. Для игрушки симметрии нет,
 * иначе все игрушки получатся одинаковыми.
 */
import { ogonekColorAt } from '~/events/ogonek/palette';

const props = withDefaults(
  defineProps<{
    modelValue: string[];
    size: number;
    cell?: number;
    /** Символ палитры, которым рисуем. '.' стирает. */
    brush: string;
    symmetry?: 'none' | 'octal';
    disabled?: boolean;
  }>(),
  { cell: 20, symmetry: 'none', disabled: false }
);

const emit = defineEmits<{ 'update:modelValue': [rows: string[]] }>();

const gridRef = ref<HTMLElement | null>(null);
/** Что рисуем на протяжении одного движения: сначала нажали — потом тянем. */
const painting = ref<string | null>(null);

const cells = computed(() => {
  const out: { key: string; x: number; y: number; color: string | null }[] = [];
  for (let y = 0; y < props.size; y++) {
    const row = props.modelValue[y] ?? '';
    for (let x = 0; x < props.size; x++) {
      out.push({ key: `${x}-${y}`, x, y, color: ogonekColorAt(row[x] ?? '.') });
    }
  }
  return out;
});

/** Восемь отражений клетки относительно центра. */
function mirrored(x: number, y: number): [number, number][] {
  if (props.symmetry !== 'octal') return [[x, y]];
  const c = (props.size - 1) / 2;
  const dx = x - c;
  const dy = y - c;
  const variants: [number, number][] = [
    [dx, dy], [-dx, dy], [dx, -dy], [-dx, -dy],
    [dy, dx], [-dy, dx], [dy, -dx], [-dy, -dx]
  ];
  return variants.map(([ax, ay]) => [Math.round(c + ax), Math.round(c + ay)] as [number, number]);
}

/**
 * Клетка под указателем считается по координатам, а не ловится событием
 * `pointerenter` на самой клетке: при быстром движении браузер проскакивает
 * промежуточные клетки, и в сетке оставались дырки.
 */
function cellAt(e: PointerEvent): [number, number] | null {
  const el = gridRef.value;
  if (!el) return null;
  const box = el.getBoundingClientRect();
  const pad = 6;
  const step = props.cell + 1;
  const x = Math.floor((e.clientX - box.left - pad) / step);
  const y = Math.floor((e.clientY - box.top - pad) / step);
  if (x < 0 || y < 0 || x >= props.size || y >= props.size) return null;
  return [x, y];
}

/**
 * Буфер штриха. Все клетки одного движения правятся в нём и уезжают наверх
 * одним событием: если читать `modelValue` на каждую клетку, из него уцелеет
 * только последняя — пропс обновляется не сразу, и линия рассыпается на точки.
 */
let draft: string[][] | null = null;

function apply(points: [number, number][], ch: string) {
  if (!draft) draft = props.modelValue.map((r) => r.split(''));
  for (const [x, y] of points) {
    for (const [mx, my] of mirrored(x, y)) {
      const row = draft[my];
      if (!row || mx < 0 || mx >= props.size) continue;
      row[mx] = ch;
    }
  }
  emit('update:modelValue', draft.map((r) => r.join('')));
}

/** Последняя закрашенная клетка — от неё ведём линию до текущей. */
let lastCell: [number, number] | null = null;

/**
 * Клетки между двумя точками. Указатель движется быстрее, чем браузер шлёт
 * события, поэтому без дорисовки линии в штрихе оставались пропуски.
 */
function lineTo(x1: number, y1: number): [number, number][] {
  const from = lastCell;
  lastCell = [x1, y1];
  if (!from) return [[x1, y1]];
  let [x0, y0] = from;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  const out: [number, number][] = [];
  for (;;) {
    out.push([x0, y0]);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
  return out;
}

function onDown(e: PointerEvent) {
  if (props.disabled) return;
  painting.value = props.brush;
  draft = null;
  lastCell = null;
  gridRef.value?.setPointerCapture?.(e.pointerId);
  const at = cellAt(e);
  if (at) apply(lineTo(at[0], at[1]), props.brush);
}

function onMove(e: PointerEvent) {
  if (props.disabled || painting.value === null) return;
  const at = cellAt(e);
  if (at) apply(lineTo(at[0], at[1]), painting.value);
}

function stop() {
  painting.value = null;
  draft = null;
  lastCell = null;
}

/** Клавиатурный ввод: закрасить одну клетку. */
function applyOne(x: number, y: number, ch: string) {
  draft = null;
  lastCell = null;
  apply([[x, y]], ch);
  draft = null;
}
</script>

<style scoped>
.og-grid {
  display: grid;
  grid-template-columns: repeat(var(--og-grid-n), var(--og-grid-px));
  gap: 1px;
  padding: 6px;
  background: #1a1412;
  border: 2px solid #d99a2b;
  border-radius: 4px;
  width: max-content;
  max-width: 100%;
  touch-action: none;
}

/*
  На телефоне 16 клеток по 20px не влезают в модалку шириной 375px.
  Клетка ужимается, и сетка остаётся целой — горизонтального скролла нет.
*/
@media (max-width: 460px) {
  .og-grid {
    --og-grid-px: min(var(--og-grid-px), calc((100vw - 76px) / var(--og-grid-n)));
  }
}

.og-grid__cell {
  width: var(--og-grid-px);
  height: var(--og-grid-px);
  padding: 0;
  border: 0;
  border-radius: 0;
  cursor: crosshair;
  box-shadow: inset 0 0 0 1px rgba(232, 215, 180, 0.08);
}

.og-grid__cell:hover {
  box-shadow: inset 0 0 0 1px rgba(232, 215, 180, 0.45);
}
</style>
