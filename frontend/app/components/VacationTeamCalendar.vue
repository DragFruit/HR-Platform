<template>
  <div
    class="vac-team-calendar"
    :class="{
      'vac-team-calendar--employee-team': variant === 'employee-team',
      'vac-team-calendar--with-side-tabs': variant === 'manager' && !hideChrome,
      'vac-team-calendar--fill-viewport': fillViewport
    }"
    :style="viewportStyle"
  >
    <div class="vac-team-calendar__main">
      <div class="vac-team-calendar__pane">
        <div
          v-if="variant === 'manager' && !hideChrome"
          class="vac-team-calendar__chrome"
        >
          <button
            v-if="isAdmin && !hideAdminAdd"
            type="button"
            class="vac-admin-add-btn vac-admin-add-btn--chrome"
            @click="adminAddOpen = true"
          >
            + Добавить отпуск
          </button>
          <VacationYearTab
            class="vac-team-calendar__yeartab"
            :model-value="viewYear"
            :years="yearOptions"
            @update:model-value="viewYear = $event"
          />
        </div>

        <div class="vac-team-calendar__body">
          <div ref="frameRef" class="vac-team-calendar__frame">
            <VacationDetailedCalendar
              v-if="variant === 'manager' && resolvedViewMode === 'detailed'"
              :departments="departments"
              :year="viewYear"
              :requests="requests"
              :reservations="reservations"
              :show-department-daily-counts="showDepartmentDailyCounts"
              :show-title-column="showTitleColumn"
              :highlight-employee-names="highlightEmployeeNames"
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
              :highlight-employee-names="highlightEmployeeNames"
              @toggle-title-column="toggleTitleColumn"
            />
          </div>

          <div
            v-if="variant === 'manager' && !hideChrome"
            class="vac-cal-side-tabs"
            role="tablist"
            aria-label="Вид календаря"
            data-tour="vac-calendar-view-toggle"
          >
            <button
              type="button"
              role="tab"
              class="vac-cal-side-tab vac-cal-side-tab--detailed"
              :class="{ 'vac-cal-side-tab--active': resolvedViewMode === 'detailed' }"
              :aria-selected="resolvedViewMode === 'detailed'"
              @click="setViewMode('detailed')"
            >
              Детально
            </button>
            <button
              type="button"
              role="tab"
              class="vac-cal-side-tab vac-cal-side-tab--months"
              :class="{ 'vac-cal-side-tab--active': resolvedViewMode === 'months' }"
              :aria-selected="resolvedViewMode === 'months'"
              @click="setViewMode('months')"
            >
              По месяцам
            </button>
          </div>
        </div>
      </div>
    </div>

    <AdminAddVacationDialog v-if="isAdmin && !hideAdminAdd" v-model:open="adminAddOpen" />
  </div>
</template>

<script setup lang="ts">
import type { EmployeeDepartment } from '~/composables/useEmployees';
import type { VacationRequest } from '~/composables/useVacations';
import type { VacationReservation } from '~/utils/vacationReservations';

/** Зазор от нижнего края окна до поля таблицы (визуальные px). */
const VIEWPORT_BOTTOM_GAP_PX = 8;
/** Потолок высоты по viewport (класс --fill-viewport); белый фон не растягиваем. */
const FILL_VIEWPORT_MIN_ROWS = 12;

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
    /** Внешнее управление видом (правое меню руководителя). */
    viewMode?: 'detailed' | 'months';
    /** Скрыть год и боковые вкладки — они в ManagerVacationAside. */
    hideChrome?: boolean;
    /** Скрыть «+ Добавить отпуск» (превью «Как выглядит»). */
    hideAdminAdd?: boolean;
    year?: number;
    /** Суммарная строка «в отпуске» по дням (Digital Director). */
    showDepartmentDailyCounts?: boolean;
    /** Подсветка строк (например «сейчас в отпуске»); null = выкл. */
    highlightEmployeeNames?: string[] | null;
  }>(),
  {
    variant: 'manager',
    defaultViewMode: 'detailed',
    hideChrome: false,
    hideAdminAdd: false,
    showDepartmentDailyCounts: false,
    highlightEmployeeNames: null
  }
);

const emit = defineEmits<{
  'update:viewMode': [value: 'detailed' | 'months'];
}>();

const { isAdmin } = usePermissions();
const { viewYear, state } = useVacations();

const adminAddOpen = ref(false);
const calendarYear = computed(() => props.year ?? viewYear.value);
const localViewMode = ref<'detailed' | 'months'>(props.defaultViewMode);

const resolvedViewMode = computed(() => props.viewMode ?? localViewMode.value);

const setViewMode = (mode: 'detailed' | 'months') => {
  if (props.viewMode !== undefined) {
    emit('update:viewMode', mode);
    return;
  }
  localViewMode.value = mode;
};

const frameRef = ref<HTMLElement | null>(null);
const viewportMaxPx = ref<number | null>(null);

const empRowCount = computed(() =>
  props.departments.reduce((sum, dep) => sum + dep.employees.length, 0)
);

const fillViewport = computed(
  () =>
    props.variant === 'manager' &&
    props.hideChrome &&
    empRowCount.value >= FILL_VIEWPORT_MIN_ROWS
);

const updateViewportMax = () => {
  if (props.variant !== 'manager' || !import.meta.client) return;
  const el = frameRef.value;
  if (!el) return;
  const top = el.getBoundingClientRect().top;
  // До низа окна (первый экран = 100dvh, футер ниже fold) — 8px зазор
  const visualRoom = window.innerHeight - top - VIEWPORT_BOTTOM_GAP_PX;
  viewportMaxPx.value = Math.max(160, Math.floor(visualRoom));
};

const viewportStyle = computed(() => {
  if (props.variant !== 'manager' || viewportMaxPx.value == null) return undefined;
  return { '--vac-team-viewport-max': `${viewportMaxPx.value}px` };
});

const TITLE_COL_STORAGE_KEY = 'vbi-vac-show-title-col-v2';

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

watch(resolvedViewMode, () => nextTick(updateViewportMax));
watch(empRowCount, () => nextTick(updateViewportMax));

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
