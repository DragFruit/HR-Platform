<template>
  <div
    class="vac-team-calendar"
    :class="{
      'vac-team-calendar--employee-team': variant === 'employee-team',
      'vac-team-calendar--fit-screen': fitScreen,
      'vac-team-calendar--with-side-tabs': variant === 'manager'
    }"
    :style="fitScreenStyle"
  >
    <div class="vac-team-calendar__main">
      <div class="vac-team-calendar__pane">
        <VacationYearTab
          v-if="variant === 'manager'"
          class="vac-team-calendar__yeartab"
          :model-value="viewYear"
          :years="yearOptions"
          @update:model-value="viewYear = $event"
        />
        <div class="vac-team-calendar__frame">
          <button
            v-if="variant === 'manager' && isAdmin"
            type="button"
            class="vac-admin-add-btn vac-admin-add-btn--frame"
            @click="adminAddOpen = true"
          >
            + Добавить отпуск
          </button>

          <VacationDetailedCalendar
            v-if="variant === 'manager' && viewMode === 'detailed'"
            :departments="departments"
            :year="viewYear"
            :requests="requests"
            :reservations="reservations"
            :show-department-daily-counts="showDepartmentDailyCounts"
          />
          <VacationMonthlyCalendar
            v-else
            :departments="departments"
            :year="calendarYear"
            :get-month-entries="getMonthEntries"
            :compact-cells="variant === 'employee-team'"
          />
        </div>
      </div>
    </div>

    <div
      v-if="variant === 'manager'"
      class="vac-cal-side-tabs"
      role="tablist"
      aria-label="Вид календаря"
      data-tour="vac-calendar-view-toggle"
    >
      <button
        type="button"
        role="tab"
        class="vac-cal-side-tab vac-cal-side-tab--detailed"
        :class="{ 'vac-cal-side-tab--active': viewMode === 'detailed' }"
        :aria-selected="viewMode === 'detailed'"
        @click="viewMode = 'detailed'"
      >
        Детально
      </button>
      <button
        type="button"
        role="tab"
        class="vac-cal-side-tab vac-cal-side-tab--months"
        :class="{ 'vac-cal-side-tab--active': viewMode === 'months' }"
        :aria-selected="viewMode === 'months'"
        @click="viewMode = 'months'"
      >
        По месяцам
      </button>
    </div>

    <AdminAddVacationDialog v-if="isAdmin" v-model:open="adminAddOpen" />
  </div>
</template>

<script setup lang="ts">
import type { EmployeeDepartment } from '~/composables/useEmployees';
import type { VacationRequest } from '~/composables/useVacations';
import type { VacationReservation } from '~/utils/vacationReservations';

const props = withDefaults(
  defineProps<{
    departments: EmployeeDepartment[];
    requests: VacationRequest[];
    reservations?: VacationReservation[];
    getMonthEntries: (employeeName: string, month: number, year: number) => {
      status: string;
      label: string;
      kind?: string;
    }[];
    /** manager — год + боковые вкладки вида; employee-team — только таблица по месяцам */
    variant?: 'manager' | 'employee-team';
    defaultViewMode?: 'detailed' | 'months';
    year?: number;
    /** Суммарная строка «в отпуске» по дням (Digital Director). */
    showDepartmentDailyCounts?: boolean;
  }>(),
  { variant: 'manager', defaultViewMode: 'detailed', showDepartmentDailyCounts: false }
);

const { isAdmin } = usePermissions();
const { viewYear, state } = useVacations();

const adminAddOpen = ref(false);
const calendarYear = computed(() => props.year ?? viewYear.value);
const viewMode = ref<'detailed' | 'months'>(props.defaultViewMode);

const yearOptions = computed(() => {
  const primary = state.value.primaryYear || new Date().getFullYear();
  return [primary - 1, primary, primary + 1];
});

const empRowCount = computed(() =>
  props.departments.reduce((sum, dep) => sum + dep.employees.length, 0)
);

/** Уплотняем строки, чтобы большая команда (≈29) помещалась в один viewport. */
const fitScreen = computed(() => props.variant === 'manager' && empRowCount.value >= 20);

const fitScreenStyle = computed(() =>
  fitScreen.value ? { '--vac-team-emp-rows': String(Math.max(empRowCount.value, 1)) } : undefined
);
</script>
