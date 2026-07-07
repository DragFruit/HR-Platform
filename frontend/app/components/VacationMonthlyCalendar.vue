<template>
  <div class="vacation-calendar-wrap">
    <div class="timeline-scroll-x vac-table-scroll">
      <table class="vacation-timeline">
        <thead>
          <tr>
            <th class="sticky-col-name sticky-col-name--head">
              <span class="vac-employee-head-label">Сотрудник</span>
            </th>
            <th v-for="month in monthHeaders" :key="month">{{ month }}</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="dep in departments" :key="dep.name">
            <tr class="dept-row vac-team-dept-row">
              <td class="sticky-col-dept">{{ dep.name }}</td>
              <td colspan="12" class="vac-dept-row-fill" aria-hidden="true" />
            </tr>
              <tr v-for="emp in dep.employees" :key="emp.id" class="vac-team-emp-row">
              <td class="sticky-col-name">
                <span class="emp-name emp-name--inline">{{ emp.name }}</span>
                <span v-if="emp.title" class="emp-title">{{ emp.title }}</span>
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
                    :class="block.status"
                  >
                    {{ block.label }}
                  </span>
                </div>
                <template v-else>
                  <span
                    v-for="(block, idx) in cellBlocks(emp.name, monthIndex - 1)"
                    :key="idx"
                    class="vac-block"
                    :class="block.status"
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

const props = defineProps<{
  departments: EmployeeDepartment[];
  year: number;
  getMonthEntries: (employeeName: string, month: number, year: number) => {
    status: string;
    label: string;
  }[];
  /** Узкие ячейки сотрудника: плашки в flex-обёртке, без съезда текста */
  compactCells?: boolean;
}>();

const { MONTHS_RU } = useVacations();
const monthHeaders = computed(() => MONTHS_RU.map((label) => label.slice(0, 3)));

const cellBlocks = (employeeName: string, month: number) => {
  return props.getMonthEntries(employeeName, month, props.year).map((entry) => ({
    status: entry.status,
    label: entry.label
  }));
};
</script>
