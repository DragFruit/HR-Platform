<template>
  <div class="nk-stage" :class="{ 'nk-stage--full': fullscreen }">
    <div class="nk-stage__bar">
      <p class="nk-stage__case">Дело Костелова · «Синий Ноктюрн»</p>
      <p class="nk-stage__deadline" role="status">{{ deadlineLabel }}</p>
      <div class="nk-stage__bar-right">
        <span v-if="threads.length" class="nk-stage__threads">
          Нити: {{ threads.length }} / {{ threadLimit }}
        </span>
        <button type="button" class="nk-btn nk-btn--ghost" @click="emit('toggle-fullscreen')">
          {{ fullscreen ? 'Свернуть' : 'Развернуть' }}
        </button>
      </div>
    </div>

    <div class="nk-stage__body">
      <!--
        Контейнер доски — собственный слой: все координаты считаются от
        getBoundingClientRect(), поэтому курсор и отрисовка не расходятся
        ни при масштабе платформы 90%, ни в полном экране.
      -->
      <div
        ref="boardEl"
        class="nk-board"
        :style="{ backgroundImage: `url(${art.cork})` }"
        @pointerdown="onBoardPointerDown"
      >
        <p v-if="!items.length" class="nk-board__empty">{{ micro.emptyBoard }}</p>
        <p v-else-if="threads.length" class="nk-board__hint">{{ micro.threadHint }}</p>

        <svg class="nk-board__web" :viewBox="`0 0 ${size.w || 1} ${size.h || 1}`">
          <g v-for="t in threadLines" :key="t.id">
            <line
              class="nk-board__thread-hit"
              :x1="t.x1"
              :y1="t.y1"
              :x2="t.x2"
              :y2="t.y2"
              @dblclick.stop="removeThread(t.id)"
            />
            <line class="nk-board__thread" :x1="t.x1" :y1="t.y1" :x2="t.x2" :y2="t.y2" />
          </g>
          <line
            v-if="draftLine"
            class="nk-board__thread nk-board__thread--draft"
            :x1="draftLine.x1"
            :y1="draftLine.y1"
            :x2="draftLine.x2"
            :y2="draftLine.y2"
          />
        </svg>

        <div
          v-for="item in placedItems"
          :key="item.id"
          class="nk-pinned"
          :class="{ 'is-dragging': drag?.id === item.id }"
          :style="{ left: `${item.x * 100}%`, top: `${item.y * 100}%` }"
        >
          <button
            type="button"
            class="nk-pinned__pin"
            :aria-label="`Нить от улики «${item.evidence.title}»`"
            @pointerdown.stop="onPinDown($event, item.id)"
          >
            <img :src="art.pinRed" alt="" aria-hidden="true" draggable="false" />
          </button>
          <div
            class="nk-pinned__card"
            role="button"
            tabindex="0"
            :aria-label="item.evidence.title"
            @pointerdown="onItemDown($event, item.id)"
            @keydown.enter="emit('open-evidence', item.evidence)"
          >
            <NokturnEvidenceCard
              :evidence="item.evidence"
              variant="board"
              :bag-src="art.evidenceBag"
            />
          </div>
        </div>

        <div class="nk-board__game">
          <NokturnMinigameButton
            v-if="activeStage"
            :stage="activeStage"
            :countdown="minigameCountdown"
            :micro="micro"
            :attempts-total="attemptsTotal"
            :icon="art.minigameIcon"
            @play="emit('play', activeStage.id)"
          />
        </div>
      </div>

      <aside class="nk-safe" aria-label="Сейф улик">
        <header class="nk-safe__head">
          <h2 class="nk-safe__title">Сейф улик</h2>
          <div class="nk-safe__tabs" role="tablist">
            <button
              type="button"
              role="tab"
              class="nk-safe__tab"
              :class="{ 'is-on': tab === 'evidence' }"
              :aria-selected="tab === 'evidence'"
              @click="tab = 'evidence'"
            >
              Улики
            </button>
            <button
              type="button"
              role="tab"
              class="nk-safe__tab"
              :class="{ 'is-on': tab === 'testimony' }"
              :aria-selected="tab === 'testimony'"
              @click="tab = 'testimony'"
            >
              Показания
            </button>
          </div>
        </header>

        <div class="nk-safe__calendar">
          <button
            v-for="s in stages"
            :key="s.id"
            type="button"
            class="nk-safe__day"
            :class="[`is-${s.minigame.state}`, { 'is-voted': Boolean(s.vote) }]"
            :title="dayHint(s)"
            :disabled="s.minigame.state === 'locked' || s.minigame.state === 'blocked-by-stage'"
            @click="emit('play', s.id)"
          >
            <span class="nk-safe__day-n">{{ s.id }}</span>
            <span class="nk-safe__day-w">{{ s.weekday.slice(0, 2) }}</span>
          </button>
        </div>

        <div v-if="tab === 'evidence'" class="nk-safe__list">
          <p v-if="!safeEvidence.length" class="nk-safe__empty">
            Пакет дня пока пуст. Улики появятся, когда этап откроется.
          </p>
          <div
            v-for="ev in safeEvidence"
            :key="ev.id"
            class="nk-safe__item"
            role="button"
            tabindex="0"
            :aria-label="ev.title"
            @pointerdown="onSafeDown($event, ev.id)"
            @keydown.enter="emit('open-evidence', ev)"
          >
            <NokturnEvidenceCard :evidence="ev" variant="safe" :bag-src="art.evidenceBag" />
          </div>
        </div>

        <div v-else class="nk-safe__list">
          <p v-if="!testimonies.length" class="nk-safe__empty">Показаний пока нет.</p>
          <article v-for="(t, i) in testimonies" :key="`${t.stage}-${t.suspectId}-${i}`" class="nk-word">
            <header class="nk-word__head">
              <img
                class="nk-word__photo"
                :src="suspectById[t.suspectId]?.photo"
                :alt="suspectById[t.suspectId]?.name || ''"
                draggable="false"
              />
              <div>
                <p class="nk-word__name">{{ suspectById[t.suspectId]?.name }}</p>
                <p class="nk-word__role">{{ suspectById[t.suspectId]?.role }}</p>
              </div>
            </header>
            <p class="nk-word__text">«{{ t.text }}»</p>
          </article>
        </div>
      </aside>
    </div>

    <!-- Призрак улики, пока её тащат из сейфа. -->
    <div
      v-if="ghost"
      class="nk-ghost"
      :style="{ left: `${ghost.x}px`, top: `${ghost.y}px` }"
      aria-hidden="true"
    >
      <NokturnEvidenceCard :evidence="ghost.evidence" variant="board" :bag-src="art.evidenceBag" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  NokturnBoard,
  NokturnBoardItem,
  NokturnBoardThread,
  NokturnEvidence,
  NokturnStageId,
  NokturnStageView,
  NokturnSuspect
} from '~/events/nokturn/types';

