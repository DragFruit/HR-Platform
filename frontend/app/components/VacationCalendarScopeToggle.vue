<template>
  <div
    class="vac-cal-side-tabs"
    role="tablist"
    aria-label="Календарь отпусков"
    data-tour="vac-employee-calendar-scope"
  >
    <button
      type="button"
      role="tab"
      class="vac-cal-side-tab vac-cal-side-tab--mine"
      :class="{ 'vac-cal-side-tab--active': modelValue === 'mine' }"
      :aria-selected="modelValue === 'mine'"
      @click="emit('update:modelValue', 'mine')"
    >
      Мой календарь
    </button>
    <button
      type="button"
      role="tab"
      class="vac-cal-side-tab vac-cal-side-tab--team"
      :class="{ 'vac-cal-side-tab--active': modelValue === 'team' }"
      :aria-selected="modelValue === 'team'"
      @click="emit('update:modelValue', 'team')"
    >
      Общий
    </button>
  </div>
</template>

<script setup lang="ts">
import type { EmployeeCalendarScope } from '~/composables/useEmployeeVacationTeamView';

defineProps<{
  modelValue: EmployeeCalendarScope;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: EmployeeCalendarScope];
}>();
</script>
