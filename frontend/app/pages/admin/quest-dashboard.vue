<template>
  <div class="quest-dash">
    <div class="quest-dash__toolbar">
      <p v-if="summary" class="quest-dash__summary">
        Заходили {{ summary.entered }} / {{ summary.total }} · круги у {{ summary.raced }}
      </p>
      <button type="button" class="button ghost quest-dash__refresh" :disabled="loading" @click="load">
        Обновить
      </button>
    </div>

    <p v-if="error" class="vac-emp-error">{{ error }}</p>

    <div v-if="!loading && !players.length" class="muted">Нет сотрудников в справочнике</div>

    <div v-else class="quest-dash__cols">
      <table v-for="(col, ci) in columns" :key="ci" class="quest-dash__table">
        <thead>
          <tr>
            <th>ФИО</th>
            <th>Заходил</th>
            <th>Кругов</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in col" :key="row.employeeId">
            <td>{{ row.name }}</td>
            <td>{{ row.entered ? 'да' : 'нет' }}</td>
            <td>{{ row.laps }}</td>
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

const COLS = 3;

const players = ref<Row[]>([]);
const summary = ref<Summary | null>(null);
const error = ref('');
const loading = ref(false);

const columns = computed(() => {
  const list = players.value;
  if (!list.length) return [] as Row[][];
  const perCol = Math.ceil(list.length / COLS);
  return Array.from({ length: COLS }, (_, i) => list.slice(i * perCol, (i + 1) * perCol)).filter(
    (c) => c.length
  );
});

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
  box-sizing: border-box;
  height: calc(100dvh - 72px);
  max-width: none;
  margin: 0;
  padding: 8px 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow: hidden;
}
.quest-dash__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex: 0 0 auto;
}
.quest-dash__summary {
  margin: 0;
  font-size: 0.8rem;
}
.quest-dash__refresh {
  padding: 4px 10px;
  font-size: 0.8rem;
}
.quest-dash__cols {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  align-content: start;
  overflow: hidden;
}
.quest-dash__table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 0.72rem;
  line-height: 1.15;
}
.quest-dash__table th,
.quest-dash__table td {
  border: 1px solid #ddd;
  padding: 1px 5px;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.quest-dash__table th {
  background: #eeeee8;
  font-weight: 600;
}
.quest-dash__table th:nth-child(1),
.quest-dash__table td:nth-child(1) {
  width: auto;
}
.quest-dash__table th:nth-child(2),
.quest-dash__table td:nth-child(2) {
  width: 3.6rem;
}
.quest-dash__table th:nth-child(3),
.quest-dash__table td:nth-child(3) {
  width: 3.2rem;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 1100px) {
  .quest-dash__cols {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .quest-dash {
    height: auto;
    overflow: auto;
  }
  .quest-dash__cols {
    grid-template-columns: 1fr;
    overflow: visible;
  }
}
</style>
