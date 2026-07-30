<template>
  <div class="vacation-calendar-wrap">
    <div class="timeline-scroll-x vac-table-scroll">
      <table
        class="vacation-timeline"
        :class="{
          'vacation-timeline--with-title': showTitleColumn,
          'vacation-timeline--title-collapsed': titleColumnToggleable && !showTitleColumn
        }"
      >
        <thead>
          <tr>
            <th class="sticky-col-name sticky-col-name--head">
              <span class="vac-employee-head-label">Сотрудник</span>
            </th>
            <th
              v-if="titleColumnToggleable || showTitleColumn"
              class="sticky-col-title sticky-col-title--head"
              :class="{ 'sticky-col-title--collapsed': titleColumnToggleable && !showTitleColumn }"
            >
              <div class="vac-title-head">
                <button
                  v-if="titleColumnToggleable"
                  type="button"
                  class="vac-title-col-chevron"
                  :class="{ 'vac-title-col-chevron--open': showTitleColumn }"
                  :aria-label="showTitleColumn ? 'Скрыть столбец «Должность»' : 'Показать столбец «Должность»'"
                  :aria-pressed="showTitleColumn"
                  :title="showTitleColumn ? 'Скрыть должность' : 'Показать должность'"
                  @click.stop="emit('toggle-title-column')"
                >
                  <span class="vac-title-col-chevron__icon" aria-hidden="true" />
                </button>
                <span v-if="showTitleColumn" class="vac-title-head-label">Должность</span>
              </div>
            </th>
            <th v-for="month in monthHeaders" :key="month">{{ month }}</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="dep in departments" :key="dep.name">
            <tr class="dept-row vac-team-dept-row">
              <td :colspan="titleColumnToggleable || showTitleColumn ? 2 : 1" class="sticky-col-dept">
                {{ dep.name }}
              </td>
              <td colspan="12" class="vac-dept-row-fill" aria-hidden="true" />
            </tr>
              <tr v-for="emp in dep.employees" :key="emp.id" class="vac-team-emp-row">
              <td class="sticky-col-name">
                <span class="emp-name emp-name--inline">{{ emp.name }}</span>
              </td>
              <td
                v-if="titleColumnToggleable || showTitleColumn"
                class="sticky-col-title"
                :class="{ 'sticky-col-title--collapsed': titleColumnToggleable && !showTitleColumn }"
              >
                <span v-if="showTitleColumn" class="emp-title emp-title--col">{{ emp.title || '—' }}</span>
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
          </template>
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

const cellBlocks = (employeeName: string, month: number) =>
  props.getMonthEntries(employeeName, month, props.year);

const blockClass = (block: VacationMonthEntry) => ({
  [block.status]: true,
  reservation: block.kind === 'reservation'
});
</script>
