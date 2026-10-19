<template>
  <div ref="scrollWrapRef" class="vacation-calendar-wrap vac-detailed-wrap">
    <Teleport to="body">
      <div
        ref="nameMeasureRef"
        class="vac-team-name-measure vac-team-name-measure--detailed"
        aria-hidden="true"
      >
        <span class="vac-team-name-measure__head">Сотрудник</span>
        <span
          v-for="emp in visibleEmployees"
          :key="`measure-${emp.id}`"
          class="vac-team-name-measure__name"
        >{{ formatEmployeeShortName(emp.name) }}</span>
        <!-- Эталон ширины колонки «Должность»: всё длиннее → 2-я строка -->
        <span class="vac-team-name-measure__title-ref">{{ TITLE_COL_WRAP_REF }}</span>
      </div>
    </Teleport>

    <div class="timeline-scroll-x vac-detailed-scroll vac-table-scroll">
      <table
        ref="tableRef"
        class="vac-detailed-timeline"
        :class="{ 'vac-detailed-timeline--with-title': showTitleColumn }"
        :style="timelineStyle"
      >
        <colgroup>
          <col class="vac-col-name" />
          <col v-if="showTitleColumn" class="vac-col-title" />
          <col class="vac-col-balance" />
          <col
            v-for="cell in yearDays"
            :key="`col-${cell.iso}`"
            class="vac-col-day"
          />
        </colgroup>
        <thead>
          <tr class="vac-detailed-head-month">
            <th
              :rowspan="headRowSpan"
              class="sticky-col-name sticky-col-name--head"
              :class="{ 'sticky-col-name--title-expand': titleColumnToggleable && !showTitleColumn }"
            >
              <div class="vac-name-head">
                <span class="vac-employee-head-label">Сотрудник</span>
                <button
                  v-if="titleColumnToggleable && !showTitleColumn"
                  type="button"
                  class="vac-title-col-chevron"
                  aria-label="Показать столбец «Должность»"
                  :aria-pressed="false"
                  title="Показать должность"
                  @click.stop="emit('toggle-title-column')"
                >
                  <span class="vac-title-col-chevron__icon" aria-hidden="true" />
                </button>
              </div>
            </th>
            <th
              v-if="showTitleColumn"
              :rowspan="headRowSpan"
              class="sticky-col-title sticky-col-title--head"
            >
              <div class="vac-title-head">
                <button
                  v-if="titleColumnToggleable"
                  type="button"
                  class="vac-title-col-chevron vac-title-col-chevron--open"
                  aria-label="Скрыть столбец «Должность»"
                  :aria-pressed="true"
                  title="Скрыть должность"
                  @click.stop="emit('toggle-title-column')"
                >
                  <span class="vac-title-col-chevron__icon" aria-hidden="true" />
                </button>
                <span class="vac-title-head-label">Должность</span>
              </div>
            </th>
            <th :rowspan="headRowSpan" class="sticky-col-balance sticky-col-balance--head">
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
            <th
              v-for="cell in yearDays"
              :key="`d-${cell.iso}`"
              :class="dayHeaderClass(cell)"
            >
              {{ cell.day }}
            </th>
          </tr>
          <tr class="vac-detailed-head-weekdays">
            <th
              v-for="cell in yearDays"
              :key="`w-${cell.iso}`"
              :class="dayHeaderClass(cell)"
            >
              {{ cell.weekday }}
            </th>
          </tr>
          <tr v-if="showDepartmentDailyCounts" class="vac-detailed-head-counts">
            <th
              v-for="cell in yearDays"
              :key="`c-${cell.iso}`"
              :class="dayHeaderClass(cell)"
              :title="departmentCountTitle(cell.iso)"
            >
              {{ departmentCountForDay(cell.iso) || '' }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="emp in visibleEmployees"
            :key="emp.id"
            class="vac-detailed-emp-row"
            :class="employeeHighlightClass(emp.name)"
          >
            <td class="sticky-col-name">
              <span class="emp-name emp-name--inline">{{ formatEmployeeShortName(emp.name) }}</span>
            </td>
            <td v-if="showTitleColumn" class="sticky-col-title">
              <span class="emp-title emp-title--col">{{ emp.title || '—' }}</span>
            </td>
            <td class="sticky-col-balance">{{ balanceFor(emp) }}</td>
            <td :colspan="totalDays" class="vac-detailed-track">
              <div class="vac-detailed-track-inner" :style="{ '--days': totalDays }">
                <span
                  v-for="(bar, idx) in barsFor(emp)"
                  :key="`${emp.id}-bar-${idx}`"
                  class="vac-detailed-bar"
                  :class="bar.status"
                  :style="barStyle(bar)"
                  :title="bar.title"
                />
                <span
                  v-for="(band, idx) in reservationBandsFor(emp)"
                  :key="`${emp.id}-res-${idx}`"
                  class="vac-detailed-reservation"
                  :style="barStyle(band)"
                  :title="band.title"
                >
                  <span class="vac-reservation-label">{{ band.label }}</span>
                </span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { VacationRequest } from '~/composables/useVacations';
import type { Employee, EmployeeDepartment } from '~/composables/useEmployees';
import { formatEmployeeShortName } from '~/utils/employeeName';
import { vacationBelongsToEmployee } from '~/utils/vacationEmployeeRef';
import { MONTHS_RU, WEEKDAYS_SHORT, isRuHoliday, isWeekendDay } from '~/utils/vacationCalendar';
import { buildFontFromStyle, measureCssText } from '~/utils/measureCssText';
import { calcEmployeeBalance } from '~/utils/vacationBalance';
import {
  formatReservationLabel,
  type VacationReservation
} from '~/utils/vacationReservations';

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

type ReservationBand = {
  startIdx: number;
  endIdx: number;
  title: string;
  label: string;
};

const props = withDefaults(
  defineProps<{
    departments: EmployeeDepartment[];
    year: number;
    requests: VacationRequest[];
    reservations?: VacationReservation[];
    /** Суммарное число сотрудников в отпуске по дням (вся видимая команда). */
    showDepartmentDailyCounts?: boolean;
    /** Отдельный столбец «Должность» (можно скрыть). */
    showTitleColumn?: boolean;
    /** Стрелка в шапке для скрытия / показа столбца. */
    titleColumnToggleable?: boolean;
    /** Подсветка ФИО; null = режим выкл. */
    highlightEmployeeNames?: string[] | null;
  }>(),
  {
    showDepartmentDailyCounts: false,
    showTitleColumn: true,
    titleColumnToggleable: false,
    highlightEmployeeNames: null
  }
);

const emit = defineEmits<{
  'toggle-title-column': [];
}>();

/** Ширина дня — только сетка дат/баров; не связана с ФИО. */
const DAY_COL_PX = 18;
const NAME_COL_PAD_X = 16;
const NAME_COL_CHEVRON = 24;
/** Потолок — иначе ошибка замера раздувает таблицу на весь экран. */
const NAME_COL_MAX_PX = 280;
/** Ширина «Должность» = эта фраза; длиннее — перенос на 2-ю строку. */
const TITLE_COL_WRAP_REF = 'Специалист по контекстной';
const TITLE_COL_PAD_X = 12;
const TITLE_COL_FALLBACK_PX = 148;
/** Сколько дневных колонок оставить слева от текущей даты при автопрокрутке */
const TODAY_SCROLL_OFFSET_COLS = 3;

const scrollWrapRef = ref<HTMLElement | null>(null);
const tableRef = ref<HTMLTableElement | null>(null);
const nameMeasureRef = ref<HTMLElement | null>(null);
/** Подвижная ширина колонки ФИО (max в видимом списке). */
const nameColPx = ref(120);
/** Ширина колонки «Должность» по эталону переноса. */
const titleColPx = ref(TITLE_COL_FALLBACK_PX);

const measureStickyHeaderHeights = () => {
  const rowMonth = tableRef.value?.querySelector('.vac-detailed-head-month') as HTMLElement | null;
  const rowDays = tableRef.value?.querySelector('.vac-detailed-head-days') as HTMLElement | null;
  const rowWeekdays = tableRef.value?.querySelector('.vac-detailed-head-weekdays') as HTMLElement | null;
  if (rowMonth && tableRef.value) {
    tableRef.value.style.setProperty('--vac-detailed-head-r1', `${rowMonth.offsetHeight}px`);
  }
  if (rowDays && tableRef.value) {
    tableRef.value.style.setProperty('--vac-detailed-head-r2', `${rowDays.offsetHeight}px`);
  }
  if (rowWeekdays && tableRef.value) {
    tableRef.value.style.setProperty('--vac-detailed-head-r3', `${rowWeekdays.offsetHeight}px`);
  }
};

const maxDomTextWidth = (root: HTMLElement | null | undefined) => {
  if (!root) return 0;
  let max = 0;
  for (const child of root.children) {
    const el = child as HTMLElement;
    // Только контент зонда (inline-block + max-content), не ширину ячейки таблицы.
    max = Math.max(max, el.scrollWidth);
  }
  return max;
};

const remeasureNameCol = () => {
  if (!import.meta.client) return;

  const root = nameMeasureRef.value;
  let max = maxDomTextWidth(root);

  if (max < 40) {
    const headEl = root?.querySelector('.vac-team-name-measure__head') as HTMLElement | null;
    const nameEl = root?.querySelector('.vac-team-name-measure__name') as HTMLElement | null;
    const headStyle = headEl ? getComputedStyle(headEl) : null;
    const nameStyle = nameEl ? getComputedStyle(nameEl) : null;
    const headFont = buildFontFromStyle(
      headStyle,
      '600 9.6px Unbounded, system-ui, sans-serif'
    );
    const nameFont = buildFontFromStyle(
      nameStyle,
      '600 11.2px Golos Text, system-ui, sans-serif'
    );
    const headSpacing = headStyle ? Number.parseFloat(headStyle.letterSpacing) || 0 : 0;
    max = measureCssText('СОТРУДНИК', headFont, headSpacing);
    for (const emp of visibleEmployees.value) {
      max = Math.max(max, measureCssText(formatEmployeeShortName(emp.name), nameFont, 0));
    }
  }

  if (max > 0) {
    // Место под шеврон всегда, если колонку должности можно прятать —
    // иначе при toggle сначала уезжает «Должность», потом прыгает ФИО (+24px).
    const chevron = props.titleColumnToggleable ? NAME_COL_CHEVRON : 0;
    nameColPx.value = Math.min(
      NAME_COL_MAX_PX,
      Math.max(96, Math.ceil(max + NAME_COL_PAD_X + chevron))
    );
  }

  const titleRefEl = root?.querySelector(
    '.vac-team-name-measure__title-ref'
  ) as HTMLElement | null;
  let titleW = titleRefEl ? titleRefEl.scrollWidth : 0;
  if (titleW < 40) {
    titleW = measureCssText(
      TITLE_COL_WRAP_REF,
      '500 9.76px Golos Text, system-ui, sans-serif',
      0
    );
  }
  if (titleW > 0) {
    titleColPx.value = Math.ceil(titleW + TITLE_COL_PAD_X);
  }
};

const scheduleRemeasureNameCol = async () => {
  await nextTick();
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
  // Второй кадр — после раскладки таблицы и подгрузки сотрудников.
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
  remeasureNameCol();
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
        // Праздничные нерабочие (и переносы) — тот же бледно-синий, что у сб/вс.
        // В 2026 рабочих суббот нет; при появлении — вычесть их из weekend-стиля.
        weekend: isWeekendDay(date) || isRuHoliday(iso),
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

/** Фон сетки дней один раз на таблицу — вместо ~70×365 DOM-узлов `.vac-detailed-day-bg`. */
const dayPaintGradient = computed(() => {
  const days = yearDays.value;
  if (!days.length) return 'none';
  const stops: string[] = [];
  days.forEach((cell, i) => {
    const from = i * DAY_COL_PX;
    const to = (i + 1) * DAY_COL_PX;
    const color = cell.today ? '#ebe6fc' : cell.weekend ? '#e3f0fa' : '#ffffff';
    stops.push(`${color} ${from}px ${to}px`);
  });
  return `linear-gradient(to right, ${stops.join(',')})`;
});

const timelineStyle = computed(() => ({
  '--vac-days': totalDays.value,
  '--days': totalDays.value,
  '--vac-name-col-w': `${nameColPx.value}px`,
  '--vac-day-paint': dayPaintGradient.value,
  ...(props.showTitleColumn
    ? { '--vac-title-col-w': `${titleColPx.value}px` }
    : {})
}));

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

const headRowSpan = computed(() => (props.showDepartmentDailyCounts ? 4 : 3));

const visibleEmployees = computed(() =>
  props.departments.flatMap((dep) => dep.employees)
);

const highlightSet = computed(() => {
  const names = props.highlightEmployeeNames;
  if (!names) return null;
  return new Set(names);
});

const employeeHighlightClass = (name: string) => {
  const set = highlightSet.value;
  if (!set) return null;
  return set.has(name) ? 'is-vacation-focus' : 'is-vacation-dim';
};

const visibleEmployeeNames = computed(() => visibleEmployees.value.map((emp) => emp.name));

const dayIndex = (date: Date) => {
  const month = date.getMonth();
  const day = date.getDate();
  let idx = 0;
  for (let m = 0; m < month; m += 1) {
    idx += new Date(props.year, m + 1, 0).getDate();
  }
  return idx + day - 1;
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

const departmentDayCounts = computed(() => {
  const counts = new Map<string, number>();
  if (!props.showDepartmentDailyCounts) return counts;

  const names = new Set(visibleEmployeeNames.value);
  for (const cell of yearDays.value) {
    counts.set(cell.iso, 0);
  }

  for (const request of props.requests) {
    if (!names.has(request.employee)) continue;
    if (request.status !== 'approved' && request.status !== 'pending') continue;
    const clip = clipToYear(request.start, request.end);
    if (!clip) continue;
    for (let idx = clip.startIdx; idx <= clip.endIdx; idx += 1) {
      const iso = yearDays.value[idx]?.iso;
      if (!iso) continue;
      counts.set(iso, (counts.get(iso) ?? 0) + 1);
    }
  }

  return counts;
});

const departmentCountForDay = (iso: string) => departmentDayCounts.value.get(iso) ?? 0;

const departmentCountTitle = (iso: string) => {
  const count = departmentCountForDay(iso);
  if (!count) return 'Никто не в отпуске';
  return `${count} в отпуске`;
};

const dayHeaderClass = (cell: YearDayCell) => {
  const classes: string[] = [];
  if (cell.weekend) classes.push('is-weekend');
  if (cell.today) classes.push('is-today');
  if (cell.monthStart) classes.push('is-month-start');
  return classes;
};

const balanceByEmployee = computed(() => {
  const y = vacationState.value.primaryYear;
  // Один непрерывный остаток: все заявки всех лет.
  const requests = Object.values(vacationState.value.requestsByYear).flat();
  const asOf = new Date();
  const map = new Map<string, string>();
  for (const emp of visibleEmployees.value) {
    const b = calcEmployeeBalance(
      emp.name,
      emp.hired_at || undefined,
      requests,
      asOf,
      y,
      emp.vacation_opening_balance,
      emp.id
    );
    map.set(emp.name, b.remain);
  }
  return map;
});

const balanceFor = (emp: Employee) => balanceByEmployee.value.get(emp.name) ?? '—';

const barsFor = (emp: Employee): GanttBar[] => {
  const fmt = (iso: string) =>
    parseIso(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

  return props.requests
    .filter(
      (r) =>
        vacationBelongsToEmployee(r, emp) &&
        (r.status === 'approved' || r.status === 'pending')
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

const reservationBandsFor = (emp: Employee): ReservationBand[] => {
  return (props.reservations ?? [])
    .filter((r) => vacationBelongsToEmployee(r, emp) && r.year === props.year)
    .map((r) => {
      const startIdx = dayIndex(new Date(props.year, r.month - 1, 1));
      const daysInMonth = new Date(props.year, r.month, 0).getDate();
      const endIdx = startIdx + daysInMonth - 1;
      const monthLabel = MONTHS_RU[r.month - 1] ?? '';
      const durationLabel = formatReservationLabel(r.durationDays);
      return {
        startIdx,
        endIdx,
        title: `Предварительная бронь: ${monthLabel}, ${durationLabel}`,
        label: durationLabel
      };
    });
};

const barStyle = (bar: { startIdx: number; endIdx: number }) => {
  const span = bar.endIdx - bar.startIdx + 1;
  // Пиксели той же сетки, что day-col (22px) — проценты от ширины td расходятся с шапкой дат
  return {
    left: `${bar.startIdx * DAY_COL_PX}px`,
    width: `${span * DAY_COL_PX}px`
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
      measureStickyHeaderHeights();
      scrollToToday();
    });
  });
};

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  scheduleScrollToToday();
  void scheduleRemeasureNameCol();
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    void document.fonts.ready.then(() => scheduleRemeasureNameCol());
  }
  if (typeof ResizeObserver !== 'undefined' && scrollWrapRef.value) {
    resizeObserver = new ResizeObserver(() => {
      measureStickyHeaderHeights();
      // Не пересчитывать ФИО здесь — scrollWidth ячеек зацикливает раздувание колонки.
    });
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
  () => [props.departments, props.titleColumnToggleable] as const,
  () => {
    nextTick(measureStickyHeaderHeights);
    void scheduleRemeasureNameCol();
  },
  { deep: true }
);

watch(
  () => props.showTitleColumn,
  () => {
    // Только sticky-шапка — ширину ФИО не трогаем (шеврон уже зарезервирован).
    nextTick(measureStickyHeaderHeights);
  }
);

watch(
  () => visibleEmployees.value.map((emp) => emp.name).join('\n'),
  () => {
    void scheduleRemeasureNameCol();
  }
);
</script>
