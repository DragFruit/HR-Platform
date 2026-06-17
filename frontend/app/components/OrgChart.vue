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
          :ref="(el) => setGridRef(exec.id, el)"
          class="org-branch-grid"
          :class="{ 'org-branch-grid--edit': !readonly, 'org-branch-grid--dragging': dragging?.execId === exec.id }"
        >
          <article class="org-placed org-placed--exec org-node org-node-executive">
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

          <template v-for="item in placedByExecutive[exec.id] ?? []" :key="itemKey(item)">
            <div
              v-if="item.kind === 'unit'"
              class="org-placed org-placed--unit"
              :class="placedClass(item.unit.id, exec.id)"
              :style="placedStyle(item.unit.gridCol ?? 0, item.unit.gridRow ?? 0)"
              @pointerdown="(e) => startDrag(exec.id, 'unit', item.unit.id, e)"
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
              :style="placedStyle(item.group.gridCol ?? 0, item.group.gridRow ?? 0)"
              @pointerdown="(e) => startDrag(exec.id, 'group', item.group.id, e)"
            >
              <div class="org-group-frame">
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
import type { OrgPlacedItem, OrgUnit, OrgUnitGroup } from '~/composables/useOrgStructure';
import { snapGridCell } from '~/composables/useOrgStructure';

type ConfirmTarget =
  | { type: 'unit'; id: string; label: string }
  | { type: 'group'; id: string; label: string; unitsCount: number };

type DragState = {
  execId: string;
  kind: 'unit' | 'group';
  id: string;
};

const props = defineProps<{
  readonly?: boolean;
}>();

const readonly = computed(() => props.readonly ?? false);

const {
  executivesSorted,
  placedByExecutive,
  setUnitGrid,
  setGroupGrid,
  removeExecutive,
  removeUnit,
  removeGroup
} = useOrgStructure();

const gridRefs = ref<Record<string, HTMLElement | null>>({});
const dragging = ref<DragState | null>(null);
const confirmTarget = ref<ConfirmTarget | null>(null);

const itemKey = (item: OrgPlacedItem) => (item.kind === 'unit' ? item.unit.id : item.group.id);

const placedStyle = (col: number, row: number) => ({
  gridColumn: `${col + 1} / span 1`,
  gridRow: `${row + 2}`
});

const placedClass = (id: string, execId: string) => ({
  'is-dragging': dragging.value?.id === id && dragging.value.execId === execId
});

const setGridRef = (execId: string, el: Element | ComponentPublicInstance | null) => {
  gridRefs.value[execId] = el instanceof HTMLElement ? el : null;
};

const isInteractiveTarget = (target: EventTarget | null) =>
  Boolean(
    target &&
      (target as HTMLElement).closest('.org-remove-btn, .inline-edit-input, .editable-line')
  );

const startDrag = (execId: string, kind: 'unit' | 'group', id: string, event: PointerEvent) => {
  if (readonly.value || isInteractiveTarget(event.target)) return;

  dragging.value = { execId, kind, id };

  const handle = event.currentTarget as HTMLElement;
  handle.setPointerCapture(event.pointerId);

  const onEnd = (e: PointerEvent) => {
    const grid = gridRefs.value[execId];
    if (grid && dragging.value) {
      const { col, row } = snapGridCell(grid, e.clientX, e.clientY);
      if (dragging.value.kind === 'unit') {
        setUnitGrid(dragging.value.id, col, row);
      } else {
        setGroupGrid(dragging.value.id, col, row);
      }
    }
    dragging.value = null;
    window.removeEventListener('pointerup', onEnd);
    window.removeEventListener('pointercancel', onEnd);
  };

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
});
</script>
