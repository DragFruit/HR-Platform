<template>
  <div class="org-unit-fields">
    <InlineField
      v-model="unit.name"
      :readonly="readonly"
      placeholder="Название отдела"
      class-name="org-unit-title"
    />
    <div v-if="hasHead || showHeadField" class="org-unit-head-row">
      <button
        v-if="!readonly"
        type="button"
        class="org-field-clear"
        title="Убрать руководителя"
        @pointerdown.stop
        @click.stop="clearHead"
      >
        ×
      </button>
      <select
        v-if="!readonly"
        :value="unit.head"
        class="org-unit-head-select"
        @pointerdown.stop
        @click.stop
        @change="onHeadChange(($event.target as HTMLSelectElement).value)"
      >
        <option value="">— Руководитель —</option>
        <option
          v-if="unit.head && !headOptions.includes(unit.head)"
          :value="unit.head"
        >
          {{ unit.head }} (вне списка)
        </option>
        <option v-for="name in headOptions" :key="name" :value="name">{{ name }}</option>
      </select>
      <button
        v-else-if="hasHead"
        type="button"
        class="org-unit-head org-unit-head--link"
        @pointerdown.stop
        @click.stop="openHeadCard($event)"
      >
        {{ displayHeadName }}
      </button>
      <span v-else class="org-unit-head is-empty">Руководитель</span>
    </div>
    <button
      v-if="!readonly && !hasHead && !showHeadField"
      type="button"
      class="org-add-head"
      @pointerdown.stop
      @click.stop="showHeadField = true"
    >
      + Руководитель
    </button>
  </div>
</template>

<script setup lang="ts">
import type { OrgUnit } from '~/composables/useOrgStructure';
import { formatEmployeeShortName, resolveManagerFromList } from '~/utils/employeeName';

const props = defineProps<{
  unit: OrgUnit;
  readonly?: boolean;
}>();

const readonly = computed(() => props.readonly ?? false);
const { employees } = useEmployees();
const { openEmployeeVisitingCard } = useEmployeeVisitingCard();

const hasHead = computed(() => Boolean(String(props.unit.head ?? '').trim()));
const showHeadField = ref(hasHead.value);
/** Сотруднику — без отчества; в админке select хранит полное ФИО из справочника. */
const displayHeadName = computed(() =>
  formatEmployeeShortName(String(props.unit.head ?? '').trim())
);

const headOptions = computed(() => {
  const names = new Set<string>();
  for (const emp of employees.value) {
    const name = emp.name.trim();
    if (name) names.add(name);
  }
  return [...names].sort((a, b) => a.localeCompare(b, 'ru'));
});

watch(
  () => props.unit.head,
  (value) => {
    if (String(value ?? '').trim()) showHeadField.value = true;
  }
);

const clearHead = () => {
  props.unit.head = '';
  showHeadField.value = false;
};

const onHeadChange = (value: string) => {
  const resolved = resolveManagerFromList(value, headOptions.value);
  props.unit.head = resolved ?? value.trim();
  if (!props.unit.head) showHeadField.value = false;
};

const openHeadCard = (event: MouseEvent) => {
  if (!readonly.value) return;
  const name = String(props.unit.head ?? '').trim();
  if (!name) return;
  openEmployeeVisitingCard(name, event);
};
</script>
