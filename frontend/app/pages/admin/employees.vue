<template>
  <section class="card section-card">
    <div class="section-head row">
      <div>
        <h2 class="section-title">Сотрудники и аккаунты</h2>
        <p class="muted">
          Даты трудоустройства и колонка «Руководитель» — путь подчинения и согласования отпусков.
          Данные синхронизируются с сервером.
        </p>
      </div>
      <button class="button primary" type="button" @click="addEmployee">+ Сотрудник</button>
    </div>

    <article v-if="employees.length === 0" class="state-box onboarding-box">
      <h3>Справочник пуст — это нормально</h3>
      <ol class="onboarding-steps">
        <li>Нажмите «+ Сотрудник» и заполните ФИО, отдел, дату выхода.</li>
        <li>
          Укажите <strong>email</strong> как при входе (например <code>katya@vbi.local</code>) — аккаунт
          привяжется автоматически.
        </li>
        <li>В колонке «Руководитель» укажите менеджера — по этому пути идут согласования отпусков.</li>
      </ol>
      <p class="soft">Переключатель «Сотрудник / Администратор» в сайдбаре — для просмотра графика и настройки справочника.</p>
    </article>

    <div v-else class="personnel-table-wrap">
      <table class="table personnel-table">
        <thead>
          <tr>
            <th class="col-avatar" aria-label="Аватар" />
            <th class="col-name">ФИО</th>
            <th class="col-title">Должность</th>
            <th class="col-dept">Отдел</th>
            <th class="col-manager">Руководитель</th>
            <th class="col-date">Дата трудоустройства</th>
            <th class="col-email">Email / аккаунт</th>
            <th class="col-role">Роль</th>
            <th class="col-actions" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="emp in employees" :key="emp.id">
            <td class="col-avatar">
              <UserAvatar :user-id="emp.platform_user_id" :name="emp.name" :size="32" />
            </td>
            <td class="col-name">
              <input
                :value="emp.name"
                class="table-input"
                placeholder="ФИО"
                @change="updateField(emp.id, 'name', ($event.target as HTMLInputElement).value)"
              />
            </td>
            <td class="col-title">
              <input
                :value="emp.title"
                class="table-input"
                @change="updateField(emp.id, 'title', ($event.target as HTMLInputElement).value)"
              />
            </td>
            <td class="col-dept">
              <input
                :value="emp.department"
                class="table-input"
                list="department-options"
                @change="updateField(emp.id, 'department', ($event.target as HTMLInputElement).value)"
              />
            </td>
            <td class="col-manager">
              <select
                :value="emp.manager"
                class="table-input"
                @change="updateField(emp.id, 'manager', ($event.target as HTMLSelectElement).value)"
              >
                <option value="">—</option>
                <option v-for="name in managerOptions" :key="name" :value="name">{{ name }}</option>
              </select>
            </td>
            <td class="col-date">
              <input
                :value="emp.hired_at"
                type="date"
                class="table-input"
                @change="updateField(emp.id, 'hired_at', ($event.target as HTMLInputElement).value)"
              />
            </td>
            <td class="col-email">
              <select
                class="table-input"
                :value="emp.platform_user_id ?? ''"
                @change="onAccountSelect(emp.id, ($event.target as HTMLSelectElement).value)"
              >
                <option value="">— не привязан —</option>
                <option
                  v-for="acc in platformAccounts"
                  :key="acc.id"
                  :value="acc.id"
                  :disabled="acc.linked && emp.platform_user_id !== acc.id"
                >
                  {{ acc.email }} ({{ acc.name }})
                </option>
              </select>
            </td>
            <td class="col-role">
              <select
                :value="emp.account_role"
                class="table-input"
                @change="
                  updateField(
                    emp.id,
                    'account_role',
                    ($event.target as HTMLSelectElement).value as AccountRole
                  )
                "
              >
                <option value="">—</option>
                <option v-for="(label, key) in roleLabels" :key="key" :value="key">
                  {{ label }}
                </option>
              </select>
            </td>
            <td class="col-actions">
              <button class="button ghost" type="button" @click="removeEmployee(emp.id)">Удалить</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <datalist id="department-options">
      <option v-for="dep in departmentOptions" :key="dep" :value="dep" />
    </datalist>
  </section>
</template>

<script setup lang="ts">
import type { AccountRole, Employee } from '~/composables/useEmployees';
import { roleLabels } from '~/composables/usePermissions';

const {
  employees,
  platformAccounts,
  managerOptions,
  departmentOptions,
  updateEmployee,
  linkEmployeeToAccount,
  addEmployee,
  removeEmployee,
  hydrate
} = useEmployees();

const updateField = (id: number, field: keyof Employee, value: string) => {
  updateEmployee(id, { [field]: value } as Partial<Employee>);
};

const onAccountSelect = (employeeId: number, value: string) => {
  linkEmployeeToAccount(employeeId, value ? Number(value) : null);
};

onMounted(() => {
  hydrate();
});
</script>
