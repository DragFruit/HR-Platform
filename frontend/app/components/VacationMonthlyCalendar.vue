<template>
  <div class="vacation-calendar-wrap">
    <div class="timeline-scroll-x vac-table-scroll">
      <table
        class="vacation-timeline"
        :class="{ 'vacation-timeline--with-title': showTitleColumn }"
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
  }>(),
  { compactCells: false, showTitleColumn: false, titleColumnToggleable: false }
);

const emit = defineEmits<{
  'toggle-title-column': [];
}>();

const { MONTHS_RU } = useVacations();
const monthHeaders = computed(() => MONTHS_RU.map((label) => label.slice(0, 3)));

const flatEmployees = computed(() => props.departments.flatMap((dep) => dep.employees));

const cellBlocks = (employeeName: string, month: number) =>
  props.getMonthEntries(employeeName, month, props.year);

const blockClass = (block: VacationMonthEntry) => ({
  [block.status]: true,
  reservation: block.kind === 'reservation'
});
</script>
