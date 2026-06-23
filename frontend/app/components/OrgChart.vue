<template>
  <div class="org-chart org-chart-vbi">
    <div class="org-executives-band">
      <div
        v-for="exec in executivesSorted"
        :key="exec.id"
        class="org-branch-column"
        :class="{ 'org-branch-column--wide': exec.id === 'exe-ceo' }"
      >
        <div
          :ref="(el) => setCanvasRef(exec.id, el)"
          class="org-branch-canvas"
          :class="{
            'org-branch-canvas--edit': !readonly,
            'org-branch-canvas--dragging': dragging || resizing
          }"
          :style="{ minHeight: `${canvasHeight(exec.id)}px` }"
        >
          <div
            class="org-placed org-placed--exec"
            :class="execPlacedClass(exec.id)"
            :style="execPlacedStyle(exec, exec.id)"
            @pointerdown="(e) => startExecutiveDrag(exec.id, exec, e)"
          >
            <article class="org-node org-node-executive">
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
              <button
                v-if="!readonly && executivesSorted.length > 1"
                type="button"
                class="org-remove-btn"
                title="Удалить директора"
                @click="removeExecutive(exec.id)"
              >
                ×
              </button>
            </article>
          </div>

          <template v-for="item in placedByExecutive[exec.id] ?? []" :key="itemKey(item)">
            <div
              v-if="item.kind === 'unit'"
              class="org-placed org-placed--unit"
              :class="placedClass(item.unit.id, exec.id)"
              :style="placedStyle(item.unit, exec.id, item.unit.id)"
              @pointerdown="(e) => startDrag(exec.id, 'unit', item.unit.id, item.unit, e)"
            >
              <article class="org-node org-node-unit org-node-unit--solo">
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
              </article>
            </div>

            <div
              v-else
              class="org-placed org-placed--group"
              :class="placedClass(item.group.id, exec.id)"
              :style="placedStyle(item.group, exec.id, item.group.id)"
              @pointerdown="(e) => startDrag(exec.id, 'group', item.group.id, item.group, e)"
            >
              <div class="org-group-frame" :style="groupFrameStyle(item.group)">
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
                </article>
                <p class="org-group-label">
                  <InlineField
                    v-model="item.group.label"
                    :readonly="readonly"
                    placeholder="Подпись группы"
                    class-name="org-group-label-text"
                  />
                </p>
                <div
                  v-if="!readonly"
                  class="org-resize-handle"
                  title="Изменить размер рамки"
                  @pointerdown.stop="(e) => startResize(exec.id, item.group, e)"
                />
              </div>
            </div>
          </template>
        </div>

        <p v-if="!(placedByExecutive[exec.id]?.length)" class="org-empty soft">Нет подразделений</p>
      </div>
    </div>

    <OrgConfirmDialog
      :open="confirmTarget !== null"
      :message="confirmMessage"
      @confirm="onConfirmDelete"
      @cancel="confirmTarget = null"
    />
  </div>
</template>

<script setup lang="ts">
import type { OrgExecutive, OrgPlacedItem, OrgUnit, OrgUnitGroup } from '~/composables/useOrgStructure';
import { ORG_CANVAS_EXEC_OFFSET } from '~/composables/useOrgStructure';

type ConfirmTarget =
  | { type: 'unit'; id: string; label: string }
  | { type: 'group'; id: string; label: string; unitsCount: number };

type DragState = {
  execId: string;
  kind: 'unit' | 'group' | 'executive';
  id: string;
  offsetX: number;
  offsetY: number;
};