const props = defineProps<{
  board: NokturnBoard;
  stages: NokturnStageView[];
  suspects: NokturnSuspect[];
  art: Record<string, string>;
  micro: Record<string, string>;
  threadLimit: number;
  attemptsTotal: number;
  fullscreen: boolean;
  deadlineLabel: string;
  minigameCountdown: string;
  activeStage: NokturnStageView | null;
}>();

const emit = defineEmits<{
  'update:board': [NokturnBoard];
  'toggle-fullscreen': [];
  play: [NokturnStageId];
  'open-evidence': [NokturnEvidence];
}>();

const tab = ref<'evidence' | 'testimony'>('evidence');
const boardEl = ref<HTMLElement | null>(null);
const size = ref({ w: 0, h: 0 });

const items = computed(() => props.board.items);
const threads = computed(() => props.board.threads);

const allEvidence = computed<NokturnEvidence[]>(() =>
  props.stages.flatMap((s) => s.evidence)
);
const evidenceById = computed(() => {
  const map: Record<string, NokturnEvidence> = {};
  for (const e of allEvidence.value) map[e.id] = e;
  return map;
});
const suspectById = computed(() => {
  const map: Record<string, NokturnSuspect> = {};
  for (const s of props.suspects) map[s.id] = s;
  return map;
});

