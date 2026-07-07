<template>
  <div class="emp-aside-role-strip">
    <span class="emp-aside-role-strip-label">Режим</span>

    <div
      class="mgr-emp-slide mgr-emp-slide--interactive"
      :class="{ 'mgr-emp-slide--employee': modelValue === 'employee' }"
      role="group"
      aria-label="Режим интерфейса"
    >
      <span class="mgr-emp-slide-thumb" aria-hidden="true" />
      <div class="mgr-emp-slide-inner">
        <button
          type="button"
          class="mgr-emp-slide-name mgr-emp-slide-name--manager"
          :class="{ active: modelValue === 'manager' }"
          @click="setMode('manager')"
        >
          {{ teamModeLabel }}
        </button>
        <button
          type="button"
          class="mgr-emp-slide-name mgr-emp-slide-name--employee"
          :class="{ active: modelValue === 'employee' }"
          @click="setMode('employee')"
        >
          Сотрудник
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
export type VacationUiMode = 'manager' | 'employee';

const props = withDefaults(
  defineProps<{
    modelValue: VacationUiMode;
    /** Подпись режима «команда/отдел». */
    teamModeLabel?: string;
  }>(),
  { teamModeLabel: 'Руководитель' }
);

const emit = defineEmits<{
  'update:modelValue': [value: VacationUiMode];
}>();

const setMode = (mode: VacationUiMode) => {
  emit('update:modelValue', mode);
};
</script>