type ResizeState = {
  execId: string;
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

const {
  executivesSorted,
  placedByExecutive,
  setUnitPosition,
  setGroupPosition,
  setGroupSize,
  setExecutivePosition,
  removeExecutive,
  removeUnit,
  removeGroup,
  canvasMinHeight
} = useOrgStructure();

const canvasRefs = ref<Record<string, HTMLElement | null>>({});
const dragging = ref<DragState | null>(null);
const dragPreview = ref<{ x: number; y: number } | null>(null);
const resizing = ref<ResizeState | null>(null);
const resizePreview = ref<{ width: number; height: number } | null>(null);
const confirmTarget = ref<ConfirmTarget | null>(null);

const itemKey = (item: OrgPlacedItem) => (item.kind === 'unit' ? item.unit.id : item.group.id);

const defaultY = () => ORG_CANVAS_EXEC_OFFSET;

const itemPos = (item: Positionable) => ({
  x: item.x ?? 0,
  y: item.y ?? defaultY()
});

const placedStyle = (item: Positionable, execId: string, id: string) => {
  const isActive =
    dragging.value?.id === id &&
    dragging.value.execId === execId &&
    dragPreview.value;

  const pos = isActive ? dragPreview.value! : itemPos(item);

  return {
    left: `${pos.x}px`,
    top: `${pos.y}px`
  };
};

const groupFrameStyle = (group: OrgUnitGroup) => {
  const isActive =
    resizing.value?.groupId === group.id && resizePreview.value;

  const width = isActive ? resizePreview.value!.width : group.width;
  const height = isActive ? resizePreview.value!.height : group.height;

  const style: Record<string, string> = {};
  if (width != null && width > 0) style.width = `${width}px`;
  if (height != null && height > 0) style.height = `${height}px`;
  return style;
};

const placedClass = (id: string, execId: string) => ({
  'is-dragging': dragging.value?.id === id && dragging.value.execId === execId,
  'is-resizing': resizing.value?.groupId === id && resizing.value.execId === execId
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
      top: `${dragPreview.value!.y}px`,
      transform: 'none'
    };
  }

  if (execHasPosition(exec)) {
    return {
      left: `${exec.x}px`,
      top: `${exec.y}px`,
      transform: 'none'
    };
  }

  return {
    left: '50%',
    top: '0',
    transform: 'translateX(-50%)'
  };
};

const execPlacedClass = (execId: string) => ({
  'is-dragging': dragging.value?.kind === 'executive' && dragging.value.id === execId
});

const canvasHeight = (execId: string) => {
  const exec = executivesSorted.value.find((e) => e.id === execId);
  return canvasMinHeight(placedByExecutive.value[execId] ?? [], exec);
};

const setCanvasRef = (execId: string, el: Element | ComponentPublicInstance | null) => {
  canvasRefs.value[execId] = el instanceof HTMLElement ? el : null;
};

const isInteractiveTarget = (target: EventTarget | null) =>
  Boolean(
    target &&
      (target as HTMLElement).closest(
        '.org-remove-btn, .inline-edit-input, .editable-line, .org-resize-handle'
      )
  );

const clampToCanvas = (canvas: HTMLElement, x: number, y: number) => ({
  x: Math.max(0, x),
  y: Math.max(0, y)
});

const startDrag = (
  execId: string,
  kind: 'unit' | 'group',
  id: string,
  item: Positionable,
  event: PointerEvent
) => {
  if (readonly.value || isInteractiveTarget(event.target)) return;

  const canvas = canvasRefs.value[execId];
  if (!canvas) return;

  const handle = event.currentTarget as HTMLElement;
  const canvasRect = canvas.getBoundingClientRect();
  const pos = itemPos(item);

  dragging.value = {
    execId,
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

  const onEnd = (e: PointerEvent) => {
    if (dragging.value && dragPreview.value) {
      if (dragging.value.kind === 'unit') {
        setUnitPosition(dragging.value.id, dragPreview.value.x, dragPreview.value.y);
      } else {
        setGroupPosition(dragging.value.id, dragPreview.value.x, dragPreview.value.y);
      }
    }
    dragging.value = null;
    dragPreview.value = null;
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

  const canvas = canvasRefs.value[execId];
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
    execId,
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
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onEnd);
    window.removeEventListener('pointercancel', onEnd);
  };

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onEnd);
  window.addEventListener('pointercancel', onEnd);
  event.preventDefault();
};

const startResize = (execId: string, group: OrgUnitGroup, event: PointerEvent) => {
  if (readonly.value) return;

  const frame = (event.currentTarget as HTMLElement).closest('.org-group-frame') as HTMLElement;
  if (!frame) return;

  const rect = frame.getBoundingClientRect();
  const startWidth = group.width && group.width > 0 ? group.width : rect.width;
  const startHeight = group.height && group.height > 0 ? group.height : rect.height;

  resizing.value = {
    execId,
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

  if (target.type === 'unit') {
    removeUnit(target.id);
  } else {
    removeGroup(target.id);
  }

  confirmTarget.value = null;
};

onBeforeUnmount(() => {
  dragging.value = null;
  resizing.value = null;
});
</script>
