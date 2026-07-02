<template>
  <div ref="scrollWrapRef" class="vacation-calendar-wrap vac-detailed-wrap">
    <div class="timeline-scroll-x vac-detailed-scroll vac-table-scroll">
      <table ref="tableRef" class="vac-detailed-timeline" :style="nameColCssVars">
        <thead>
          <tr class="vac-detailed-head-month">
            <th class="sticky-col-name sticky-col-name--head">
              <span class="vac-employee-head-label">Сотрудник</span>
            </th>
            <th class="sticky-col-balance sticky-col-balance--head">
              <span class="vac-balance-head-label">Остаток</span>
            </th>
            <th
              v-for="span in monthSpans"
              :key="`m-${span.month}`"
              :colspan="span.days"
              class="vac-detailed-month-label"
            >
              {{ span.label }}
            </th>
          </tr>
          <tr class="vac-detailed-head-days">
            <th class="sticky-col-name sticky-col-name--head-spacer" aria-hidden="true" />
            <th class="sticky-col-balance sticky-col-balance--head-spacer" aria-hidden="true" />
            <th
              v-for="cell in yearDays"
              :key="`d-${cell.iso}`"
              :class="dayHeaderClass(cell)"
            >
              {{ cell.day }}
            </th>
          </tr>
          <tr class="vac-detailed-head-weekdays">
            <th class="sticky-col-name sticky-col-name--head-spacer" aria-hidden="true" />
            <th class="sticky-col-balance sticky-col-balance--head-spacer" aria-hidden="true" />
            <th
              v-for="cell in yearDays"
              :key="`w-${cell.iso}`"
              :class="dayHeaderClass(cell)"
            >
              {{ cell.weekday }}
            </th>
          </tr>
        </thead>
        <tbody>
          <template v-for="dep in visibleDepartments" :key="dep.name">
            <tr class="dept-row vac-detailed-dept-row" @click="toggleDept(dep.name)">
              <td :colspan="totalDays + 2">
                <span class="vac-detailed-dept-chevron" :class="{ collapsed: isCollapsed(dep.name) }">▾</span>
                {{ dep.name }}
              </td>
            </tr>
            <template v-if="!isCollapsed(dep.name)">
              <tr v-for="emp in dep.employees" :key="emp.id" class="vac-detailed-emp-row">
                <td class="sticky-col-name">
                  <EmployeeNameStacked :name="emp.name" />
                  <span v-if="emp.title" class="emp-title">{{ emp.title }}</span>
                </td>
                <td class="sticky-col-balance">{{ balanceFor(emp) }}</td>
                <td :colspan="totalDays" class="vac-detailed-track">
                  <div class="vac-detailed-track-inner" :style="{ '--days': totalDays }">
                    <span
                      v-for="cell in yearDays"
                      :key="`bg-${emp.id}-${cell.iso}`"
                      class="vac-detailed-day-bg"
                      :class="{
                        'is-weekend': cell.weekend,
                        'is-month-start': cell.monthStart
                      }"
                    />
                    <span
                      v-for="(bar, idx) in barsFor(emp.name)"
                      :key="`${emp.id}-bar-${idx}`"
                      class="vac-detailed-bar"
                      :class="bar.status"
                      :style="barStyle(bar)"
                      :title="bar.title"
                    />
                  </div>
                </td>
              </tr>
            </template>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { VacationRequest } from '~/composables/useVacations';
import type { Employee, EmployeeDepartment } from '~/composables/useEmployees';
import { MONTHS_RU, WEEKDAYS_SHORT, isWeekendDay } from '~/utils/vacationCalendar';
import { calcEmployeeBalance } from '~/utils/vacationBalance';

const { state: vacationState } = useVacations();

type YearDayCell = {
  month: number;
  day: number;
  index: number;
  iso: string;
  weekday: string;
  weekend: boolean;
  today: boolean;
  monthStart: boolean;
};

type GanttBar = {
  status: 'approved' | 'pending';
  startIdx: number;
  endIdx: number;
  title: string;
};

const props = defineProps<{
  departments: EmployeeDepartment[];
  year: number;
  requests: VacationRequest[];
}>();

const DAY_COL_PX = 22;
/** Сколько дневных колонок оставить слева от текущей даты при автопрокрутке */
const TODAY_SCROLL_OFFSET_COLS = 3;

const scrollWrapRef = ref<HTMLElement | null>(null);
const tableRef = ref<HTMLTableElement | null>(null);
const nameColWidthPx = ref(112);
const collapsedDepts = ref<Set<string>>(new Set());

const nameColCssVars = computed(() => ({
  '--vac-name-col-w': `${nameColWidthPx.value}px`
}));

const measureNameColumn = () => {
  const cell = tableRef.value?.querySelector('tbody .sticky-col-name') as HTMLElement | null;
  if (cell) {
    nameColWidthPx.value = cell.offsetWidth;
  }
  const rowMonth = tableRef.value?.querySelector('.vac-detailed-head-month') as HTMLElement | null;
  const rowDays = tableRef.value?.querySelector('.vac-detailed-head-days') as HTMLElement | null;
  if (rowMonth && tableRef.value) {
    tableRef.value.style.setProperty('--vac-detailed-head-r1', `${rowMonth.offsetHeight}px`);
  }
  if (rowDays && tableRef.value) {
    tableRef.value.style.setProperty('--vac-detailed-head-r2', `${rowDays.offsetHeight}px`);
  }
};

