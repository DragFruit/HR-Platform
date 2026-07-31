<template>
  <aside class="vac-manager-aside-panel">
    <div class="vac-aside-stat-card vac-aside-mode-card">
      <VacationUiModeToggle
        :model-value="modelValue"
        :team-mode-label="props.managerModeLabel"
        @update:model-value="setMode"
      />

      <!-- Геометрия как у .emp-balance-card (fit); клик — подсветка в календаре -->
      <button
        type="button"
        class="vac-aside-now-card"
        :class="{
          'vac-aside-now-card--active': focusOnVacation,
          'vac-aside-now-card--empty': vacationNowCount === 0
        }"
        :title="nowCardTitle"
        :aria-pressed="focusOnVacation"
        @click="toggleFocusOnVacation"
      >
        <div class="vac-aside-stat-label">
          Сейчас в отпуске
          <span class="vac-aside-now-card__scope">· {{ teamScopeLabel }}</span>
        </div>
        <div class="vac-aside-stat-value">
          <span class="vac-aside-stat-value__num">{{ vacationNowCount }}</span>
          <span class="vac-aside-stat-value__sep"> из </span>
          <span class="vac-aside-stat-value__num">{{ teamTotal }}</span>
        </div>
      </button>
    </div>

    <div
      v-if="showHrTab"
      class="vac-aside-hr-switch"
      role="group"
      aria-label="Раздел платформы"
    >
      <button type="button" class="vac-aside-hr-switch__btn vac-aside-hr-switch__btn--active">
        Руководитель
      </button>
      <button type="button" class="vac-aside-hr-switch__btn" @click="setMode('employee')">
        Сотрудник
      </button>
      <NuxtLink to="/admin/vacations" class="vac-aside-hr-switch__btn vac-aside-hr-switch__link">
        HR
      </NuxtLink>
    </div>

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
          <span
            v-if="tab.id === 'approval'"
            class="pill mini-pill"
            :class="{ 'mini-pill--zero': !approvalCount }"
          >
            {{ approvalCount }}
          </span>
        </button>
      </div>
    </div>

    <!-- Слот всегда на месте — высота aside не прыгает при смене раздела -->
    <div
      class="vac-aside-stat-card vac-aside-controls-card"
      :class="{ 'vac-aside-controls-card--muted': activeTab !== 'calendar' }"
    >
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
          :disabled="activeTab !== 'calendar'"
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
          :disabled="activeTab !== 'calendar'"
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

    <ManagerVacationTrainingPrompt />
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
    /** Сколько человек сейчас в отпуске (approved ∩ сегодня). */
    vacationNowCount: number;
    teamTotal: number;
    activeTab: ManagerActiveTab;
    viewMode: ManagerCalendarViewMode;
    tabs: ManagerAsideTab[];
    approvalCount?: number;
    showHrTab?: boolean;
    managerModeLabel?: string;
    /** Подпись среза: «команда» / «весь график». */
    teamScopeLabel?: string;
    focusOnVacation?: boolean;
  }>(),
  {
    managerModeLabel: 'Руководитель',
    approvalCount: 0,
    teamScopeLabel: 'команда',
    focusOnVacation: false
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: ManagerVacationUiMode];
  'update:activeTab': [value: ManagerActiveTab];
  'update:viewMode': [value: ManagerCalendarViewMode];
  'update:viewYear': [value: number];
  'update:focusOnVacation': [value: boolean];
}>();

const setMode = (mode: ManagerVacationUiMode) => {
  emit('update:modelValue', mode);
};

const nowCardTitle = computed(() => {
  if (props.vacationNowCount === 0) {
    return `Сейчас никто не в отпуске (${props.teamScopeLabel})`;
  }
  return props.focusOnVacation
    ? 'Снять подсветку сотрудников в отпуске'
    : 'Подсветить в календаре, кто сейчас в отпуске';
});

const toggleFocusOnVacation = () => {
  if (props.vacationNowCount === 0 && !props.focusOnVacation) return;
  emit('update:focusOnVacation', !props.focusOnVacation);
};
</script>