/** На доске — только те улики, которые игрок уже получил. */
const placedItems = computed(() =>
  items.value
    .filter((i) => evidenceById.value[i.id])
    .map((i) => ({ ...i, evidence: evidenceById.value[i.id] as NokturnEvidence }))
);

const onBoardIds = computed(() => new Set(items.value.map((i) => i.id)));
const safeEvidence = computed(() => allEvidence.value.filter((e) => !onBoardIds.value.has(e.id)));
const testimonies = computed(() => props.stages.flatMap((s) => s.testimonies));

const threadLines = computed(() => {
  const pos: Record<string, NokturnBoardItem> = {};
  for (const i of items.value) pos[i.id] = i;
  return threads.value
    .map((t) => {
      const a = pos[t.from];
      const b = pos[t.to];
      if (!a || !b) return null;
      return {
        id: t.id,
        x1: a.x * size.value.w,
        y1: a.y * size.value.h,
        x2: b.x * size.value.w,
        y2: b.y * size.value.h
      };
    })
    .filter((l): l is { id: string; x1: number; y1: number; x2: number; y2: number } => Boolean(l));
});

function dayHint(s: NokturnStageView): string {
  if (s.minigame.state === 'locked') return `${s.weekday}: откроется в 10:00`;
  if (s.minigame.state === 'blocked-by-stage') {
    return props.micro.stageBlocked.replace('{N}', String(s.blockedByStage ?? ''));
  }
  if (s.minigame.state === 'done') return `${s.weekday}: улика получена`;
  return `${s.weekday}: ${s.minigame.title}`;
}

/* ----------------------------------------------------------- перетаскивание */

type DragState = {
  id: string;
  mode: 'move' | 'from-safe';
  offX: number;
  offY: number;
  startX: number;
  startY: number;
  moved: boolean;
};

const drag = ref<DragState | null>(null);
const ghost = ref<{ x: number; y: number; evidence: NokturnEvidence } | null>(null);
const draft = ref<{ from: string; x: number; y: number } | null>(null);

const draftLine = computed(() => {
  if (!draft.value) return null;
  const a = items.value.find((i) => i.id === draft.value?.from);
  if (!a) return null;
  return {
    x1: a.x * size.value.w,
    y1: a.y * size.value.h,
    x2: draft.value.x,
    y2: draft.value.y
  };
});

const MOVE_THRESHOLD = 4;
const PIN_SNAP_PX = 36;

function boardRect(): DOMRect | null {
  return boardEl.value?.getBoundingClientRect() ?? null;
}

/** Курсор → доли доски. Работает под любым CSS-масштабом: rect уже с трансформом. */
function toFraction(clientX: number, clientY: number) {
  const rect = boardRect();
  if (!rect || !rect.width || !rect.height) return { x: 0.5, y: 0.5 };
  return {
    x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
    y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height))
  };
}

function insideBoard(clientX: number, clientY: number) {
  const rect = boardRect();
  if (!rect) return false;
  return (
    clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
  );
}

function emitBoard(next: Partial<NokturnBoard>) {
  emit('update:board', {
    items: next.items ?? items.value,
    threads: next.threads ?? threads.value
  });
}

function onItemDown(e: PointerEvent, id: string) {
  if (e.button !== 0) return;
  const item = items.value.find((i) => i.id === id);
  const rect = boardRect();
  if (!item || !rect) return;
  drag.value = {
    id,
    mode: 'move',
    offX: e.clientX - (rect.left + item.x * rect.width),
    offY: e.clientY - (rect.top + item.y * rect.height),
    startX: e.clientX,
    startY: e.clientY,
    moved: false
  };
  bindWindow();
}

function onSafeDown(e: PointerEvent, id: string) {
  if (e.button !== 0) return;
  const evidence = evidenceById.value[id];
  if (!evidence) return;
  drag.value = {
    id,
    mode: 'from-safe',
    offX: 0,
    offY: 0,
    startX: e.clientX,
    startY: e.clientY,
    moved: false
  };
  ghost.value = { x: e.clientX, y: e.clientY, evidence };
  bindWindow();
}

function onPinDown(e: PointerEvent, id: string) {
  if (e.button !== 0) return;
  if (threads.value.length >= props.threadLimit) return;
  const p = toFraction(e.clientX, e.clientY);
  draft.value = { from: id, x: p.x * size.value.w, y: p.y * size.value.h };
  bindWindow();
}

