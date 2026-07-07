<template>
  <div class="org-chart org-chart-vbi">
    <div
      ref="mainCanvasRef"
      class="org-chart-canvas"
      :class="{
        'org-chart-canvas--edit': !readonly,
        'org-chart-canvas--dragging': dragging || resizing,
        'org-chart-canvas--linking': showOrgLinks && Boolean(linkDraftFrom)
      }"
      :style="{ minHeight: `${totalCanvasHeight}px` }"
    >
      <svg
        v-if="showOrgLinks"
        class="org-links-svg"
        :style="{ height: `${totalCanvasHeight}px` }"
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
          :class="`org-node-executive--geo-${execIndex % 3}`"
          data-org-node
          data-org-node-kind="executive"
          :data-org-node-id="exec.id"
        >
          <div class="org-exec-content">
            <InlineField
              v-model="exec.title"
              :readonly="readonly"
              placeholder="Должность"
              class-name="org-exec-title"
            />
            <InlineField
              v-model="exec.person"
              :readonly="readonly"
              placeholder="ФИО"
              class-name="org-exec-person"
            />
          </div>
          <button
            v-if="!readonly"
            type="button"
            class="org-remove-btn org-remove-btn--exec"
            title="Удалить директора"
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
            :class="placedClass(item.unit.id)"
            :style="placedStyle(item.unit, item.unit.id)"
            @pointerdown="(e) => startDrag('unit', item.unit.id, item.unit, e)"
          >
            <article
              class="org-node org-node-unit org-node-unit--solo"
              data-org-node
              data-org-node-kind="unit"
              :data-org-node-id="item.unit.id"
            >
              <button
                v-if="!readonly"
                type="button"
                class="org-remove-btn"
                title="Удалить отдел"
                @click.stop="requestRemoveUnit(item.unit)"
              >
                ×
              </button>
              <OrgUnitFields :unit="item.unit" :readonly="readonly" />
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
                @click.stop="requestRemoveGroup(item.group, item.units.length)"
              >
                ×
              </button>
              <article
                v-for="unit in item.units"
                :key="unit.id"
                class="org-node org-node-unit org-node-unit--in-group"
                data-org-node
                data-org-node-kind="unit"
                :data-org-node-id="unit.id"
              >
                <button
                  v-if="!readonly"
                  type="button"
                  class="org-remove-btn"
                  title="Удалить отдел"
                  @click.stop="requestRemoveUnit(unit)"
                >
                  ×
                </button>
                <OrgUnitFields :unit="unit" :readonly="readonly" />
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
              <p class="org-group-label">
                <InlineField
                  v-model="item.group.label"
                  :readonly="readonly"
                  placeholder="Подпись группы"
                  class-name="org-group-label-text"
                />
              </p>
              <button
                v-if="!readonly"
                type="button"
                class="org-group-add-unit"
                @click.stop="addUnit(item.group.executiveId, item.group.id)"
              >
                + Отдел в группу
              </button>
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
import { ORG_CANVAS_EXEC_OFFSET } from '~/composables/useOrgStructure';
import {
  anchorPoint,
  linkPathD,
  type OrgPortSide,
  type Point
} from '~/utils/orgLinkPath';

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
  groupId: string;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
};

type Positionable = Pick<OrgUnit | OrgUnitGroup, 'x' | 'y'>;

const props = defineProps<{
  readonly?: boolean;
}>();

const readonly = computed(() => props.readonly ?? false);
const { orgLinksEnabled } = useAppEnv();
const showOrgLinks = computed(() => orgLinksEnabled.value);

const {
  executivesSorted,
  placedByExecutive,
  orgUnits,
  orgGroups,
  setUnitPosition,
  setGroupPosition,
  setGroupSize,
  setExecutivePosition,
  removeExecutive,
  removeUnit,
  removeGroup,
  addUnit,
  orgLinks,
  addLink,
  removeLink,
  syncLinksFromStorage,
  globalCanvasMinHeight
} = useOrgStructure();

const mainCanvasRef = ref<HTMLElement | null>(null);
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

const itemKey = (item: OrgPlacedItem) => (item.kind === 'unit' ? item.unit.id : item.group.id);

const hasPlacedItems = computed(() =>
  executivesSorted.value.some((exec) => (placedByExecutive.value[exec.id]?.length ?? 0) > 0)
);

const totalCanvasHeight = computed(() =>
  globalCanvasMinHeight(placedByExecutive.value, executivesSorted.value)
);

const defaultY = () => ORG_CANVAS_EXEC_OFFSET;

