<template>
  <div class="vacation-calendar-wrap">
    <div
      ref="nameMeasureRef"
      class="vac-team-name-measure"
      aria-hidden="true"
    >
      <span class="vac-team-name-measure__head">Сотрудник</span>
      <span
        v-for="emp in flatEmployees"
        :key="`measure-${emp.id}`"
        class="vac-team-name-measure__name"
      >{{ emp.name }}</span>
    </div>

    <div class="timeline-scroll-x vac-table-scroll">
      <table
        class="vacation-timeline"
        :class="{ 'vacation-timeline--with-title': showTitleColumn }"
        :style="nameColStyle"
      >
        <thead>
          <tr>
            <th
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
            <th v-if="showTitleColumn" class="sticky-col-title sticky-col-title--head">
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
            <th v-for="month in monthHeaders" :key="month">{{ month }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="emp in flatEmployees"
            :key="emp.id"
            class="vac-team-emp-row"
            :class="employeeHighlightClass(emp.name)"
          >
            <td class="sticky-col-name">
              <span class="emp-name emp-name--inline">{{ emp.name }}</span>
            </td>
            <td v-if="showTitleColumn" class="sticky-col-title">
              <span class="emp-title emp-title--col">{{ emp.title || '—' }}</span>
            </td>
            <td
              v-for="monthIndex in 12"
              :key="`${emp.id}-${monthIndex}`"
              class="vac-cell"
              :class="{ 'vac-cell--compact': compactCells }"
            >
              <div v-if="compactCells" class="vac-cell-blocks">
                <span
                  v-for="(block, idx) in cellBlocks(emp.name, monthIndex - 1)"
                  :key="idx"
                  class="vac-block"
                  :class="blockClass(block)"
                >
                  {{ block.label }}
                </span>
              </div>
              <template v-else>
                <span
                  v-for="(block, idx) in cellBlocks(emp.name, monthIndex - 1)"
                  :key="idx"
                  class="vac-block"
                  :class="blockClass(block)"
                >
                  {{ block.label }}
                </span>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { EmployeeDepartment } from '~/composables/useEmployees';
import type { VacationMonthEntry } from '~/utils/vacationReservations';

const NAME_COL_PAD_X = 16;
const NAME_COL_CHEVRON = 24;

let measureCtx: CanvasRenderingContext2D | null = null;

const getMeasureCtx = () => {
  if (!import.meta.client) return null;
  if (measureCtx) return measureCtx;
  const canvas = document.createElement('canvas');
  measureCtx = canvas.getContext('2d');
  return measureCtx;
};

const measureCssText = (text: string, font: string, letterSpacingPx = 0) => {
  const ctx = getMeasureCtx();
  if (!ctx) return text.length * 8;
  ctx.font = font;
  const base = ctx.measureText(text).width;
  if (!letterSpacingPx || text.length < 2) return base;
  return base + letterSpacingPx * (text.length - 1);
};

const props = withDefaults(
  defineProps<{
    departments: EmployeeDepartment[];
    year: number;
    getMonthEntries: (employeeName: string, month: number, year: number) => VacationMonthEntry[];
    /** Узкие ячейки сотрудника: плашки в flex-обёртке, без съезда текста */
    compactCells?: boolean;
    /** Отдельный столбец «Должность» (можно скрыть). */
    showTitleColumn?: boolean;
    /** Стрелка в шапке для скрытия / показа столбца. */
    titleColumnToggleable?: boolean;
    /** Подсветка ФИО; null = режим выкл. */
    highlightEmployeeNames?: string[] | null;
  }>(),
  {
    compactCells: false,
    showTitleColumn: false,
    titleColumnToggleable: false,
    highlightEmployeeNames: null
  }
);

const emit = defineEmits<{
  'toggle-title-column': [];
}>();

const { MONTHS_RU } = useVacations();
const monthHeaders = computed(() => MONTHS_RU.map((label) => label.slice(0, 3)));

const flatEmployees = computed(() => props.departments.flatMap((dep) => dep.employees));

const nameMeasureRef = ref<HTMLElement | null>(null);
const nameColPx = ref(120);

const nameColStyle = computed(() => ({
  '--vac-team-name-col-w': `${nameColPx.value}px`
}));

const buildFontFromStyle = (style: CSSStyleDeclaration | null, fallback: string) => {
  if (!style) return fallback;
  const font = style.font?.trim();
  if (font) return font;
  const weight = style.fontWeight || '600';
  const size = style.fontSize || '12px';
  const family = style.fontFamily || 'sans-serif';
  return `${weight} ${size} ${family}`;
};

const remeasureNameCol = () => {
  if (!import.meta.client) return;

  const root = nameMeasureRef.value;
  const headEl = root?.querySelector('.vac-team-name-measure__head') as HTMLElement | null;
  const nameEl = root?.querySelector('.vac-team-name-measure__name') as HTMLElement | null;

  const headStyle = headEl ? getComputedStyle(headEl) : null;
  const nameStyle = nameEl ? getComputedStyle(nameEl) : null;

  const headFont = buildFontFromStyle(
    headStyle,
    '600 10.4px Unbounded, system-ui, sans-serif'
  );
  const nameFont = buildFontFromStyle(
    nameStyle,
    '600 11.5px Golos Text, system-ui, sans-serif'
  );

  const headSpacing = headStyle ? Number.parseFloat(headStyle.letterSpacing) || 0 : 0;

  // Как в UI: uppercase + letter-spacing у заголовка
  let max = measureCssText('СОТРУДНИК', headFont, headSpacing);

  for (const emp of flatEmployees.value) {
    max = Math.max(max, measureCssText(emp.name, nameFont, 0));
  }

  if (root && max < 40) {
    for (const child of root.children) {
      const el = child as HTMLElement;
      max = Math.max(max, el.scrollWidth, el.offsetWidth);
    }
  }

  if (max <= 0) return;

  const chevron =
    props.titleColumnToggleable && !props.showTitleColumn ? NAME_COL_CHEVRON : 0;
  nameColPx.value = Math.max(96, Math.ceil(max + NAME_COL_PAD_X + chevron));
};

const scheduleRemeasure = async () => {
  await nextTick();
  // Второй кадр — после раскладки/шрифтов, иначе зонд ещё 0
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
  remeasureNameCol();
};

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

const cellBlocks = (employeeName: string, month: number) =>
  props.getMonthEntries(employeeName, month, props.year);

const blockClass = (block: VacationMonthEntry) => ({
  [block.status]: true,
  reservation: block.kind === 'reservation'
});

watch(
  [
    flatEmployees,
    () => props.showTitleColumn,
    () => props.titleColumnToggleable
  ],
  () => {
    void scheduleRemeasure();
  },
  { deep: true }
);

onMounted(() => {
  void scheduleRemeasure();
  if (!import.meta.client) return;
  const fonts = document.fonts;
  if (fonts?.ready) {
    void fonts.ready.then(() => scheduleRemeasure());
  }
});
</script>
