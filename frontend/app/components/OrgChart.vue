<template>
  <div
    class="org-chart org-chart-vbi"
    :class="{
      'org-chart--readonly': readonly,
      'org-chart--edit': !readonly,
      'org-chart--compress-x': layoutCompressX < 0.999
    }"
    :style="{ '--org-compress-x': String(layoutCompressX) }"
  >
    <div ref="stageRef" class="org-chart-viewport">
      <div class="org-chart-board">
        <div class="org-chart-scale-slot" :style="scaleSlotStyle">
          <div class="org-chart-scale" :style="scaleInnerStyle">
            <div
              ref="mainCanvasRef"
              class="org-chart-canvas"
              :class="{
                'org-chart-canvas--edit': !readonly,
                'org-chart-canvas--view': readonly,
                'org-chart-canvas--dragging': dragging || resizing || unitLocalDrag || labelLocalDrag || linkMidDrag,
                'org-chart-canvas--linking': showOrgLinks && Boolean(linkDraftFrom)
              }"
              :style="canvasBoxStyle"
            >
      <svg
        v-if="showOrgLinks"
        class="org-links-svg"
        :style="{ height: `${canvasBaseHeightPx}px` }"
        aria-hidden="true"
      >
        <path
          v-for="path in resolvedLinkPaths"
          :key="path.id"
          :d="path.d"
          class="org-link-path"
          :class="{ 'org-link-path--editable': !readonly }"
          @dblclick.stop="!readonly && removeLink(path.id)"
        />
        <path
          v-for="path in resolvedLinkPaths"
          v-show="!readonly"
          :key="`hit-${path.id}`"
          :d="path.d"
          class="org-link-path-hit"
          @pointerdown.stop="(e) => startLinkMidDrag(path.id, e)"
        />
        <circle
          v-for="h in resolvedMidHandles"
          v-show="!readonly"
          :key="`mh-${h.id}`"
          class="org-link-mid-handle"
          :class="{ 'is-active': linkMidDrag?.linkId === h.id }"
          :cx="h.x"
          :cy="h.y"
          r="6"
          @pointerdown.stop="(e) => startLinkMidDrag(h.id, e)"
        />
        <circle
          v-for="j in resolvedJunctions"
          v-show="!readonly"
          :key="`j-${j.key}`"
          class="org-link-junction"
          :cx="j.x"
          :cy="j.y"
          r="4.5"
        />
        <path
          v-if="draftPathD"
          :d="draftPathD"
          class="org-link-path org-link-path--draft"
        />
      </svg>

      <div
        v-for="(exec, execIndex) in executivesSorted"
        :key="exec.id"
        class="org-placed org-placed--exec"
        :class="execPlacedClass(exec.id)"
        :style="execPlacedStyle(exec, exec.id)"
        @pointerdown="(e) => startExecutiveDrag(exec.id, exec, e)"
      >
        <article
          class="org-node org-node-executive"
          data-org-node
          data-org-node-kind="executive"
          :data-org-node-id="exec.id"
        >
          <div
            class="org-exec-face"
            :class="`org-node-executive--geo-${execIndex % 3}`"
          >
            <div class="org-exec-content">
              <InlineField
                v-model="exec.title"
                :readonly="readonly"
                placeholder="Должность"
                class-name="org-exec-title"
              />
              <!-- TODO: readonly-клик по ФИО → openEmployeeVisitingCard(person, $event) -->
              <InlineField
                v-model="exec.person"
                :readonly="readonly"
                placeholder="ФИО"
                class-name="org-exec-person"
              />
            </div>
          </div>
          <button
            v-if="!readonly"
            type="button"
            class="org-remove-btn org-remove-btn--exec"
            title="Удалить директора"
            @pointerdown.stop
            @click.stop="requestRemoveExecutive(exec)"
          >
            ×
          </button>
          <OrgNodePorts
            node-kind="executive"
            :node-id="exec.id"
            :readonly="readonly || !showOrgLinks"
            :link-draft="Boolean(linkDraftFrom)"
            :active-anchor="linkDraftFrom"
            :hover-anchor="linkDraftHover"
            @port-down="(side, e) => onPortDown('executive', exec.id, side, e)"
          />
        </article>
      </div>

      <template v-for="exec in executivesSorted" :key="`items-${exec.id}`">
        <template v-for="item in placedByExecutive[exec.id] ?? []" :key="itemKey(item)">
          <div
            v-if="item.kind === 'unit'"
            class="org-placed org-placed--unit"
            :class="[placedClass(item.unit.id), { 'is-roster-selected': selectedUnitId === item.unit.id }]"
            :style="placedStyle(item.unit, item.unit.id)"
            @pointerdown="(e) => startDrag('unit', item.unit.id, item.unit, e)"
          >
            <article
              class="org-node org-node-unit org-node-unit--solo"
              :class="{
                'is-sized': hasUnitSize(item.unit),
                'is-roster-selected': selectedUnitId === item.unit.id,
                'is-roster-selectable': readonly
              }"
              :style="unitSizeStyle(item.unit)"
              data-org-node
              data-org-node-kind="unit"
              :data-org-node-id="item.unit.id"
              @click="onUnitActivate(item.unit, $event)"
            >
              <button
                v-if="!readonly"
                type="button"
                class="org-remove-btn"
                title="Удалить отдел"
                @pointerdown.stop
                @click.stop="requestRemoveUnit(item.unit)"
              >
                ×
              </button>
              <OrgUnitFields :unit="item.unit" :readonly="readonly" />
              <div
                v-if="!readonly"
                class="org-resize-handle"
                title="Изменить размер"
                @pointerdown.stop="(e) => startUnitResize(item.unit, e)"
              />
              <OrgNodePorts
                node-kind="unit"
                :node-id="item.unit.id"
                :readonly="readonly || !showOrgLinks"
                :link-draft="Boolean(linkDraftFrom)"
                :active-anchor="linkDraftFrom"
                :hover-anchor="linkDraftHover"
                @port-down="(side, e) => onPortDown('unit', item.unit.id, side, e)"
              />
            </article>
          </div>

          <div
            v-else
            class="org-placed org-placed--group"
            :class="placedClass(item.group.id)"
            :style="placedStyle(item.group, item.group.id)"
            @pointerdown="(e) => startDrag('group', item.group.id, item.group, e)"
          >
            <div
              class="org-group-frame"
              :style="groupFrameStyle(item.group)"
              data-org-node
              data-org-node-kind="group"
              :data-org-node-id="item.group.id"
            >
              <button
                v-if="!readonly"
                type="button"
                class="org-remove-btn org-remove-btn--group"
                title="Удалить группу"
                @pointerdown.stop
                @click.stop="requestRemoveGroup(item.group, item.units.length)"
              >
                ×
              </button>
              <div
                class="org-group-units"
                :style="groupUnitsAreaStyle(item.group, item.units)"
              >
                <div
                  class="org-group-person"
                  :class="{ 'is-dragging': labelLocalDrag?.groupId === item.group.id }"
                  :style="groupLabelStyle(item.group)"
                  @pointerdown="(e) => startGroupLabelDrag(item.group, e)"
                  @click.stop="readonly && onGroupPersonClick(item.group.label, $event)"
                >
                  <select
                    v-if="!readonly"
                    :value="item.group.label"
                    class="org-group-person-select"
                    @pointerdown.stop
                    @click.stop
                    @change="
                      onGroupLeaderChange(item.group, ($event.target as HTMLSelectElement).value)
                    "
                  >
                    <option value="">— Руководитель —</option>
                    <option
                      v-if="item.group.label && !groupLeaderOptions.includes(item.group.label)"
                      :value="item.group.label"
                    >
                      {{ item.group.label }} (вне списка)
                    </option>
                    <option v-for="name in groupLeaderOptions" :key="name" :value="name">{{ name }}</option>
                  </select>
                  <InlineField
                    v-else
                    v-model="item.group.label"
                    :readonly="true"
                    placeholder="ФИО руководителя"
                    class-name="org-group-person-name"
                  />
                </div>
                <article
                  v-for="unit in item.units"
                  :key="unit.id"
                  class="org-node org-node-unit org-node-unit--in-group"
                  :class="{
                    'is-reorder-source': unitLocalDrag?.unitId === unit.id,
                    'is-sized': hasUnitSize(unit),
                    'is-resizing': resizing?.kind === 'unit' && resizing.id === unit.id,
                    'is-roster-selected': selectedUnitId === unit.id,
                    'is-roster-selectable': readonly
                  }"
                  :style="groupUnitStyle(unit, item.group.id)"
                  data-org-node
                  data-org-node-kind="unit"
                  :data-org-node-id="unit.id"
                  @pointerdown="(e) => startUnitLocalDrag(item.group.id, unit, e)"
                  @click="onUnitActivate(unit, $event)"
                >
                  <button
                    v-if="!readonly"
                    type="button"
                    class="org-remove-btn"
                    title="Удалить отдел"
                    @pointerdown.stop
                    @click.stop="requestRemoveUnit(unit)"
                  >
                    ×
                  </button>
                  <OrgUnitFields :unit="unit" :readonly="readonly" />
                  <div
                    v-if="!readonly"
                    class="org-resize-handle"
                    title="Изменить размер"
                    @pointerdown.stop="(e) => startUnitResize(unit, e)"
                  />
                  <OrgNodePorts
                    node-kind="unit"
                    :node-id="unit.id"
                    :readonly="readonly || !showOrgLinks"
                    :link-draft="Boolean(linkDraftFrom)"
                    :active-anchor="linkDraftFrom"
                    :hover-anchor="linkDraftHover"
                    @port-down="(side, e) => onPortDown('unit', unit.id, side, e)"
                  />
                </article>
              </div>
              <div v-if="!readonly" class="org-group-footer">
                <button
                  type="button"
                  class="org-group-add-unit"
                  @pointerdown.stop
                  @click.stop="addUnit(item.group.executiveId, item.group.id)"
                >
                  + Отдел в группу
                </button>
              </div>
              <div
                v-if="!readonly"
                class="org-resize-handle"
                title="Изменить размер рамки"
                @pointerdown.stop="(e) => startResize(item.group, e)"
              />
              <OrgNodePorts
                node-kind="group"
                :node-id="item.group.id"
                :readonly="readonly || !showOrgLinks"
                :link-draft="Boolean(linkDraftFrom)"
                :active-anchor="linkDraftFrom"
                :hover-anchor="linkDraftHover"
                @port-down="(side, e) => onPortDown('group', item.group.id, side, e)"
              />
            </div>
          </div>
        </template>
      </template>
            </div>
          </div>
        </div>
      </div>
    </div>

    <p v-if="!hasPlacedItems && !readonly" class="org-empty soft">Нет подразделений</p>

    <OrgConfirmDialog
      :open="confirmTarget !== null"
      :message="confirmMessage"
      @confirm="onConfirmDelete"
      @cancel="confirmTarget = null"
    />
  </div>
