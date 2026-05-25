<template>
  <section class="card section-card">
    <div class="section-head row">
      <div>
        <h2 class="section-title">Сотрудники</h2>
        <p class="muted">Справочник для графика отпусков: ФИО, подразделение, руководитель и дата трудоустройства.</p>
      </div>
      <button class="button primary" type="button" @click="addEmployee">+ Сотрудник</button>
    </div>

    <table class="table employees-table">
      <thead>
        <tr>
          <th>ФИО</th>
          <th>Должность</th>
          <th>Подразделение</th>
          <th>Руководитель</th>
          <th>Дата трудоустройства</th>
          <th />
        </tr>
      </thead>
      <tbody>
        <tr v-for="emp in employees" :key="emp.id">
          <td>
            <input
              :value="emp.name"
              class="table-input"
              @change="updateField(emp.id, 'name', ($event.target as HTMLInputElement).value)"
            />
          </td>
          <td>
            <input
              :value="emp.title"
              class="table-input"
              @change="updateField(emp.id, 'title', ($event.target as HTMLInputElement).value)"
            />
          </td>
          <td>
            <input
              :value="emp.department"
              class="table-input"
              list="department-options"
              @change="updateField(emp.id, 'department', ($event.target as HTMLInputElement).value)"
            />
          </td>
          <td>
            <select
              :value="emp.manager"
              class="table-input"
              @change="updateField(emp.id, 'manager', ($event.target as HTMLSelectElement).value)"
            >
              <option value="">—</option>
              <option v-for="name in managerOptions" :key="name" :value="name">{{ name }}</option>
            </select>
          </td>
          <td>
            <input
              :value="emp.hired_at"
              type="date"
              class="table-input"
              @change="updateField(emp.id, 'hired_at', ($event.target as HTMLInputElement).value)"
            />
          </td>
          <td>
            <button class="button ghost" type="button" @click="removeEmployee(emp.id)">Удалить</button>
          </td>
        </tr>
      </tbody>
    </table>

    <datalist id="department-options">
      <option v-for="dep in departmentOptions" :key="dep" :value="dep" />
    </datalist>
  </section>
</template>

<script setup lang="ts">
import type { Employee } from '~/composables/useEmployees';

const {
  employees,
  managerOptions,
  departmentOptions,
  updateEmployee,
  addEmployee,
  removeEmployee,
  hydrate
} = useEmployees();

const updateField = (id: number, field: keyof Employee, value: string) => {
  updateEmployee(id, { [field]: value } as Partial<Employee>);
};

onMounted(hydrate);
</script>
