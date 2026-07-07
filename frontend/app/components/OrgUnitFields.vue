<template>
  <div class="org-unit-fields">
    <InlineField
      v-model="unit.name"
      :readonly="readonly"
      placeholder="Название отдела"
      class-name="org-unit-title"
    />
    <div v-if="unit.head || showHeadField" class="org-unit-head-row">
      <button
        v-if="!readonly"
        type="button"
        class="org-field-clear"
        title="Убрать руководителя"
        @click.stop="clearHead"
      >
        ×
      </button>
      <InlineField
        v-model="unit.head"
        :readonly="readonly"
        placeholder="Руководитель"
        class-name="org-unit-head"
      />
    </div>
    <button
      v-if="!readonly && !showHeadField"
      type="button"
      class="org-add-head"
      @click.stop="showHeadField = true"
    >
      + Руководитель
    </button>
  </div>
</template>

<script setup lang="ts">
import type { OrgUnit } from '~/composables/useOrgStructure';

const props = defineProps<{
  unit: OrgUnit;
  readonly?: boolean;
}>();

const readonly = computed(() => props.readonly ?? false);
const showHeadField = ref(Boolean(props.unit.head));

watch(
  () => props.unit.head,
  (value) => {
    if (value) showHeadField.value = true;
  }
);

const clearHead = () => {
  props.unit.head = '';
  showHeadField.value = false;
};
</script>