</template>

<script setup lang="ts">
import type {
  OrgExecutive,
  OrgLinkAnchor,
  OrgNodeKind,
  OrgPlacedItem,
  OrgUnit,
  OrgUnitGroup
} from '~/composables/useOrgStructure';
import { ORG_CANVAS_EXEC_OFFSET, ORG_GROUP_MIN_HEIGHT, ORG_GROUP_MIN_WIDTH } from '~/composables/useOrgStructure';
import {
  anchorPoint,
  junctionKey,
  linkElbowPoints,
  linkMidHandle,
  linkPathD,
  type OrgPortSide,
  type Point
} from '~/utils/orgLinkPath';
import { useEmployeeVisitingCard } from '~/composables/useEmployeeVisitingCard';
import { resolveManagerFromList } from '~/utils/employeeName';
import { orgUnitOpensRoster } from '~/utils/orgUnitEmployees';

type ConfirmTarget =
  | { type: 'unit'; id: string; label: string }
  | { type: 'group'; id: string; label: string; unitsCount: number }
  | { type: 'executive'; id: string; label: string; unitsCount: number; groupsCount: number };

type DragState = {
  kind: 'unit' | 'group' | 'executive';
  id: string;
  offsetX: number;
  offsetY: number;
};

type ResizeState = {
  kind: 'group' | 'unit';
  id: string;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  minWidth: number;
  minHeight: number;
};

type Positionable = Pick<OrgUnit | OrgUnitGroup, 'x' | 'y'>;

const props = defineProps<{
  readonly?: boolean;
  /** Подсветка выбранного отдела (панель сотрудников). */
  selectedUnitId?: string | null;
  /**
   * Панель справа открыта: сжимаем схему только по X (позиции/ширины/линии),
   * высоту и вертикальный масштаб сохраняем.
   */
  rosterOpen?: boolean;
}>();

const emit = defineEmits<{
  'select-unit': [payload: { id: string; name: string } | null];
}>();

const readonly = computed(() => props.readonly ?? false);
const selectedUnitId = computed(() => props.selectedUnitId ?? null);
const rosterOpen = computed(() => Boolean(props.rosterOpen));
const { orgLinksEnabled } = useAppEnv();
const showOrgLinks = computed(() => orgLinksEnabled.value);

const {
  executivesSorted,
  placedByExecutive,
  orgUnits,
  orgGroups,
  setUnitPosition,
  setUnitSize,
  setGroupPosition,
  setGroupSize,
  setExecutivePosition,
  removeExecutive,
  removeUnit,
  removeGroup,
  setUnitLocalPosition,
  setGroupLabelPosition,
  setLinkMid,
  addUnit,
  orgLinks,
  addLink,
  removeLink,
  syncLinksFromStorage,
  ensureLayout,
  globalCanvasMinHeight
} = useOrgStructure();

const { openEmployeeVisitingCard } = useEmployeeVisitingCard();
const { employees } = useEmployees();

const onUnitActivate = (unit: OrgUnit, event: MouseEvent) => {
  if (!readonly.value) return;
  const target = event.target as HTMLElement | null;
  // клик по ФИО руководителя — только визитка (OrgUnitFields stop), сюда не дойдёт
  if (target?.closest('.org-unit-head--link')) return;
  const name = String(unit.name ?? '').trim();
  if (!name) return;
  // Офис-менеджер / HR-специалист — панель не открываем
  if (!orgUnitOpensRoster(name)) {
    if (selectedUnitId.value) emit('select-unit', null);
    return;
  }
  // повторный клик по тому же отделу — закрыть панель
  if (selectedUnitId.value === unit.id) {
    emit('select-unit', null);
    return;
  }
  emit('select-unit', { id: unit.id, name });
};