const itemPos = (item: Positionable) => ({
  x: item.x ?? 0,
  y: item.y ?? defaultY()
});

const placedStyle = (item: Positionable, id: string) => {
  const isActive = dragging.value?.id === id && dragPreview.value;

  const pos = isActive ? dragPreview.value! : itemPos(item);

  return {
    left: `${pos.x}px`,
    top: `${pos.y}px`
  };
};

const groupFrameStyle = (group: OrgUnitGroup) => {
  const isActive = resizing.value?.groupId === group.id && resizePreview.value;

  const width = isActive ? resizePreview.value!.width : group.width;
  const height = isActive ? resizePreview.value!.height : group.height;

  const style: Record<string, string> = {};
  if (width != null && width > 0) style.width = `${width}px`;
  if (height != null && height > 0) style.height = `${height}px`;
  return style;
};

const placedClass = (id: string) => ({
  'is-dragging': dragging.value?.id === id,
  'is-resizing': resizing.value?.groupId === id
});

const execHasPosition = (exec: OrgExecutive) => exec.x != null && exec.y != null;

const execPlacedStyle = (exec: OrgExecutive, execId: string) => {
  const isActive =
    dragging.value?.kind === 'executive' &&
    dragging.value.id === execId &&
    dragPreview.value;

  if (isActive) {
    return {
      left: `${dragPreview.value!.x}px`,
      top: `${dragPreview.value!.y}px`
    };
  }

  if (execHasPosition(exec)) {
    return {
      left: `${exec.x}px`,
      top: `${exec.y}px`
    };
  }

  return {
    left: `${(executivesSorted.value.findIndex((e) => e.id === execId) || 0) * 220}px`,
    top: '0'
  };
};

const execPlacedClass = (execId: string) => ({
  'is-dragging': dragging.value?.kind === 'executive' && dragging.value.id === execId
});

const isInteractiveTarget = (target: EventTarget | null) =>
  Boolean(
    target &&
      (target as HTMLElement).closest(
        '.org-remove-btn, .org-group-add-unit, .org-field-clear, .org-add-head, .org-port, .inline-edit-input, .editable-line, .org-resize-handle, .org-link-path'
      )
  );

const portMapKey = (kind: OrgNodeKind, id: string, side: OrgPortSide) => `${kind}:${id}:${side}`;

const refreshPortPositions = () => {
  const canvas = mainCanvasRef.value;
  if (!canvas) return;
  const cRect = canvas.getBoundingClientRect();
  const map = new Map<string, Point>();
  canvas.querySelectorAll('[data-org-node]').forEach((el) => {
    const kind = el.getAttribute('data-org-node-kind') as OrgNodeKind | null;
    const id = el.getAttribute('data-org-node-id');
    if (!kind || !id) return;
    const rect = el.getBoundingClientRect();
    const rel: { left: number; top: number; width: number; height: number } = {
      left: rect.left - cRect.left,
      top: rect.top - cRect.top,
      width: rect.width,
      height: rect.height
    };
    (['top', 'right', 'bottom', 'left'] as OrgPortSide[]).forEach((side) => {
      map.set(portMapKey(kind, id, side), anchorPoint(rel, side));
    });
  });
  portPositions.value = map;
};

const getAnchorPoint = (anchor: OrgLinkAnchor): Point | null => {
  const cached = portPositions.value.get(portMapKey(anchor.kind, anchor.id, anchor.side));
  if (cached) return cached;

  const canvas = mainCanvasRef.value;
  if (!canvas) return null;
  const node = canvas.querySelector(
    `[data-org-node-kind="${anchor.kind}"][data-org-node-id="${anchor.id}"]`
  );
  if (!node) return null;
  const cRect = canvas.getBoundingClientRect();
  const rect = node.getBoundingClientRect();
  return anchorPoint(
    {
      left: rect.left - cRect.left,
      top: rect.top - cRect.top,
      width: rect.width,
      height: rect.height
    },
    anchor.side
  );
};

const inferEntrySide = (from: Point, to: Point): OrgPortSide => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'left' : 'right';
  return dy > 0 ? 'top' : 'bottom';
};

const resolvedLinkPaths = computed(() =>
  orgLinks.value
    .map((link) => {
      const fromPt = getAnchorPoint(link.from);
      const toPt = getAnchorPoint(link.to);
      if (!fromPt || !toPt) return null;
      return {
        id: link.id,
        d: linkPathD(
          { ...fromPt, side: link.from.side },
          { ...toPt, side: link.to.side }
        )
      };
    })
    .filter((item): item is { id: string; d: string } => Boolean(item))
);

