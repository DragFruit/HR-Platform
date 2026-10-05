<template>
  <div class="quest-dash">
    <header class="quest-dash__head">
      <h1>Pit Stop 14 · статистика</h1>
      <p class="muted">Разогревочная гонка · кто заходил и сколько кругов проехал</p>
    </header>

    <div class="quest-dash__actions">
      <p v-if="summary" class="quest-dash__summary">
        Заходили {{ summary.entered }} из {{ summary.total }}
        · с кругами {{ summary.raced }}
      </p>
      <button type="button" class="button ghost" :disabled="loading" @click="load">Обновить</button>
    </div>

    <p v-if="error" class="vac-emp-error">{{ error }}</p>

    <div class="quest-dash__table-wrap">
      <table class="quest-dash__table">
        <thead>
          <tr>
            <th>ФИО</th>
            <th>Заходил в игру</th>
            <th>Кругов</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in players" :key="row.employeeId">
            <td>{{ row.name }}</td>
            <td>{{ row.entered ? 'да' : 'нет' }}</td>
            <td>{{ row.laps }}</td>
          </tr>
          <tr v-if="!loading && !players.length">
            <td colspan="3" class="muted">Нет сотрудников в справочнике</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' });

type Row = {
  employeeId: number;
  name: string;
  department: string;
  entered: boolean;
  laps: number;
};

type Summary = { total: number; entered: number; raced: number };

const players = ref<Row[]>([]);
const summary = ref<Summary | null>(null);
const error = ref('');
const loading = ref(false);

const load = async () => {
  loading.value = true;
  error.value = '';
  try {
    const data = await $fetch<{ players: Row[]; summary: Summary }>('/api/admin/quest-dashboard');
    players.value = data.players;
    summary.value = data.summary;
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Ошибка загрузки';
  } finally {
    loading.value = false;
  }
};

onMounted(load);
</script>

<style scoped>
.quest-dash {
  max-width: 960px;
  margin: 0 auto;
  padding: 16px;
}
.quest-dash__head h1 {
  margin: 0 0 4px;
}
.quest-dash__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 16px 0;
}
.quest-dash__summary {
  margin: 0;
  font-size: 0.95rem;
}
.quest-dash__table-wrap {
  overflow-x: auto;
}
.quest-dash__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}
.quest-dash__table th,
.quest-dash__table td {
  border: 1px solid #ddd;
  padding: 8px 10px;
  text-align: left;
}
.quest-dash__table th {
  background: #eeeee8;
}
</style>