const mainCanvasRef = ref<HTMLElement | null>(null);
const stageRef = ref<HTMLElement | null>(null);
const stageSize = ref({ width: 0, height: 0 });
const contentBounds = ref({ width: 1280, height: 720 });
let stageObserver: ResizeObserver | null = null;
let measureRaf = 0;
const portPositions = ref(new Map<string, Point>());
const linkDraftFrom = ref<OrgLinkAnchor | null>(null);
const linkDraftHover = ref<OrgLinkAnchor | null>(null);
const linkDraftCursor = ref<Point | null>(null);
let linkGestureAbort: AbortController | null = null;
const dragging = ref<DragState | null>(null);
const dragPreview = ref<{ x: number; y: number } | null>(null);
const resizing = ref<ResizeState | null>(null);
const resizePreview = ref<{ width: number; height: number } | null>(null);
const confirmTarget = ref<ConfirmTarget | null>(null);
const unitLocalDrag = ref<{
  groupId: string;
  unitId: string;
  offsetX: number;
  offsetY: number;
  x: number;
  y: number;
} | null>(null);
const labelLocalDrag = ref<{
  groupId: string;
  offsetX: number;
  offsetY: number;
  x: number;
  y: number;
} | null>(null);
const linkMidDrag = ref<{
  linkId: string;
  axis: 'x' | 'y';
} | null>(null);
const linkMidPreview = ref<number | null>(null);

const itemKey = (item: OrgPlacedItem) => (item.kind === 'unit' ? item.unit.id : item.group.id);
const groupLeaderOptions = computed(() => {
  const names = new Set<string>();
  for (const emp of employees.value) {
    const name = emp.name.trim();
    if (name) names.add(name);
  }
  return [...names].sort((a, b) => a.localeCompare(b, 'ru'));
});

const hasPlacedItems = computed(() =>
  executivesSorted.value.some((exec) => (placedByExecutive.value[exec.id]?.length ?? 0) > 0)
);

const layoutMinHeight = computed(() =>
  globalCanvasMinHeight(placedByExecutive.value, executivesSorted.value)
);

const totalCanvasHeight = computed(() =>
  Math.max(layoutMinHeight.value, contentBounds.value.height)
);

// Базовые габариты, под которые считаем масштаб.
// В readonly важнее реальная высота схемы, чтобы превью не получалось «мелким из‑за минимальных резервов».
const canvasBaseWidthPx = computed(() => Math.max(contentBounds.value.width, 480));
const canvasBaseHeightPx = computed(() =>
  readonly.value ? contentBounds.value.height : Math.max(contentBounds.value.height, totalCanvasHeight.value)
);

/** Ширина схемы без roster-сжатия (для расчёта layoutCompressX). */
const naturalCanvasWidth = ref(480);

/** Uniform contain до открытия панели — не даём схеме вырасти по высоте. */
const fitScaleBeforeRoster = ref(1);

/**
 * Сжатие только по X: короче зазоры/линии и чуть уже окошки, Y без изменений.
 * Цель — заполнить колонку схемы без гориз. скролла и без наездов.
 */
const layoutCompressX = computed(() => {
  if (!readonly.value || !rosterOpen.value) return 1;
  const sw = stageSize.value.width;
  if (sw < 80) return 1;
  // viewport 8×2 + board ~10×2
  const chromeX = 40;
  const availW = Math.max(160, sw - chromeX);
  const s = Math.max(0.01, fitScaleBeforeRoster.value);
  const naturalW = Math.max(1, naturalCanvasWidth.value);
  const raw = availW / (naturalW * s);
  // Пол не ниже ~0.78 — иначе ноды с длинным текстом наезжают друг на друга
  return Math.min(1, Math.max(0.78, raw));
});

const fitScale = computed(() => {
  if (!readonly.value) return 1;
  const padX = 16;
  const padY = 16;
  const sw = stageSize.value.width;
  const sh = stageSize.value.height;
  if (sw < 80 || sh < 80) {
    return rosterOpen.value ? fitScaleBeforeRoster.value : 1;
  }

  const availW = Math.max(160, sw - (rosterOpen.value ? 40 : padX));
  const availH = Math.max(160, sh - padY);
  const ch = Math.max(1, canvasBaseHeightPx.value);

  if (!rosterOpen.value) {
    // После закрытия панели contentBounds может ещё быть «сжатым» — не взрывать scale
    const cw = Math.max(1, canvasBaseWidthPx.value, naturalCanvasWidth.value);
    const boundsStale = contentBounds.value.width + 48 < naturalCanvasWidth.value;
    if (boundsStale) {
      return fitScaleBeforeRoster.value;
    }
    // Readonly: всегда целиком в кадр (без скролла). Пол 0.4 — читаемость, но влезаем.
    const contain = Math.min(availW / cw, availH / ch) * 0.985;
    return Math.max(0.4, contain);
  }

  const cw = Math.max(1, canvasBaseWidthPx.value);
  const contain = Math.min(availW / cw, availH / ch);
  return Math.min(fitScaleBeforeRoster.value, Math.max(0.4, contain));
});

const remasureStage = () => {
  const el = stageRef.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  if (w <= 0 || h <= 0) return;
  const prev = stageSize.value;
  // Порог — гасит дрожь от появления/исчезновения scrollbar
  if (Math.abs(prev.width - w) < 2 && Math.abs(prev.height - h) < 2) return;
  stageSize.value = { width: w, height: h };
};

const canvasBoxStyle = computed(() => ({
  width: `${canvasBaseWidthPx.value}px`,
  minHeight: `${canvasBaseHeightPx.value}px`,
  height: `${canvasBaseHeightPx.value}px`
}));

const scaleSlotStyle = computed(() => {
  const s = fitScale.value;
  const w = canvasBaseWidthPx.value;
  const h = canvasBaseHeightPx.value;
  return {
    width: `${w * s}px`,
    height: `${h * s}px`
  };
});

const scaleInnerStyle = computed(() => {
  const s = fitScale.value;
  const w = canvasBaseWidthPx.value;
  const h = canvasBaseHeightPx.value;
  return {
    width: `${w}px`,
    height: `${h}px`,
    transform: s === 1 ? undefined : `scale(${s})`
  };
});

const measureContentBounds = () => {
  const canvas = mainCanvasRef.value;
  if (!canvas) return;
  let maxR = 480;
  // В readonly не раздуваем «высоту подложки» — нам нужна реальная высота схемы.
  let maxB = readonly.value ? 0 : layoutMinHeight.value;
  // Readonly: без внутреннего запаса — равный зазор сверху/снизу даёт padding белого поля.
  const padX = readonly.value ? 0 : 24;
  const padY = readonly.value ? 0 : 32;
  canvas.querySelectorAll<HTMLElement>('.org-placed').forEach((el) => {
    maxR = Math.max(maxR, el.offsetLeft + el.offsetWidth + padX);
    maxB = Math.max(maxB, el.offsetTop + el.offsetHeight + padY);
  });
  if (
    Math.abs(contentBounds.value.width - maxR) > 2 ||
    Math.abs(contentBounds.value.height - maxB) > 2
  ) {
    contentBounds.value = { width: Math.ceil(maxR), height: Math.ceil(maxB) };
  }
  // Естественная ширина — только без X-сжатия (иначе factor съедет).
  if (!rosterOpen.value && maxR > 0) {
    naturalCanvasWidth.value = Math.ceil(maxR);
  }
};

const scheduleMeasureContent = () => {
  if (!import.meta.client) return;
  cancelAnimationFrame(measureRaf);
  measureRaf = requestAnimationFrame(() => {
    measureContentBounds();
    requestAnimationFrame(() => {
      measureContentBounds();
      scheduleRefreshPorts();
    });
  });
};

