<template>
  <div class="org-unit-fields">
    <InlineField
      v-model="unit.name"
      :readonly="readonly"
      placeholder="Название отдела"
      class-name="org-unit-title"
    />
    <InlineField
      v-if="unit.head || !readonly"
      v-model="unit.head"
      :readonly="readonly"
      placeholder="Руководитель"
      class-name="org-unit-head"
    />
  </div>
</template>

<script setup lang="ts">
import type { OrgUnit } from '~/composables/useOrgStructure';

const props = defineProps<{
  unit: OrgUnit;
  readonly?: boolean;
}>();

const readonly = computed(() => props.readonly ?? false);
</script>
