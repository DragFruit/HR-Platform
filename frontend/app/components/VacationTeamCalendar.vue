<template>
  <div class="vac-team-calendar">
    <div class="vac-team-calendar__toolbar">
      <div class="vac-team-calendar__legend">
        <span class="vac-legend-item">
          <span class="vac-legend-dot vac-legend-dot--approved" />
          Одобренный отпуск
        </span>
        <span class="vac-legend-item">
          <span class="vac-legend-dot vac-legend-dot--pending" />
          На согласовании (предварительно)
        </span>
      </div>
      <div class="vac-team-calendar__controls">
        <div class="vac-view-toggle" role="group" aria-label="Вид календаря">
          <button
            type="button"
            class="vac-view-toggle__btn"
            :class="{ active: viewMode === 'detailed' }"
            @click="viewMode = 'detailed'"
          >
            Детально
          </button>
          <button
            type="button"
            class="vac-view-toggle__btn"
            :class="{ active: viewMode === 'months' }"
            @click="viewMode = 'months'"
          >
            По месяцам
          </button>
        </div>
      </div>
    </div>

    <VacationDetailedCalendar
      v-if="viewMode === 'detailed'"
      :departments="departments"
      :year="year"
      :requests="requests"
    />
    <VacationMonthlyCalendar
      v-else
      :departments="departments"
      :year="year"
      :get-month-entries="getMonthEntries"
    />
  </div>
</template>

<script setup lang="ts">
import type { EmployeeDepartment } from '~/composables/useEmployees';
import type { VacationRequest } from '~/composables/useVacations';

const props = defineProps<{
  departments: EmployeeDepartment[];
  year: number;
  requests: VacationRequest[];
  getMonthEntries: (employeeName: string, month: number, year: number) => {
    status: string;
    label: string;
  }[];
}>();

const viewMode = ref<'detailed' | 'months'>('detailed');
</script>