const defaultY = () => ORG_CANVAS_EXEC_OFFSET;

/** Правая стойка (маркетинг / HR / … на x≈913). Продажи (~816) не трогаем — иначе уезжают из-под коммерческого. */
const RIGHT_COL_X_PX = 880;

const compressX = (x: number) => {
  const cx = layoutCompressX.value;
  let out = x * cx;
  if (cx < 0.999 && x >= RIGHT_COL_X_PX) {
    // Доп. сдвиг влево: освобождает место справа под длинное имя в 1 строку
    out -= 22 + (1 - cx) * 48;
  }
  return Math.max(0, out);
};

const itemPos = (item: Positionable) => ({
  x: item.x ?? 0,
  y: item.y ?? defaultY()
});

const placedStyle = (item: Positionable, id: string) => {
  const isActive = dragging.value?.id === id && dragPreview.value;

  const pos = isActive ? dragPreview.value! : itemPos(item);

  return {
    left: `${compressX(pos.x)}px`,
    top: `${pos.y}px`
  };
};

const groupFrameStyle = (group: OrgUnitGroup) => {
  const isActive = resizing.value?.kind === 'group' && resizing.value.id === group.id && resizePreview.value;

  const width = isActive ? resizePreview.value!.width : group.width;
  const height = isActive ? resizePreview.value!.height : group.height;
  const cx = layoutCompressX.value;

  const style: Record<string, string> = {};
  if (width != null && width > 0) {
    style.width = `${Math.max(ORG_GROUP_MIN_WIDTH, width) * cx}px`;
  } else {
    style.minWidth = `${ORG_GROUP_MIN_WIDTH * cx}px`;
  }
  if (height != null && height > 0) style.height = `${height}px`;
  return style;
};

const hasUnitSize = (unit: OrgUnit) =>
  (unit.width != null && unit.width > 0) || (unit.height != null && unit.height > 0);

const unitSizeStyle = (unit: OrgUnit) => {
  const preview =
    resizing.value?.kind === 'unit' && resizing.value.id === unit.id ? resizePreview.value : null;
  const w = preview?.width ?? unit.width;
  const h = preview?.height ?? unit.height;
  const cx = layoutCompressX.value;
  const style: Record<string, string> = {};
  if (w != null && w > 0) {
    if (cx < 0.999) {
      // Фикс. ширина × cx давит подписи («аккаунтинга») — оставляем min, ширина по контенту
      style.minWidth = `${Math.round(w * cx)}px`;
      style.width = 'max-content';
    } else {
      style.width = `${w}px`;
    }
  }
  if (h != null && h > 0) {
    // При сжатии не фиксируем высоту — ФИО в 1 строку короче
    if (cx >= 0.999) style.height = `${h}px`;
  }
  return style;
};

const groupUnitStyle = (unit: OrgUnit, groupId: string) => {
  const draggingLocal =
    unitLocalDrag.value?.groupId === groupId && unitLocalDrag.value.unitId === unit.id
      ? unitLocalDrag.value
      : null;
  const x = draggingLocal ? draggingLocal.x : (unit.x ?? 0);
  const y = draggingLocal ? draggingLocal.y : (unit.y ?? 0);
  return {
    left: `${compressX(x)}px`,
    top: `${y}px`,
    ...unitSizeStyle(unit)
  };
};

const groupLabelStyle = (group: OrgUnitGroup) => {
  const drag = labelLocalDrag.value?.groupId === group.id ? labelLocalDrag.value : null;
  const x = drag ? drag.x : (group.labelX ?? 24);
  const y = drag ? drag.y : (group.labelY ?? 12);
  return {
    left: `${compressX(x)}px`,
    top: `${y}px`
  };
};

const groupUnitsAreaStyle = (group: OrgUnitGroup, units: OrgUnit[]) => {
  let maxBottom = 72;
  for (const unit of units) {
    const drag =
      unitLocalDrag.value?.groupId === group.id && unitLocalDrag.value.unitId === unit.id
        ? unitLocalDrag.value
        : null;
    const y = drag ? drag.y : (unit.y ?? 0);
    const preview =
      resizing.value?.kind === 'unit' && resizing.value.id === unit.id ? resizePreview.value : null;
    const h = preview?.height ?? unit.height ?? 96;
    maxBottom = Math.max(maxBottom, y + h);
  }
  const labelDrag = labelLocalDrag.value?.groupId === group.id ? labelLocalDrag.value : null;
  const labelY = labelDrag ? labelDrag.y : (group.labelY ?? 12);
  maxBottom = Math.max(maxBottom, labelY + 48);
  return { minHeight: `${maxBottom}px` };
};

const placedClass = (id: string) => ({
  'is-dragging': dragging.value?.id === id,
  'is-resizing': resizing.value?.id === id
});

const execHasPosition = (exec: OrgExecutive) => exec.x != null && exec.y != null;

const execPlacedStyle = (exec: OrgExecutive, execId: string) => {
  const isActive =
    dragging.value?.kind === 'executive' &&
    dragging.value.id === execId &&
    dragPreview.value;

  if (isActive) {
    return {
      left: `${compressX(dragPreview.value!.x)}px`,
      top: `${dragPreview.value!.y}px`
    };
  }

  if (execHasPosition(exec)) {
    return {
      left: `${compressX(exec.x!)}px`,
      top: `${exec.y}px`
    };
  }

  return {
    left: `${compressX((executivesSorted.value.findIndex((e) => e.id === execId) || 0) * 220)}px`,
    top: '0'
  };
};

const execPlacedClass = (execId: string) => ({
  'is-dragging': dragging.value?.kind === 'executive' && dragging.value.id === execId
});

const isInteractiveTarget = (target: EventTarget | null) => {
  const el =
    target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
  if (!el) return false;
  return Boolean(
    el.closest(
      '.org-remove-btn, .org-group-add-unit, .org-group-person, .org-field-clear, .org-add-head, .org-unit-head-select, .org-group-person-select, .org-port, .inline-edit-input, .editable-line, .org-resize-handle, .org-link-path'
    )
  );
};

const isFinitePoint = (p: Point | null | undefined): p is Point =>
  Boolean(p && Number.isFinite(p.x) && Number.isFinite(p.y));

const portMapKey = (kind: OrgNodeKind, id: string, side: OrgPortSide) => `${kind}:${id}:${side}`;

/** Screen → canvas-local (учитывает CSS scale на родителе). */
const canvasLocalRect = (canvas: HTMLElement, el: Element) => {
  const cRect = canvas.getBoundingClientRect();
  const rect = el.getBoundingClientRect();
  const sx = cRect.width > 0 ? canvas.offsetWidth / cRect.width : 1;
  const sy = cRect.height > 0 ? canvas.offsetHeight / cRect.height : 1;
  return {
    left: (rect.left - cRect.left) * sx,
    top: (rect.top - cRect.top) * sy,
    width: rect.width * sx,
    height: rect.height * sy
  };
};

const refreshPortPositions = () => {
  const canvas = mainCanvasRef.value;
  if (!canvas) return;
  const map = new Map<string, Point>();
  canvas.querySelectorAll('[data-org-node]').forEach((el) => {
    const kind = el.getAttribute('data-org-node-kind') as OrgNodeKind | null;
    const id = el.getAttribute('data-org-node-id');
    if (!kind || !id) return;
    const rel = canvasLocalRect(canvas, el);
    (['top', 'right', 'bottom', 'left'] as OrgPortSide[]).forEach((side) => {
      const pt = anchorPoint(rel, side);
      if (isFinitePoint(pt)) map.set(portMapKey(kind, id, side), pt);
    });
  });
  portPositions.value = map;
};