const draftPathD = computed(() => {
  if (!linkDraftFrom.value || !linkDraftCursor.value) return '';
  const fromPt = getAnchorPoint(linkDraftFrom.value);
  if (!fromPt) return '';
  return linkPathD(
    { ...fromPt, side: linkDraftFrom.value.side },
    { ...linkDraftCursor.value, side: inferEntrySide(fromPt, linkDraftCursor.value) }
  );
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
  const from = linkDraftFrom.value;
  stopLinkGesture();
  const hit = findPortAnchorAt(e.clientX, e.clientY);
  const hover =
    linkDraftHover.value && !isSameAnchor(linkDraftHover.value, from)
      ? linkDraftHover.value
      : null;
  const anchor = hit && !isSameAnchor(hit, from) ? hit : hover;
  if (!anchor) {
    linkDraftCursor.value = null;
    linkDraftHover.value = null;
    return;
  }
  finishLinkAt(anchor);
};

const startLinkGesture = () => {
  stopLinkGesture();
  const ac = new AbortController();
  linkGestureAbort = ac;
  const { signal } = ac;
  window.addEventListener('mousemove', onLinkDraftMove, { signal });
  window.addEventListener('mouseup', onLinkDraftUp, { signal });
  window.addEventListener('pointermove', onLinkDraftMove, { signal });
  window.addEventListener('pointerup', onLinkDraftUp, { signal });
  window.addEventListener('pointercancel', onLinkDraftUp, { signal });
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
    linkDraftCursor.value = null;
    linkDraftHover.value = null;
    startLinkGesture();
    return;
  }

  finishLinkAt(anchor);
};

const scheduleRefreshPorts = () => nextTick(() => refreshPortPositions());

watch([executivesSorted, placedByExecutive, orgLinks, totalCanvasHeight], scheduleRefreshPorts, {
  deep: true
});

onMounted(() => {
  syncLinksFromStorage();
  scheduleRefreshPorts();
  requestAnimationFrame(() => refreshPortPositions());
  window.addEventListener('resize', refreshPortPositions);
});

onBeforeUnmount(() => {
  dragging.value = null;
  resizing.value = null;
  cancelLinkDraft();
  window.removeEventListener('resize', refreshPortPositions);
});

const clampToCanvas = (canvas: HTMLElement, x: number, y: number) => ({
  x: Math.max(0, x),
  y: Math.max(0, y)
});

const startDrag = (
  kind: 'unit' | 'group',
  id: string,
  item: Positionable,
  event: PointerEvent
) => {
  if (readonly.value || isInteractiveTarget(event.target)) return;

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

  handle.setPointerCapture(event.pointerId);

  const onMove = (e: PointerEvent) => {
    if (!dragging.value) return;
    const rect = canvas.getBoundingClientRect();
    dragPreview.value = clampToCanvas(
      canvas,
      e.clientX - rect.left - dragging.value.offsetX,
      e.clientY - rect.top - dragging.value.offsetY
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
  if (readonly.value || isInteractiveTarget(event.target)) return;

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

  handle.setPointerCapture(event.pointerId);

  const onMove = (e: PointerEvent) => {
    if (!dragging.value) return;
    const rect = canvas.getBoundingClientRect();
    dragPreview.value = clampToCanvas(
      canvas,
      e.clientX - rect.left - dragging.value.offsetX,
      e.clientY - rect.top - dragging.value.offsetY
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
  if (readonly.value) return;

  const frame = (event.currentTarget as HTMLElement).closest('.org-group-frame') as HTMLElement;
  if (!frame) return;

  const rect = frame.getBoundingClientRect();
  const startWidth = group.width && group.width > 0 ? group.width : rect.width;
  const startHeight = group.height && group.height > 0 ? group.height : rect.height;

  resizing.value = {
    groupId: group.id,
    startX: event.clientX,
    startY: event.clientY,
    startWidth,
    startHeight
  };
  resizePreview.value = { width: startWidth, height: startHeight };

  const handle = event.currentTarget as HTMLElement;
  handle.setPointerCapture(event.pointerId);

  const onMove = (e: PointerEvent) => {
    if (!resizing.value) return;
    const dw = e.clientX - resizing.value.startX;
    const dh = e.clientY - resizing.value.startY;
    resizePreview.value = {
      width: resizing.value.startWidth + dw,
      height: resizing.value.startHeight + dh
    };
  };

  const onEnd = () => {
    if (resizing.value && resizePreview.value) {
      setGroupSize(resizing.value.groupId, resizePreview.value.width, resizePreview.value.height);
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
