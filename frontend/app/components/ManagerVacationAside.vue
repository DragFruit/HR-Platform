<template>
  <aside class="vac-manager-aside-panel">
    <VacationUiModeToggle
      :model-value="modelValue"
      :team-mode-label="props.managerModeLabel"
      @update:model-value="setMode"
    />

    <div
      v-if="showHrTab"
      class="role-switch role-switch--aside"
      role="group"
      aria-label="Раздел платформы"
    >
      <button type="button" class="role-btn active">Руководитель</button>
      <button type="button" class="role-btn" @click="setMode('employee')">Сотрудник</button>
      <NuxtLink to="/admin/vacations" class="role-btn role-btn--link">HR</NuxtLink>
    </div>

    <div class="vac-aside-stat-card">
      <div class="vac-aside-stat-label">Сейчас в отпуске</div>
      <div class="vac-aside-stat-value">{{ onVacationNow }} из {{ teamTotal }}</div>
    </div>

    <ManagerVacationTrainingPrompt />

    <div class="vac-aside-stat-card vac-aside-controls-card">
      <div class="vac-aside-stat-label">Раздел</div>
      <div class="vac-aside-seg" role="group" aria-label="Раздел графика">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          class="vac-aside-seg__btn"
          :class="{ active: activeTab === tab.id }"
          :data-tour="tab.id === 'approval' ? 'vac-approval-tab' : null"
          @click="emit('update:activeTab', tab.id)"
        >
          {{ tab.label }}
          <span v-if="tab.id === 'approval' && approvalCount" class="pill mini-pill">
            {{ approvalCount }}
          </span>
        </button>
      </div>
    </div>

    <div v-if="activeTab === 'calendar'" class="vac-aside-stat-card vac-aside-controls-card">
      <div class="vac-aside-stat-label">Вид</div>
      <div
        class="vac-aside-seg"
        role="tablist"
        aria-label="Вид календаря"
        data-tour="vac-calendar-view-toggle"
      >
        <button
          type="button"
          role="tab"
          class="vac-aside-seg__btn"
          :class="{ active: viewMode === 'detailed' }"
          :aria-selected="viewMode === 'detailed'"
          @click="emit('update:viewMode', 'detailed')"
        >
          Детально
        </button>
        <button
          type="button"
          role="tab"
          class="vac-aside-seg__btn"
          :class="{ active: viewMode === 'months' }"
          :aria-selected="viewMode === 'months'"
          @click="emit('update:viewMode', 'months')"
        >
          По месяцам
        </button>
      </div>
    </div>

    <div class="vac-aside-stat-card vac-aside-controls-card">
      <div class="vac-aside-stat-label">Год</div>
      <VacationYearTab
        class="vac-aside-year-tab"
        :model-value="viewYear"
        :years="yearOptions"
        @update:model-value="emit('update:viewYear', $event)"
      />
    </div>
  </aside>
</template>

<script setup lang="ts">
import type { VacationUiMode } from '~/components/VacationUiModeToggle.vue';

export type ManagerVacationUiMode = VacationUiMode;
export type ManagerCalendarViewMode = 'detailed' | 'months';
export type ManagerActiveTab = 'calendar' | 'approval';

export type ManagerAsideTab = {
  id: ManagerActiveTab;
  label: string;
};

const props = withDefaults(
  defineProps<{
    modelValue: ManagerVacationUiMode;
    viewYear: number;
    yearOptions: number[];
    onVacationNow: number;
    teamTotal: number;
    activeTab: ManagerActiveTab;
    viewMode: ManagerCalendarViewMode;
    tabs: ManagerAsideTab[];
    approvalCount?: number;
    showHrTab?: boolean;
    managerModeLabel?: string;
  }>(),
  { managerModeLabel: 'Руководитель', approvalCount: 0 }
);

const emit = defineEmits<{
  'update:modelValue': [value: ManagerVacationUiMode];
  'update:activeTab': [value: ManagerActiveTab];
  'update:viewMode': [value: ManagerCalendarViewMode];
  'update:viewYear': [value: number];
}>();

const setMode = (mode: ManagerVacationUiMode) => {
  emit('update:modelValue', mode);
};
</script>
