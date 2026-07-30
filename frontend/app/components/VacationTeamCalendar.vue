<template>
  <div
    class="vac-team-calendar"
    :class="{
      'vac-team-calendar--employee-team': variant === 'employee-team',
      'vac-team-calendar--with-side-tabs': variant === 'manager'
    }"
    :style="viewportStyle"
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
        <div ref="frameRef" class="vac-team-calendar__frame">
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
            :show-title-column="showTitleColumn"
            title-column-toggleable
            @toggle-title-column="toggleTitleColumn"
          />
          <VacationMonthlyCalendar
            v-else
            :departments="departments"
            :year="calendarYear"
            :get-month-entries="getMonthEntries"
            :compact-cells="variant === 'employee-team'"
            :show-title-column="variant === 'manager' && showTitleColumn"
            :title-column-toggleable="variant === 'manager'"
            @toggle-title-column="toggleTitleColumn"
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

/** Зазор от нижнего края экрана до поля таблицы (px). */
const VIEWPORT_BOTTOM_GAP_PX = 5;

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

const frameRef = ref<HTMLElement | null>(null);
const viewportMaxPx = ref<number | null>(null);

const updateViewportMax = () => {
  if (props.variant !== 'manager' || !import.meta.client) return;
  const el = frameRef.value;
  if (!el) return;
  const top = el.getBoundingClientRect().top;
  viewportMaxPx.value = Math.max(160, Math.floor(window.innerHeight - top - VIEWPORT_BOTTOM_GAP_PX));
};

const viewportStyle = computed(() => {
  if (props.variant !== 'manager' || viewportMaxPx.value == null) return undefined;
  return { '--vac-team-viewport-max': `${viewportMaxPx.value}px` };
});

const TITLE_COL_STORAGE_KEY = 'vbi-vac-show-title-col-v1';

const readTitleColumnPref = (): boolean => {
  if (!import.meta.client) return true;
  try {
    const raw = localStorage.getItem(TITLE_COL_STORAGE_KEY);
    if (raw === null) return true;
    return raw === '1' || raw === 'true';
  } catch {
    return true;
  }
};

const showTitleColumn = ref(true);

const toggleTitleColumn = () => {
  showTitleColumn.value = !showTitleColumn.value;
  if (!import.meta.client) return;
  try {
    localStorage.setItem(TITLE_COL_STORAGE_KEY, showTitleColumn.value ? '1' : '0');
  } catch {
    /* ignore */
  }
};

const yearOptions = computed(() => {
  const primary = state.value.primaryYear || new Date().getFullYear();
  return [primary - 1, primary, primary + 1];
});

watch(viewMode, () => nextTick(updateViewportMax));

onMounted(() => {
  showTitleColumn.value = readTitleColumnPref();
  if (!import.meta.client) return;
  const scheduleMeasure = () => {
    nextTick(() => {
      updateViewportMax();
      requestAnimationFrame(updateViewportMax);
    });
  };
  scheduleMeasure();
  window.addEventListener('resize', updateViewportMax);
});

onBeforeUnmount(() => {
  if (!import.meta.client) return;
  window.removeEventListener('resize', updateViewportMax);
});
</script>
