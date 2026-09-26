<template>
  <div class="quest-dash">
    <header class="quest-dash__head">
      <h1>Quest dashboard · Pit Stop 14</h1>
      <p class="muted">Живой прогресс · аппрув кофе-брейка</p>
    </header>

    <div class="quest-dash__actions">
      <button type="button" class="button primary" :disabled="busy" @click="approveAll">
        АППРУВ ВСЕХ ДОСТУПНЫХ
      </button>
      <button type="button" class="button ghost" @click="load">Обновить</button>
    </div>

    <p v-if="error" class="vac-emp-error">{{ error }}</p>

    <section v-if="coffeeQueue.length" class="quest-dash__coffee">
      <h2>Кофе на проверке ({{ coffeeQueue.length }})</h2>
      <ul>
        <li v-for="row in coffeeQueue" :key="row.userId">
          {{ row.name }}
          <button type="button" class="button ghost" @click="approveOne(row.userId)">Аппрув</button>
        </li>
      </ul>
    </section>

    <div class="quest-dash__table-wrap">
      <table class="quest-dash__table">
        <thead>
          <tr>
            <th>ФИО</th>
            <th>Точка</th>
            <th>Статус</th>
            <th>Прогресс</th>
            <th>Remote</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in players" :key="row.userId">
            <td>{{ row.name }}</td>
            <td>{{ row.point }}</td>
            <td>{{ row.status }}</td>
            <td>{{ row.completed }}/8</td>
            <td>{{ row.isRemote ? 'да' : 'нет' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' });

type Row = {
  userId: number;
  name: string;
  point: number;
  status: string;
  completed: number;
  isRemote: boolean;
  coffeePending: boolean;
};

const players = ref<Row[]>([]);
const coffeeQueue = ref<Row[]>([]);
const error = ref('');
const busy = ref(false);

const load = async () => {
  error.value = '';
  try {
    const data = await $fetch<{ players: Row[]; coffeeQueue: Row[] }>(
      '/api/admin/quest-dashboard'
    );
    players.value = data.players;
    coffeeQueue.value = data.coffeeQueue;
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Ошибка загрузки';
  }
};

const approveAll = async () => {
  busy.value = true;
  try {
    await $fetch('/api/admin/quest-dashboard/coffee-approve', {
      method: 'POST',
      body: { all: true }
    });
    await load();
  } finally {
    busy.value = false;
  }
};

const approveOne = async (userId: number) => {
  await $fetch('/api/admin/quest-dashboard/coffee-approve', {
    method: 'POST',
    body: { userId }
  });
  await load();
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
  gap: 12px;
  margin: 16px 0;
}
.quest-dash__coffee {
  margin-bottom: 20px;
  padding: 12px 16px;
  background: #eeeee8;
  border: 2px solid #111;
  border-radius: 12px;
}
.quest-dash__coffee ul {
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 8px;
}
.quest-dash__coffee li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
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
