<template>
  <section class="card section-card">
    <div class="section-head row">
      <div>
        <h2 class="section-title">Настройка подчинения</h2>
        <p class="muted">
          Связи «сотрудник → руководитель» из справочника. Изменения сохраняются в карточках сотрудников.
        </p>
      </div>
      <NuxtLink to="/admin/employees" class="button ghost">Справочник сотрудников</NuxtLink>
    </div>

    <table class="table">
      <thead>
        <tr>
          <th>Сотрудник</th>
          <th>Руководитель</th>
          <th>Подразделение</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="link in hierarchyLinks" :key="link.employee">
          <td>{{ link.employee }}</td>
          <td>
            <select
              :value="link.manager"
              class="table-input"
              @change="updateManager(link.employee, ($event.target as HTMLSelectElement).value)"
            >
              <option value="">—</option>
              <option v-for="name in managerOptions" :key="name" :value="name">{{ name }}</option>
            </select>
          </td>
          <td>{{ link.department }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<script setup lang="ts">
const { hierarchyLinks, employees, managerOptions, updateEmployee, hydrate } = useEmployees();

const updateManager = (employeeName: string, manager: string) => {
  const emp = employees.value.find((item) => item.name === employeeName);
  if (!emp) return;
  updateEmployee(emp.id, { manager });
};

onMounted(hydrate);
</script>
