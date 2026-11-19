<template>
  <div class="ogd">
    <div class="ogd__toolbar">
      <p v-if="s" class="ogd__summary">
        Заходили {{ s.entered }} / {{ s.employees }} · прошли все 19 окон {{ s.allDone }}
        <template v-if="s.todayId"> · сегодня (окно {{ s.todayId }}) открыли {{ s.openedToday }}</template>
      </p>
      <button type="button" class="button ghost ogd__refresh" :disabled="loading" @click="load">Обновить</button>
    </div>

    <p v-if="error" class="vac-emp-error">{{ error }}</p>

    <template v-if="s">
      <!-- Итоги по артефактам ивента -->
      <ul class="ogd__tiles">
        <li><b>{{ s.plugged }}</b><span>вилка в розетке</span></li>
        <li><b>{{ s.santaClassic }}</b><span>Тайный Санта · классика</span></li>
        <li><b>{{ s.santaElephant }}</b><span>Белый слон</span></li>
        <li><b>{{ s.hats }}</b><span>в колпаке</span></li>
        <li><b>{{ s.skating }}</b><span>на каток</span></li>
        <li><b>{{ s.toys }}</b><span>игрушек на ёлке</span></li>
        <li><b>{{ s.snowflakes }}</b><span>снежинок</span></li>
        <li><b>{{ s.thanks }}</b><span>открыток «спасибо»</span></li>
        <li><b>{{ s.letters }}</b><span>писем себе</span></li>
        <li><b>{{ s.recipes }}</b><span>рецептов · {{ s.recipeVotes }} голосов</span></li>
      </ul>

      <div class="ogd__mid">
        <!-- Воронка по окнам: открыли / выполнили -->
        <table class="ogd__table ogd__days">
          <thead>
            <tr><th>Окно</th><th>Открыли</th><th>Выполнили</th></tr>
          </thead>
          <tbody>
            <tr v-for="d in byDay" :key="d.id">
              <td>{{ d.id }}. {{ d.title }}</td>
              <td>{{ d.opened }}</td>
              <td>{{ d.done }}</td>
            </tr>
          </tbody>
        </table>

        <table v-if="dresscodeRows.length" class="ogd__table ogd__dress">
          <thead>
            <tr><th>Образ на Огонёк</th><th>Выбрали</th></tr>
          </thead>
          <tbody>
            <tr v-for="[name, n] in dresscodeRows" :key="name">
              <td>{{ name }}</td>
              <td>{{ n }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <div v-if="!loading && !rows.length" class="muted">Нет сотрудников в справочнике</div>

    <div v-else class="ogd__cols">
      <table v-for="(col, ci) in columns" :key="ci" class="ogd__table">
        <thead>
          <tr>
            <th>ФИО</th>
            <th>Окон</th>
            <th>Огоньков</th>
            <th>Санта</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in col" :key="row.employeeId" :class="{ 'is-idle': !row.entered }">
            <td>{{ row.name }}</td>
            <td>{{ row.opened }}</td>
            <td>{{ row.done }}</td>
            <td>{{ SANTA_LABEL[row.santa] ?? '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Статистика «Огонька 2027» для админа — по образцу статистики гонки
 * Pit Stop: итоги, воронка по окнам и все сотрудники в три колонки.
 */

type Row = {
  employeeId: number;
  name: string;
  department: string;
  opened: number;
  done: number;
  santa: string;
  plugged: boolean;
  entered: boolean;
};

type Summary = {
  employees: number;
  entered: number;
  players: number;
  openedToday: number;
  todayId: number | null;
  allDone: number;
  plugged: number;
  hats: number;
  santaClassic: number;
  santaElephant: number;
  skating: number;
  toys: number;
  snowflakes: number;
  thanks: number;
  letters: number;
  recipes: number;
  recipeVotes: number;
};

const SANTA_LABEL: Record<string, string> = { classic: 'классика', elephant: 'слон' };
const COLS = 3;

const rows = ref<Row[]>([]);
const s = ref<Summary | null>(null);
const byDay = ref<{ id: number; title: string; opened: number; done: number }[]>([]);
const dresscode = ref<Record<string, number>>({});
const error = ref('');
const loading = ref(false);

const dresscodeRows = computed(() => Object.entries(dresscode.value).sort((a, b) => b[1] - a[1]));

const columns = computed(() => {
  const list = rows.value;
  if (!list.length) return [] as Row[][];
  const perCol = Math.ceil(list.length / COLS);
  return Array.from({ length: COLS }, (_, i) => list.slice(i * perCol, (i + 1) * perCol)).filter((c) => c.length);
});

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const data = await $fetch<{
      summary: Summary;
      byDay: typeof byDay.value;
      dresscode: Record<string, number>;
      rows: Row[];
    }>('/api/admin/ogonek-dashboard');
    s.value = data.summary;
    byDay.value = data.byDay;
    dresscode.value = data.dresscode;
    rows.value = data.rows;
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Ошибка загрузки';
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.ogd {
  box-sizing: border-box;
  padding: 8px 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ogd__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.ogd__summary { margin: 0; font-size: 0.85rem; }
.ogd__refresh { padding: 4px 10px; font-size: 0.8rem; }

.ogd__tiles {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}
.ogd__tiles li {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  border: 2px solid var(--border-brutal);
  border-radius: 12px;
  background: var(--bg-surface);
}
.ogd__tiles b { font-size: 1.3rem; font-variant-numeric: tabular-nums; }
.ogd__tiles span { font-size: 0.75rem; color: var(--text-muted); }

.ogd__mid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 8px;
  align-items: start;
}

.ogd__cols {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  align-content: start;
}

.ogd__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.75rem;
  background: var(--bg-surface);
  border: 2px solid var(--border-brutal);
}
.ogd__table th,
.ogd__table td {
  padding: 3px 6px;
  border-bottom: 1px solid #e4e4de;
  text-align: left;
}
.ogd__table th { font-weight: 700; background: var(--bg-soft); }
.ogd__table td:not(:first-child),
.ogd__table th:not(:first-child) { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.ogd__table tr.is-idle td { color: var(--text-soft); }

@media (max-width: 1100px) {
  .ogd__tiles { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .ogd__mid, .ogd__cols { grid-template-columns: 1fr; }
}
</style>