function onBoardPointerDown(e: PointerEvent) {
  // Клик по пустой пробке снимает незаконченную нить.
  if (e.target === boardEl.value) draft.value = null;
}

function onMove(e: PointerEvent) {
  if (draft.value) {
    const p = toFraction(e.clientX, e.clientY);
    draft.value = { ...draft.value, x: p.x * size.value.w, y: p.y * size.value.h };
    return;
  }
  const d = drag.value;
  if (!d) return;
  if (!d.moved) {
    const far =
      Math.abs(e.clientX - d.startX) > MOVE_THRESHOLD ||
      Math.abs(e.clientY - d.startY) > MOVE_THRESHOLD;
    if (!far) return;
    d.moved = true;
  }
  if (d.mode === 'move') {
    const p = toFraction(e.clientX - d.offX, e.clientY - d.offY);
    emitBoard({
      items: items.value.map((i) => (i.id === d.id ? { ...i, x: p.x, y: p.y } : i))
    });
    return;
  }
  if (ghost.value) ghost.value = { ...ghost.value, x: e.clientX, y: e.clientY };
}

function onUp(e: PointerEvent) {
  const d = drag.value;
  const dr = draft.value;
  unbindWindow();
  draft.value = null;
  ghost.value = null;
  drag.value = null;

  if (dr) {
    finishThread(dr.from, e.clientX, e.clientY);
    return;
  }
  if (!d) return;

  if (!d.moved) {
    const evidence = evidenceById.value[d.id];
    if (evidence) emit('open-evidence', evidence);
    return;
  }

  if (d.mode === 'from-safe') {
    if (!insideBoard(e.clientX, e.clientY)) return;
    const p = toFraction(e.clientX, e.clientY);
    emitBoard({ items: [...items.value, { id: d.id, x: p.x, y: p.y }] });
    return;
  }

  // Улику вынесли за доску — она возвращается в сейф вместе со своими нитями.
  if (!insideBoard(e.clientX, e.clientY)) {
    emitBoard({
      items: items.value.filter((i) => i.id !== d.id),
      threads: threads.value.filter((t) => t.from !== d.id && t.to !== d.id)
    });
  }
}

function finishThread(fromId: string, clientX: number, clientY: number) {
  const rect = boardRect();
  if (!rect) return;
  let best: { id: string; dist: number } | null = null;
  for (const i of items.value) {
    if (i.id === fromId) continue;
    const dx = rect.left + i.x * rect.width - clientX;
    const dy = rect.top + i.y * rect.height - clientY;
    const dist = Math.hypot(dx, dy);
    if (!best || dist < best.dist) best = { id: i.id, dist };
  }
  if (!best || best.dist > PIN_SNAP_PX) return;
  const exists = threads.value.some(
    (t) =>
      (t.from === fromId && t.to === best?.id) || (t.from === best?.id && t.to === fromId)
  );
  if (exists) return;
  if (threads.value.length >= props.threadLimit) return;
  const thread: NokturnBoardThread = {
    id: `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    from: fromId,
    to: best.id
  };
  emitBoard({ threads: [...threads.value, thread] });
}

function removeThread(id: string) {
  emitBoard({ threads: threads.value.filter((t) => t.id !== id) });
}

function bindWindow() {
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
}
function unbindWindow() {
  window.removeEventListener('pointermove', onMove);
  window.removeEventListener('pointerup', onUp);
  window.removeEventListener('pointercancel', onUp);
}

let ro: ResizeObserver | null = null;
const measure = () => {
  const rect = boardRect();
  if (rect) size.value = { w: rect.width, h: rect.height };
};

onMounted(() => {
  measure();
  if (boardEl.value && typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(measure);
    ro.observe(boardEl.value);
  }
  window.addEventListener('resize', measure);
});

onBeforeUnmount(() => {
  ro?.disconnect();
  ro = null;
  window.removeEventListener('resize', measure);
  unbindWindow();
});

// Полный экран меняет геометрию доски — пересчитываем после перерисовки.
watch(
  () => props.fullscreen,
  () => nextTick(measure)
);
</script>