const getAnchorPoint = (anchor: OrgLinkAnchor): Point | null => {
  const cached = portPositions.value.get(portMapKey(anchor.kind, anchor.id, anchor.side));
  if (isFinitePoint(cached)) return cached;

  const canvas = mainCanvasRef.value;
  if (!canvas) return null;
  const node = canvas.querySelector(
    `[data-org-node-kind="${anchor.kind}"][data-org-node-id="${anchor.id}"]`
  );
  if (!node) return null;
  const rel = canvasLocalRect(canvas, node);
  const pt = anchorPoint(rel, anchor.side);
  return isFinitePoint(pt) ? pt : null;
};

const inferEntrySide = (from: Point, to: Point): OrgPortSide => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'left' : 'right';
  return dy > 0 ? 'top' : 'bottom';
};

const isVerticalPort = (side: OrgPortSide) => side === 'top' || side === 'bottom';

/** mid по X сжимаем вместе со схемой; mid по Y оставляем. */
const displayLinkMid = (fromSide: OrgPortSide, toSide: OrgPortSide, mid?: number) => {
  if (mid == null || !Number.isFinite(mid)) return undefined;
  const cx = layoutCompressX.value;
  if (cx >= 0.999) return mid;
  if (isVerticalPort(fromSide) && isVerticalPort(toSide)) return mid;
  if (!isVerticalPort(fromSide) && !isVerticalPort(toSide)) return mid * cx;
  if (isVerticalPort(fromSide)) return mid;
  return mid * cx;
};

const linkRouteOpts = (linkId: string, fromSide: OrgPortSide, toSide: OrgPortSide, mid?: number) => {
  const raw =
    linkMidDrag.value?.linkId === linkId && linkMidPreview.value != null
      ? linkMidPreview.value
      : mid;
  const display = displayLinkMid(fromSide, toSide, raw);
  return display != null ? { mid: display } : undefined;
};

const resolvedLinkPaths = computed(() => {
  try {
    return orgLinks.value
      .map((link) => {
        const fromPt = getAnchorPoint(link.from);
        const toPt = getAnchorPoint(link.to);
        if (!fromPt || !toPt) return null;
        const d = linkPathD(
          { ...fromPt, side: link.from.side },
          { ...toPt, side: link.to.side },
          linkRouteOpts(link.id, link.from.side, link.to.side, link.mid)
        );
        if (!d) return null;
        return { id: link.id, d };
      })
      .filter((item): item is { id: string; d: string } => Boolean(item));
  } catch {
    return [] as { id: string; d: string }[];
  }
});

/** Кружки только на реальных локтях/развилках (не на прямой, не у порта). */
const resolvedJunctions = computed(() => {
  try {
    const map = new Map<string, Point & { key: string; count: number }>();
    for (const link of orgLinks.value) {
      const fromPt = getAnchorPoint(link.from);
      const toPt = getAnchorPoint(link.to);
      if (!fromPt || !toPt) continue;
      for (const p of linkElbowPoints(
        { ...fromPt, side: link.from.side },
        { ...toPt, side: link.to.side },
        linkRouteOpts(link.id, link.from.side, link.to.side, link.mid)
      )) {
        const key = junctionKey(p);
        const prev = map.get(key);
        if (prev) prev.count += 1;
        else map.set(key, { ...p, key, count: 1 });
      }
    }
    // Одиночный локоть оставляем; прямые уже отфильтрованы в linkElbowPoints
    return [...map.values()];
  } catch {
    return [] as (Point & { key: string })[];
  }
});

const resolvedMidHandles = computed(() => {
  if (readonly.value) return [] as { id: string; x: number; y: number; axis: 'x' | 'y' }[];
  try {
    return orgLinks.value
      .map((link) => {
        const fromPt = getAnchorPoint(link.from);
        const toPt = getAnchorPoint(link.to);
        if (!fromPt || !toPt) return null;
        const handle = linkMidHandle(
          { ...fromPt, side: link.from.side },
          { ...toPt, side: link.to.side },
          linkRouteOpts(link.id, link.from.side, link.to.side, link.mid)
        );
        if (!handle) return null;
        return { id: link.id, ...handle };
      })
      .filter(
        (item): item is { id: string; x: number; y: number; axis: 'x' | 'y' } => Boolean(item)
      );
  } catch {
    return [];
  }
});

const draftPathD = computed(() => {
  try {
    if (!linkDraftFrom.value || !linkDraftCursor.value) return '';
    const fromPt = getAnchorPoint(linkDraftFrom.value);
    if (!fromPt || !isFinitePoint(linkDraftCursor.value)) return '';
    return linkPathD(
      { ...fromPt, side: linkDraftFrom.value.side },
      { ...linkDraftCursor.value, side: inferEntrySide(fromPt, linkDraftCursor.value) }
    );
  } catch {
    return '';
  }
});

const isSameAnchor = (a: OrgLinkAnchor, b: OrgLinkAnchor) =>
  a.kind === b.kind && a.id === b.id && a.side === b.side;

const stopLinkGesture = () => {
  linkGestureAbort?.abort();
  linkGestureAbort = null;
};

const cancelLinkDraft = () => {
  linkDraftFrom.value = null;
  linkDraftHover.value = null;
  linkDraftCursor.value = null;
  stopLinkGesture();
};

const findPortAnchorAt = (clientX: number, clientY: number): OrgLinkAnchor | null => {
  const hits = document.elementsFromPoint(clientX, clientY);
  for (const el of hits) {
    const anchor = parsePortAnchor(el);
    if (anchor) return anchor;
  }
  return null;
};

const onLinkDraftMove = (e: MouseEvent | PointerEvent) => {
  const canvas = mainCanvasRef.value;
  if (!canvas || !linkDraftFrom.value) return;
  const rect = canvas.getBoundingClientRect();
  linkDraftCursor.value = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
  const hover = findPortAnchorAt(e.clientX, e.clientY);
  linkDraftHover.value =
    hover && !isSameAnchor(hover, linkDraftFrom.value) ? hover : null;
};

const onLinkDraftUp = (e: MouseEvent | PointerEvent) => {
  if (!linkDraftFrom.value) return;
  if ('button' in e && e.button !== 0) return;
  const from = linkDraftFrom.value;
  stopLinkGesture();
  const hit = findPortAnchorAt(e.clientX, e.clientY);
  const hover =
    linkDraftHover.value && !isSameAnchor(linkDraftHover.value, from)
      ? linkDraftHover.value
      : null;
  const anchor = hit && !isSameAnchor(hit, from) ? hit : hover;
  if (!anchor) {
    // Отпустили на пустом месте / том же порте — остаёмся в режиме «второй клик»
    linkDraftHover.value = null;
    startLinkGesture();
    return;
  }
  finishLinkAt(anchor);
};

const startLinkGesture = () => {
  stopLinkGesture();
  const ac = new AbortController();
  linkGestureAbort = ac;
  const { signal } = ac;
  // Только Pointer Events — не дублировать mouse* (двойной up/move ломал жест)
  window.addEventListener('pointermove', onLinkDraftMove, { signal });
  window.addEventListener('pointerup', onLinkDraftUp, { signal });
  window.addEventListener('pointercancel', cancelLinkDraft, { signal });
  window.addEventListener('keydown', onLinkDraftKey, { signal });
};

const onLinkDraftKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape') cancelLinkDraft();
};

const parsePortAnchor = (el: Element | null): OrgLinkAnchor | null => {
  if (!el) return null;
  const port = el.closest('.org-port');
  if (!port) return null;
  const node = port.closest('[data-org-node]');
  if (!node) return null;
  const kind = node.getAttribute('data-org-node-kind') as OrgNodeKind | null;
  const id = node.getAttribute('data-org-node-id');
  if (!kind || !id) return null;
  const sideClass = Array.from(port.classList).find((c) => c.startsWith('org-port--'));
  if (!sideClass) return null;
  const side = sideClass.replace('org-port--', '') as OrgPortSide;
  return { kind, id, side };
};

const finishLinkAt = (anchor: OrgLinkAnchor) => {
  if (!linkDraftFrom.value) return;
  if (isSameAnchor(linkDraftFrom.value, anchor)) {
    cancelLinkDraft();
    return;
  }
  const from = linkDraftFrom.value;
  cancelLinkDraft();
  addLink(from, anchor);
  scheduleRefreshPorts();
};

const onPortDown = (kind: OrgNodeKind, id: string, side: OrgPortSide, event: PointerEvent) => {
  if (readonly.value || !showOrgLinks.value) return;
  event.preventDefault();
  event.stopPropagation();
  refreshPortPositions();

  const anchor: OrgLinkAnchor = { kind, id, side };

  if (linkDraftFrom.value && isSameAnchor(linkDraftFrom.value, anchor)) {
    cancelLinkDraft();
    return;
  }

  if (!linkDraftFrom.value) {
    linkDraftFrom.value = anchor;
    linkDraftHover.value = null;
    const startPt = getAnchorPoint(anchor);
    linkDraftCursor.value = startPt ? { ...startPt } : null;
    startLinkGesture();
    return;
  }

  finishLinkAt(anchor);
};

const scheduleRefreshPorts = () => nextTick(() => refreshPortPositions());

watch([executivesSorted, placedByExecutive, orgLinks, totalCanvasHeight], () => {
  scheduleRefreshPorts();
  scheduleMeasureContent();
}, { deep: true });

watch(readonly, () => {
  nextTick(() => {
    remasureStage();
    scheduleMeasureContent();
  });
});

// Эталон scale без панели — отдельно от computed, без записи внутри fitScale
watch(
  fitScale,
  (s) => {
    if (!readonly.value || rosterOpen.value) return;
    if (Math.abs(fitScaleBeforeRoster.value - s) > 0.002) {
      fitScaleBeforeRoster.value = s;
    }
  },
  { flush: 'sync' }
);

watch(fitScale, () => {
  nextTick(() => {
    scheduleRefreshPorts();
    requestAnimationFrame(() => refreshPortPositions());
  });
});

/** До re-render: вернуть ширину холста, иначе fitScale считает contain по сжатой схеме и всё ломается. */
watch(
  rosterOpen,
  (open) => {
    if (!open && naturalCanvasWidth.value > contentBounds.value.width) {
      contentBounds.value = {
        width: naturalCanvasWidth.value,
        height: contentBounds.value.height
      };
    }
  },
  { flush: 'sync' }
);

watch([rosterOpen, layoutCompressX], () => {
  nextTick(() => {
    remasureStage();
    scheduleMeasureContent();
    requestAnimationFrame(() => {
      measureContentBounds();
      remasureStage();
      refreshPortPositions();
    });
  });
});

const onWindowResize = () => {
  remasureStage();
  refreshPortPositions();
};

onMounted(() => {
  syncLinksFromStorage();
  ensureLayout();
  scheduleRefreshPorts();
  scheduleMeasureContent();
  requestAnimationFrame(() => {
    remasureStage();
    refreshPortPositions();
  });
  window.addEventListener('resize', onWindowResize);
  if (stageRef.value && typeof ResizeObserver !== 'undefined') {
    stageObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        const prev = stageSize.value;
        if (Math.abs(prev.width - width) < 2 && Math.abs(prev.height - height) < 2) return;
        stageSize.value = { width, height };
      } else {
        remasureStage();
      }
      scheduleMeasureContent();
    });
    stageObserver.observe(stageRef.value);
    remasureStage();
  }
});

onBeforeUnmount(() => {
  dragging.value = null;
  resizing.value = null;
  unitLocalDrag.value = null;
  labelLocalDrag.value = null;
  linkMidDrag.value = null;
  linkMidPreview.value = null;
  cancelLinkDraft();
  window.removeEventListener('resize', onWindowResize);
  stageObserver?.disconnect();
  stageObserver = null;
  cancelAnimationFrame(measureRaf);
});

const clampToCanvas = (
  canvas: HTMLElement,
  x: number,
  y: number,
  elWidth = 0,
  elHeight = 0
) => {
  const maxX = Math.max(0, canvas.clientWidth - elWidth);
  const maxY = Math.max(0, canvas.clientHeight - elHeight);
  return {
    x: Math.min(maxX, Math.max(0, x)),
    y: Math.min(maxY, Math.max(0, y))
  };
};

const startDrag = (
  kind: 'unit' | 'group',
  id: string,
  item: Positionable,
  event: PointerEvent
) => {
  if (readonly.value || linkDraftFrom.value || unitLocalDrag.value || labelLocalDrag.value || linkMidDrag.value || isInteractiveTarget(event.target)) return;

  const canvas = mainCanvasRef.value;
  if (!canvas) return;

  const handle = event.currentTarget as HTMLElement;
  const canvasRect = canvas.getBoundingClientRect();
  const pos = itemPos(item);

  dragging.value = {
    kind,
    id,
    offsetX: event.clientX - canvasRect.left - pos.x,
    offsetY: event.clientY - canvasRect.top - pos.y
  };
  dragPreview.value = { ...pos };

  const onMove = (e: PointerEvent) => {
    if (!dragging.value) return;
    const rect = canvas.getBoundingClientRect();
    dragPreview.value = clampToCanvas(
      canvas,
      e.clientX - rect.left - dragging.value.offsetX,
      e.clientY - rect.top - dragging.value.offsetY,
      handle.offsetWidth,
      handle.offsetHeight
    );
  };

  const onEnd = () => {
    if (dragging.value && dragPreview.value) {
      if (dragging.value.kind === 'unit') {
        setUnitPosition(dragging.value.id, dragPreview.value.x, dragPreview.value.y);
      } else {
        setGroupPosition(dragging.value.id, dragPreview.value.x, dragPreview.value.y);
      }
    }
    dragging.value = null;
    dragPreview.value = null;
    scheduleRefreshPorts();
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onEnd);
    window.removeEventListener('pointercancel', onEnd);
  };

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onEnd);
  window.addEventListener('pointercancel', onEnd);
  event.preventDefault();
};

