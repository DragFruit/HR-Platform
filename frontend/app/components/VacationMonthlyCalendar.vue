<template>
  <div class="vacation-calendar-wrap">
    <div class="timeline-scroll-x">
      <table class="vacation-timeline">
        <thead>
          <tr>
            <th class="sticky-col-name">Сотрудник</th>
            <th v-for="month in months" :key="month">{{ month }}</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="dep in departments" :key="dep.name">
            <tr class="dept-row">
              <td :colspan="13">{{ dep.name }}</td>
            </tr>
            <tr v-for="emp in dep.employees" :key="emp.id">
              <td class="sticky-col-name">
                <span class="emp-name">{{ emp.name }}</span>
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
const months = MONTHS_RU;

const cellBlocks = (employeeName: string, month: number) => {
  const entries = props.getMonthEntries(employeeName, month, props.year);
  const labelsByStatus = new Map<string, string[]>();
  entries.forEach((entry) => {
    const bucket = labelsByStatus.get(entry.status) ?? [];
    bucket.push(entry.label);
    labelsByStatus.set(entry.status, bucket);
  });
  return [...labelsByStatus.entries()].map(([status, labels]) => ({
    status,
    label: labels.join(', ')
  }));
};
</script>
