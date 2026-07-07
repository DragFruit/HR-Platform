<template>
  <div class="vac-team-calendar">
    <div class="vac-team-calendar__frame">
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
          <select v-model.number="viewYear" class="vac-year-chip" aria-label="Год">
            <option :value="2025">2025</option>
            <option :value="2026">2026</option>
            <option :value="2027">2027</option>
          </select>
          <div
            class="vac-view-toggle"
            role="group"
            aria-label="Вид календаря"
            data-tour="vac-calendar-view-toggle"
          >
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
        :year="viewYear"
        :requests="requests"
      />
      <VacationMonthlyCalendar
        v-else
        :departments="departments"
        :year="viewYear"
        :get-month-entries="getMonthEntries"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { EmployeeDepartment } from '~/composables/useEmployees';
import type { VacationRequest } from '~/composables/useVacations';

defineProps<{
  departments: EmployeeDepartment[];
  requests: VacationRequest[];
  getMonthEntries: (employeeName: string, month: number, year: number) => {
    status: string;
    label: string;
  }[];
}>();

const { viewYear } = useVacations();

const viewMode = ref<'detailed' | 'months'>('detailed');
</script>