const startExecutiveDrag = (execId: string, exec: OrgExecutive, event: PointerEvent) => {
  if (readonly.value || linkDraftFrom.value || unitLocalDrag.value || labelLocalDrag.value || linkMidDrag.value || isInteractiveTarget(event.target)) return;

  const canvas = mainCanvasRef.value;
  if (!canvas) return;

  const handle = event.currentTarget as HTMLElement;
  const canvasRect = canvas.getBoundingClientRect();
  const handleRect = handle.getBoundingClientRect();
  const pos = execHasPosition(exec)
    ? { x: exec.x!, y: exec.y! }
    : {
        x: handleRect.left - canvasRect.left,
        y: handleRect.top - canvasRect.top
      };

  dragging.value = {
    kind: 'executive',
    id: execId,
    offsetX: event.clientX - canvasRect.left - pos.x,
    offsetY: event.clientY - canvasRect.top - pos.y
  };
  dragPreview.value = { ...pos };

  const onMove = (e: PointerEvent) => {
    if (!dragging.value) return;
    const rect = canvas.getBoundingClientRect();
    dragPreview.value = clampToCanvas(
      canvas,
      e.clientX - rect.left - dragging.value.offsetX,
      e.clientY - rect.top - dragging.value.offsetY,
      handle.offsetWidth,
      handle.offsetHeight
    );
  };

  const onEnd = () => {
    if (dragging.value && dragPreview.value) {
      setExecutivePosition(dragging.value.id, dragPreview.value.x, dragPreview.value.y);
    }
    dragging.value = null;
    dragPreview.value = null;
    scheduleRefreshPorts();
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onEnd);
    window.removeEventListener('pointercancel', onEnd);
  };

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onEnd);
  window.addEventListener('pointercancel', onEnd);
  event.preventDefault();
};

const startResize = (group: OrgUnitGroup, event: PointerEvent) => {
  if (readonly.value || linkDraftFrom.value || unitLocalDrag.value || labelLocalDrag.value || linkMidDrag.value) return;

  const frame = (event.currentTarget as HTMLElement).closest('.org-group-frame') as HTMLElement;
  if (!frame) return;

  const rect = frame.getBoundingClientRect();
  const startWidth = group.width && group.width > 0 ? group.width : rect.width;
  const startHeight = group.height && group.height > 0 ? group.height : rect.height;

  resizing.value = {
    kind: 'group',
    id: group.id,
    startX: event.clientX,
    startY: event.clientY,
    startWidth,
    startHeight,
    minWidth: ORG_GROUP_MIN_WIDTH,
    minHeight: ORG_GROUP_MIN_HEIGHT
  };
  resizePreview.value = { width: startWidth, height: startHeight };

  const onMove = (e: PointerEvent) => {
    if (!resizing.value) return;
    const dw = e.clientX - resizing.value.startX;
    const dh = e.clientY - resizing.value.startY;
    resizePreview.value = {
      width: Math.max(resizing.value.minWidth, resizing.value.startWidth + dw),
      height: Math.max(resizing.value.minHeight, resizing.value.startHeight + dh)
    };
  };

  const onEnd = () => {
    if (resizing.value && resizePreview.value) {
      setGroupSize(resizing.value.id, resizePreview.value.width, resizePreview.value.height);
    }
    resizing.value = null;
    resizePreview.value = null;
    scheduleRefreshPorts();
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onEnd);
    window.removeEventListener('pointercancel', onEnd);
  };

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onEnd);
  window.addEventListener('pointercancel', onEnd);
  event.preventDefault();
};

const measureUnitMinSize = (el: HTMLElement) => {
  const addHead = el.querySelector('.org-add-head') as HTMLElement | null;
  const prevAddDisplay = addHead?.style.display;
  if (addHead) addHead.style.display = 'none';

  const prevWidth = el.style.width;
  const prevHeight = el.style.height;
  const prevMinWidth = el.style.minWidth;
  const prevMinHeight = el.style.minHeight;
  el.style.width = 'max-content';
  el.style.height = 'auto';
  el.style.minWidth = '0';
  el.style.minHeight = '0';
  const minWidth = Math.ceil(el.getBoundingClientRect().width);
  const minHeight = Math.ceil(el.getBoundingClientRect().height);
  el.style.width = prevWidth;
  el.style.height = prevHeight;
  el.style.minWidth = prevMinWidth;
  el.style.minHeight = prevMinHeight;
  if (addHead) addHead.style.display = prevAddDisplay ?? '';
  return {
    minWidth: Math.max(72, minWidth),
    minHeight: Math.max(36, minHeight)
  };
};

const startUnitResize = (unit: OrgUnit, event: PointerEvent) => {
  if (readonly.value || linkDraftFrom.value || unitLocalDrag.value || labelLocalDrag.value || linkMidDrag.value) return;
  if (event.button !== 0) return;

  const card = (event.currentTarget as HTMLElement).closest('.org-node-unit') as HTMLElement | null;
  if (!card) return;

  const rect = card.getBoundingClientRect();
  const { minWidth, minHeight } = measureUnitMinSize(card);
  const hadWidth = unit.width != null && unit.width > 0;
  const hadHeight = unit.height != null && unit.height > 0;
  const startWidth = hadWidth ? unit.width! : rect.width;
  const startHeight = hadHeight ? unit.height! : rect.height;

  resizing.value = {
    kind: 'unit',
    id: unit.id,
    startX: event.clientX,
    startY: event.clientY,
    startWidth,
    startHeight,
    minWidth,
    minHeight
  };
  resizePreview.value = {
    width: Math.max(minWidth, startWidth),
    height: Math.max(minHeight, startHeight)
  };

  const onMove = (e: PointerEvent) => {
    if (!resizing.value) return;
    const dw = e.clientX - resizing.value.startX;
    const dh = e.clientY - resizing.value.startY;
    resizePreview.value = {
      width: Math.max(resizing.value.minWidth, resizing.value.startWidth + dw),
      height: Math.max(resizing.value.minHeight, resizing.value.startHeight + dh)
    };
  };

  const onEnd = () => {
    if (resizing.value && resizePreview.value) {
      const state = resizing.value;
      const preview = resizePreview.value;
      const dw = Math.abs(preview.width - state.startWidth);
      const dh = Math.abs(preview.height - state.startHeight);
      const next: { width?: number; height?: number | null } = {};
      if (dw >= 3 || hadWidth) next.width = preview.width;
      if (dh >= 3) next.height = preview.height;
      else if (!hadHeight) next.height = null;
      if (next.width != null || next.height !== undefined) {
        setUnitSize(state.id, next);
      }
    }
    resizing.value = null;
    resizePreview.value = null;
    scheduleRefreshPorts();
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onEnd);
    window.removeEventListener('pointercancel', onEnd);
  };

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onEnd);
  window.addEventListener('pointercancel', onEnd);
  event.preventDefault();
  event.stopPropagation();
};

const isReorderBlockedTarget = (target: EventTarget | null) => {
  const el =
    target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
  if (!el) return false;
  return Boolean(
    el.closest(
      '.org-remove-btn, .org-add-head, .org-field-clear, .org-unit-head-select, .org-group-person-select, .org-port, .inline-edit-input, .org-resize-handle, .org-link-path'
    )
  );
};

