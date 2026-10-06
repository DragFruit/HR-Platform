<template>
  <div class="quest-dash">
    <div class="quest-dash__toolbar">
      <p v-if="summary" class="quest-dash__summary">
        Заходили {{ summary.entered }} / {{ summary.total }} · круги у {{ summary.raced }}
        <template v-if="summary.flaggedCount">
          · подозрение на бота {{ summary.flaggedCount }}
        </template>
      </p>
      <button type="button" class="button ghost quest-dash__refresh" :disabled="loading" @click="load">
        Обновить
      </button>
    </div>

    <p v-if="error" class="vac-emp-error">{{ error }}</p>

    <section v-if="flagged.length" class="quest-dash__flags" aria-label="Подозрение на бота">
      <h2 class="quest-dash__flags-title">Подозрение на бота</h2>
      <ul class="quest-dash__flags-list">
        <li v-for="row in flagged" :key="row.raceUserId" class="quest-dash__flag">
          <div class="quest-dash__flag-main">
            <strong>{{ row.name }}</strong>
            <span class="muted">{{ row.department }}</span>
            <span class="quest-dash__flag-meta">
              {{ formatLapMs(row.bestMs) }} · score {{ row.cheat.score }}
              <template v-if="row.cheat.status === 'confirmed'"> · подтверждено</template>
            </span>
            <span class="quest-dash__flag-reasons">{{ row.cheat.reasons.join(', ') }}</span>
          </div>
          <div class="quest-dash__flag-actions">
            <button
              type="button"
              class="button ghost"
              :disabled="reviewingId === row.raceUserId"
              @click="review(row.raceUserId, 'cleared')"
            >
              Снять
            </button>
            <button
              type="button"
              class="button"
              :disabled="reviewingId === row.raceUserId || row.cheat.status === 'confirmed'"
              @click="review(row.raceUserId, 'confirmed')"
            >
              Подтвердить
            </button>
          </div>
        </li>
      </ul>
    </section>

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
          <tr
            v-for="row in col"
            :key="row.employeeId"
            :class="{ 'is-flagged': row.cheat?.status === 'flagged' || row.cheat?.status === 'confirmed' }"
          >
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
import { formatLapMs } from '~/events/pit-stop-14/trackDrive';

definePageMeta({ layout: 'default' });

type CheatInfo = {
  status: 'flagged' | 'cleared' | 'confirmed';
  score: number;
  reasons: string[];
  bestMs: number;
  at: string;
  raceUserId: number;
};

type Row = {
  employeeId: number;
  name: string;
  department: string;
  entered: boolean;
  laps: number;
  bestMs: number | null;
  cheat: CheatInfo | null;
};

type FlaggedRow = {
  employeeId: number;
  raceUserId: number;
  name: string;
  department: string;
  bestMs: number | null;
  cheat: CheatInfo;
};

type Summary = { total: number; entered: number; raced: number; flaggedCount: number };

const COLS = 3;

const players = ref<Row[]>([]);
const flagged = ref<FlaggedRow[]>([]);
const summary = ref<Summary | null>(null);
const error = ref('');
const loading = ref(false);
const reviewingId = ref<number | null>(null);

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
    const data = await $fetch<{ players: Row[]; flagged: FlaggedRow[]; summary: Summary }>(
      '/api/admin/quest-dashboard'
    );
    players.value = data.players;
    flagged.value = data.flagged ?? [];
    summary.value = data.summary;
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Ошибка загрузки';
  } finally {
    loading.value = false;
  }
};

const review = async (userId: number, status: 'cleared' | 'confirmed') => {
  reviewingId.value = userId;
  error.value = '';
  try {
    await $fetch('/api/admin/quest-dashboard/cheat-review', {
      method: 'POST',
      body: { userId, status }
    });
    await load();
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Не удалось обновить флаг';
  } finally {
    reviewingId.value = null;
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
.quest-dash__flags {
  flex: 0 0 auto;
  max-height: 28vh;
  overflow: auto;
  border: 2px solid #1d1d1f;
  background: #fff8f0;
  padding: 6px 8px;
}
.quest-dash__flags-title {
  margin: 0 0 4px;
  font-size: 0.85rem;
  font-weight: 700;
}
.quest-dash__flags-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.quest-dash__flag {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 0;
  border-top: 1px solid #e0d6c8;
}
.quest-dash__flag:first-child {
  border-top: none;
}
.quest-dash__flag-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  font-size: 0.75rem;
}
.quest-dash__flag-meta {
  font-variant-numeric: tabular-nums;
}
.quest-dash__flag-reasons {
  color: #8a3a1a;
  word-break: break-word;
}
.quest-dash__flag-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.quest-dash__flag-actions .button {
  padding: 4px 10px;
  font-size: 0.75rem;
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
.quest-dash__table tr.is-flagged td {
  background: #ffe8d6;
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
  .quest-dash__flags {
    max-height: none;
  }
}
</style>
