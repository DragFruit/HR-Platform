<template>
  <section class="card section-card">
    <div class="section-head row">
      <div>
        <h2 class="section-title">Аккаунты пользователей</h2>
        <p class="muted">Роли, статусы и принадлежность к подразделениям.</p>
      </div>
      <button class="button primary" type="button">+ Пользователь</button>
    </div>

    <table class="table">
      <thead>
        <tr>
          <th>Имя</th>
          <th>Email</th>
          <th>Роль</th>
          <th>Подразделение</th>
          <th>Статус</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="user in users" :key="user.id">
          <td>{{ user.name }}</td>
          <td><input v-model="user.email" class="table-input" /></td>
          <td>
            <select v-model="user.role" class="table-input">
              <option value="employee">Сотрудник</option>
              <option value="manager">Руководитель</option>
              <option value="hr">HR</option>
              <option value="admin">Администратор</option>
            </select>
          </td>
          <td><input v-model="user.department" class="table-input" /></td>
          <td>
            <select v-model="user.status" class="table-input">
              <option value="active">Активен</option>
              <option value="blocked">Заблокирован</option>
            </select>
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<script setup lang="ts">
const { users } = useAdminData();
</script>
