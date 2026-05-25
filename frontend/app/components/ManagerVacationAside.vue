<template>
  <aside class="vac-manager-aside-panel">
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
            Руководитель
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

      <div v-if="showHrTab" class="role-switch role-switch--aside" role="group" aria-label="Раздел платформы">
        <button
          type="button"
          class="role-btn"
          :class="{ active: modelValue === 'manager' }"
          @click="setMode('manager')"
        >
          Руководитель
        </button>
        <button
          type="button"
          class="role-btn"
          :class="{ active: modelValue === 'employee' }"
          @click="setMode('employee')"
        >
          Сотрудник
        </button>
        <NuxtLink to="/admin/vacations" class="role-btn role-btn--link">HR</NuxtLink>
      </div>
    </div>

    <template v-if="modelValue === 'manager'">
      <div class="vac-aside-stat-card">
        <div class="vac-aside-stat-label">Сегодня</div>
        <div class="vac-aside-stat-value">{{ todayLabel }}</div>
      </div>

      <div class="vac-aside-stat-card">
        <div class="vac-aside-stat-label">Сейчас в отпуске</div>
        <div class="vac-aside-stat-value">{{ onVacationNow }} из {{ teamTotal }}</div>
      </div>

      <div class="vac-aside-stat-card">
        <div class="vac-aside-stat-label">Заявки</div>
        <ul class="vac-aside-requests list-reset">
          <li class="vac-aside-stat-line">
            <span class="vac-aside-stat-line-label">Всего заявок:</span>
            <span class="vac-aside-stat-line-dots" aria-hidden="true" />
            <span class="vac-aside-stat-line-value">{{ stats.total }}</span>
          </li>
          <li class="vac-aside-stat-line">
            <span class="vac-aside-stat-line-label">На согласовании:</span>
            <span class="vac-aside-stat-line-dots" aria-hidden="true" />
            <span class="vac-aside-stat-line-value">{{ stats.pending }}</span>
          </li>
          <li class="vac-aside-stat-line">
            <span class="vac-aside-stat-line-label">Одобрено:</span>
            <span class="vac-aside-stat-line-dots" aria-hidden="true" />
            <span class="vac-aside-stat-line-value">{{ stats.approved }}</span>
          </li>
          <li class="vac-aside-stat-line">
            <span class="vac-aside-stat-line-label">Отклонено:</span>
            <span class="vac-aside-stat-line-dots" aria-hidden="true" />
            <span class="vac-aside-stat-line-value">{{ stats.rejected }}</span>
          </li>
        </ul>
      </div>
    </template>

    <EmployeeVacationAside v-else :view-year="viewYear" embedded />
  </aside>
</template>

<script setup lang="ts">
export type ManagerVacationUiMode = 'manager' | 'employee';

export type VacationRequestStats = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
};

defineProps<{
  modelValue: ManagerVacationUiMode;
  viewYear: number;
  todayLabel: string;
  onVacationNow: number;
  teamTotal: number;
  stats: VacationRequestStats;
  showHrTab?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: ManagerVacationUiMode];
}>();

const setMode = (mode: ManagerVacationUiMode) => {
  emit('update:modelValue', mode);
};
</script>