const startUnitLocalDrag = (groupId: string, unit: OrgUnit, event: PointerEvent) => {
  if (readonly.value || linkDraftFrom.value || labelLocalDrag.value || resizing.value || isReorderBlockedTarget(event.target)) return;
  if (event.button !== 0) return;

  event.stopPropagation();

  const area = (event.currentTarget as HTMLElement).closest('.org-group-units') as HTMLElement | null;
  if (!area) return;
  const areaRect = area.getBoundingClientRect();
  const startX = unit.x ?? 0;
  const startY = unit.y ?? 0;

  unitLocalDrag.value = {
    groupId,
    unitId: unit.id,
    offsetX: event.clientX - areaRect.left - startX,
    offsetY: event.clientY - areaRect.top - startY,
    x: startX,
    y: startY
  };
  let moved = false;

  const onMove = (e: PointerEvent) => {
    if (!unitLocalDrag.value) return;
    const dx = Math.abs(e.clientX - event.clientX);
    const dy = Math.abs(e.clientY - event.clientY);
    if (!moved) {
      if (dx < 4 && dy < 4) return;
      moved = true;
      e.preventDefault();
    }
    const rect = area.getBoundingClientRect();
    const maxX = Math.max(0, area.clientWidth - 40);
    const maxY = Math.max(0, area.clientHeight + 80);
    const x = Math.min(maxX, Math.max(0, e.clientX - rect.left - unitLocalDrag.value.offsetX));
    const y = Math.min(maxY, Math.max(0, e.clientY - rect.top - unitLocalDrag.value.offsetY));
    unitLocalDrag.value = { ...unitLocalDrag.value, x, y };
  };

  const onEnd = () => {
    const state = unitLocalDrag.value;
    unitLocalDrag.value = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onEnd);
    window.removeEventListener('pointercancel', onEnd);
    if (!state || !moved) return;
    setUnitLocalPosition(state.unitId, state.x, state.y);
    scheduleRefreshPorts();
  };

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onEnd);
  window.addEventListener('pointercancel', onEnd);
};

const onGroupPersonClick = (fio: string, event: MouseEvent) => {
  if (!readonly.value) return;
  const name = fio.trim();
  if (!name) return;
  openEmployeeVisitingCard(name, event);
};

const onGroupLeaderChange = (group: OrgUnitGroup, value: string) => {
  const resolved = resolveManagerFromList(value, groupLeaderOptions.value);
  group.label = resolved ?? value.trim();
};

const startGroupLabelDrag = (group: OrgUnitGroup, event: PointerEvent) => {
  if (readonly.value || linkDraftFrom.value || unitLocalDrag.value || isReorderBlockedTarget(event.target)) return;
  if (event.button !== 0) return;

  event.stopPropagation();

  const area = (event.currentTarget as HTMLElement).closest('.org-group-units') as HTMLElement | null;
  if (!area) return;
  const areaRect = area.getBoundingClientRect();
  const startX = group.labelX ?? 24;
  const startY = group.labelY ?? 12;

  labelLocalDrag.value = {
    groupId: group.id,
    offsetX: event.clientX - areaRect.left - startX,
    offsetY: event.clientY - areaRect.top - startY,
    x: startX,
    y: startY
  };
  let moved = false;

  const onMove = (e: PointerEvent) => {
    if (!labelLocalDrag.value) return;
    const dx = Math.abs(e.clientX - event.clientX);
    const dy = Math.abs(e.clientY - event.clientY);
    if (!moved) {
      if (dx < 4 && dy < 4) return;
      moved = true;
      e.preventDefault();
    }
    const rect = area.getBoundingClientRect();
    const maxX = Math.max(0, area.clientWidth - 40);
    const maxY = Math.max(0, area.clientHeight + 80);
    const x = Math.min(maxX, Math.max(0, e.clientX - rect.left - labelLocalDrag.value.offsetX));
    const y = Math.min(maxY, Math.max(0, e.clientY - rect.top - labelLocalDrag.value.offsetY));
    labelLocalDrag.value = { ...labelLocalDrag.value, x, y };
  };

  const onEnd = () => {
    const state = labelLocalDrag.value;
    labelLocalDrag.value = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onEnd);
    window.removeEventListener('pointercancel', onEnd);
    if (!state || !moved) return;
    setGroupLabelPosition(state.groupId, state.x, state.y);
  };

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onEnd);
  window.addEventListener('pointercancel', onEnd);
};

const startLinkMidDrag = (linkId: string, event: PointerEvent) => {
  if (readonly.value || linkDraftFrom.value) return;
  if (event.button !== 0) return;

  const link = orgLinks.value.find((l) => l.id === linkId);
  if (!link) return;
  const fromPt = getAnchorPoint(link.from);
  const toPt = getAnchorPoint(link.to);
  if (!fromPt || !toPt) return;
  const handle = linkMidHandle(
    { ...fromPt, side: link.from.side },
    { ...toPt, side: link.to.side },
    link.mid != null ? { mid: link.mid } : undefined
  );
  if (!handle) return;

  event.preventDefault();
  event.stopPropagation();

  const canvas = mainCanvasRef.value;
  if (!canvas) return;

  linkMidDrag.value = { linkId, axis: handle.axis };
  linkMidPreview.value = link.mid ?? (handle.axis === 'y' ? handle.y : handle.x);

  const onMove = (e: PointerEvent) => {
    if (!linkMidDrag.value) return;
    const rect = canvas.getBoundingClientRect();
    const next = linkMidDrag.value.axis === 'y' ? e.clientY - rect.top : e.clientX - rect.left;
    linkMidPreview.value = next;
  };

  const onEnd = () => {
    const state = linkMidDrag.value;
    const mid = linkMidPreview.value;
    linkMidDrag.value = null;
    linkMidPreview.value = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onEnd);
    window.removeEventListener('pointercancel', onEnd);
    if (!state || mid == null) return;
    setLinkMid(state.linkId, mid);
    scheduleRefreshPorts();
  };

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onEnd);
  window.addEventListener('pointercancel', onEnd);
};

const confirmMessage = computed(() => {
  const target = confirmTarget.value;
  if (!target) return '';

  if (target.type === 'executive') {
    const parts: string[] = [];
    if (target.unitsCount > 0) parts.push(`${target.unitsCount} отд.`);
    if (target.groupsCount > 0) parts.push(`${target.groupsCount} групп`);
    const extra = parts.length ? ` Удалятся также: ${parts.join(', ')}.` : '';
    return `Удалить «${target.label}»?${extra} Это действие нельзя отменить.`;
  }

  if (target.type === 'unit') {
    return `Удалить отдел «${target.label}»? Это действие нельзя отменить.`;
  }

  if (target.unitsCount > 0) {
    return `Удалить группу «${target.label}»? Отделы внутри (${target.unitsCount}) останутся, рамка исчезнет.`;
  }

  return `Удалить группу «${target.label}»?`;
});

const requestRemoveUnit = (unit: OrgUnit) => {
  confirmTarget.value = {
    type: 'unit',
    id: unit.id,
    label: unit.name.trim() || 'Без названия'
  };
};

const requestRemoveExecutive = (exec: OrgExecutive) => {
  const unitsCount = orgUnits.value.filter((u) => u.executiveId === exec.id).length;
  const groupsCount = orgGroups.value.filter((g) => g.executiveId === exec.id).length;
  const label = [exec.title.trim(), exec.person.trim()].filter(Boolean).join(' — ') || 'Директор';
  confirmTarget.value = {
    type: 'executive',
    id: exec.id,
    label,
    unitsCount,
    groupsCount
  };
};

const requestRemoveGroup = (group: OrgUnitGroup, unitsCount: number) => {
  confirmTarget.value = {
    type: 'group',
    id: group.id,
    label: group.label.trim() || 'Без названия',
    unitsCount
  };
};

const onConfirmDelete = () => {
  const target = confirmTarget.value;
  if (!target) return;

  if (target.type === 'executive') {
    removeExecutive(target.id);
  } else if (target.type === 'unit') {
    removeUnit(target.id);
  } else {
    removeGroup(target.id);
  }

  confirmTarget.value = null;
};
</script>