const parseIso = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const weekdayShort = (date: Date) => {
  const js = date.getDay();
  const idx = js === 0 ? 6 : js - 1;
  return WEEKDAYS_SHORT[idx];
};

const buildYearDays = (year: number): YearDayCell[] => {
  const now = new Date();
  const todayIso =
    now.getFullYear() === year
      ? `${year}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      : null;

  const cells: YearDayCell[] = [];
  let index = 0;

  for (let month = 0; month < 12; month += 1) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day);
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cells.push({
        month,
        day,
        index,
        iso,
        weekday: weekdayShort(date),
        weekend: isWeekendDay(date),
        today: iso === todayIso,
        monthStart: day === 1
      });
      index += 1;
    }
  }

  return cells;
};

const yearDays = computed(() => buildYearDays(props.year));

const totalDays = computed(() => yearDays.value.length);

const monthSpans = computed(() => {
  const spans: { month: number; label: string; days: number }[] = [];
  yearDays.value.forEach((cell) => {
    const last = spans[spans.length - 1];
    if (!last || last.month !== cell.month) {
      spans.push({ month: cell.month, label: MONTHS_RU[cell.month], days: 1 });
      return;
    }
    last.days += 1;
  });
  return spans;
});

const visibleDepartments = computed(() =>
  props.departments.filter((dep) => dep.employees.length > 0)
);

const dayIndex = (date: Date) => {
  const month = date.getMonth();
  const day = date.getDate();
  let idx = 0;
  for (let m = 0; m < month; m += 1) {
    idx += new Date(props.year, m + 1, 0).getDate();
  }
  return idx + day - 1;
};

const dayHeaderClass = (cell: YearDayCell) => {
  const classes: string[] = [];
  if (cell.weekend) classes.push('is-weekend');
  if (cell.today) classes.push('is-today');
  if (cell.monthStart) classes.push('is-month-start');
  return classes;
};

const isCollapsed = (name: string) => collapsedDepts.value.has(name);

const toggleDept = (name: string) => {
  const next = new Set(collapsedDepts.value);
  if (next.has(name)) next.delete(name);
  else next.add(name);
  collapsedDepts.value = next;
};

const balanceFor = (emp: Employee) => {
  const b = calcEmployeeBalance(
    emp.name,
    emp.hired_at || undefined,
    props.requests,
    new Date(),
    vacationState.value.primaryYear,
    emp.vacation_opening_balance
  );
  return b.remain;
};

const clipToYear = (startIso: string, endIso: string): { startIdx: number; endIdx: number } | null => {
  const start = parseIso(startIso);
  const end = parseIso(endIso);
  const yearStart = new Date(props.year, 0, 1);
  const yearEnd = new Date(props.year, 11, 31);
  if (end < yearStart || start > yearEnd) return null;
  const from = start < yearStart ? yearStart : start;
  const to = end > yearEnd ? yearEnd : end;
  return { startIdx: dayIndex(from), endIdx: dayIndex(to) };
};

const barsFor = (employeeName: string): GanttBar[] => {
  const fmt = (iso: string) =>
    parseIso(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

  return props.requests
    .filter(
      (r) =>
        r.employee === employeeName && (r.status === 'approved' || r.status === 'pending')
    )
    .map((r) => {
      const clip = clipToYear(r.start, r.end);
      if (!clip) return null;
      return {
        status: r.status as 'approved' | 'pending',
        startIdx: clip.startIdx,
        endIdx: clip.endIdx,
        title: `${fmt(r.start)} — ${fmt(r.end)}`
      };
    })
    .filter((x): x is GanttBar => x !== null);
};

const barStyle = (bar: GanttBar) => {
  const total = totalDays.value;
  const span = bar.endIdx - bar.startIdx + 1;
  return {
    left: `${(bar.startIdx / total) * 100}%`,
    width: `${(span / total) * 100}%`
  };
};

const scrollToToday = () => {
  const wrap = scrollWrapRef.value?.querySelector('.vac-detailed-scroll') as HTMLElement | null;
  if (!wrap) return;

  const now = new Date();
  if (now.getFullYear() !== props.year) return;

  const todayIdx = yearDays.value.find((cell) => cell.today)?.index;
  if (todayIdx === undefined) return;

  const target = Math.max(0, (todayIdx - TODAY_SCROLL_OFFSET_COLS) * DAY_COL_PX);
  const maxScroll = Math.max(0, wrap.scrollWidth - wrap.clientWidth);
  wrap.scrollLeft = Math.min(target, maxScroll);
};

const scheduleScrollToToday = () => {
  nextTick(() => {
    requestAnimationFrame(() => {
      measureNameColumn();
      scrollToToday();
    });
  });
};

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  scheduleScrollToToday();
  if (typeof ResizeObserver !== 'undefined' && scrollWrapRef.value) {
    resizeObserver = new ResizeObserver(() => measureNameColumn());
    resizeObserver.observe(scrollWrapRef.value);
  }
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
});

watch(
  () => props.year,
  () => scheduleScrollToToday()
);

watch(
  () => props.departments,
  () => nextTick(measureNameColumn),
  { deep: true }
);

watch(collapsedDepts, () => nextTick(measureNameColumn));
</script>
