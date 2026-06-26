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
            <tr class="dept-row">
              <td :colspan="13">{{ dep.name }}</td>
            </tr>
            <tr v-for="emp in dep.employees" :key="emp.id">
              <td class="sticky-col-name">
                <EmployeeNameStacked :name="emp.name" />
                <span v-if="emp.title" class="emp-title">{{ emp.title }}</span>
              </td>
              <td
                v-for="monthIndex in 12"
                :key="`${emp.id}-${monthIndex}`"
                class="vac-cell"
              >
                <span
                  v-for="(block, idx) in cellBlocks(emp.name, monthIndex - 1)"
                  :key="idx"
                  class="vac-block"
                  :class="block.status"
                >
                  {{ block.label }}
                </span>
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
