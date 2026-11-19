<template>
  <div class="ogd">
    <div class="ogd__toolbar">
      <h1 class="ogd__h1">Огонёк 2027 · статистика</h1>
      <div class="ogd__actions">
        <NuxtLink class="button ghost ogd__btn" to="/admin/ogonek-santa">Тайный Санта →</NuxtLink>
        <button type="button" class="button ghost ogd__btn" :disabled="loading" @click="load">Обновить</button>
      </div>
    </div>

    <p v-if="error" class="vac-emp-error">{{ error }}</p>

    <template v-if="s">
      <!-- Главное: охват -->
      <ul class="ogd__kpis">
        <li>
          <b>{{ s.players }}</b>
          <span>зашли в ивент <i>из {{ s.employees }} сотрудников</i></span>
        </li>
        <li>
          <b>{{ s.todayId ? s.openedToday : '—' }}</b>
          <span>
            <template v-if="s.todayId">открыли сегодняшнее окно <i>№{{ s.todayId }}</i></template>
            <template v-else>сегодня окна нет</template>
          </span>
        </li>
        <li>
          <b>{{ s.allDone }}</b>
          <span>прошли все 19 окон</span>
        </li>
        <li>
          <b>{{ s.plugged }}</b>
          <span>включили новогодний дизайн</span>
        </li>
      </ul>

      <!-- Звания -->
      <section class="ogd__block">
        <h2 class="ogd__h2">Звания</h2>
        <ul class="ogd__ranks">
          <li v-for="r in ranks" :key="r.title">
            <OgonekSprite class="ogd__rank-art" :rows="ogonekRankArt(r.title)" :width="40" />
            <b>{{ r.count }}</b>
            <span>{{ r.title }}<i> · от {{ r.from }} окон</i></span>
          </li>
        </ul>
      </section>

      <!-- Карточки по окнам: число и список, кто -->
      <section class="ogd__cards">
        <article class="ogd__card">
          <header><b>{{ s.santaClassic + s.santaElephant }}</b><span>в Тайном Санте</span></header>
          <p class="ogd__sub">классика {{ s.santaClassic }} · Белый слон {{ s.santaElephant }}</p>
          <details v-if="lists.santaClassic.length"><summary>Классика</summary><PeopleList :people="lists.santaClassic" /></details>
          <details v-if="lists.santaElephant.length"><summary>Белый слон</summary><PeopleList :people="lists.santaElephant" /></details>
          <NuxtLink class="ogd__more" to="/admin/ogonek-santa">Пары, вишлисты, порядок ходов →</NuxtLink>
        </article>

        <article class="ogd__card">
          <header><b>{{ s.skating }}</b><span>идут на каток</span></header>
          <details v-if="lists.skating.length"><summary>Кто</summary><PeopleList :people="lists.skating" /></details>
        </article>

        <article class="ogd__card ogd__card--wide">
          <header><b>{{ s.recipes }}</b><span>рецептов оливье · {{ s.recipeVotes }} голосов</span></header>
          <details v-for="r in lists.recipes" :key="r.title + r.name">
            <summary>{{ r.title || 'Без названия' }} — {{ r.name }} <i>· {{ r.votes }} {{ votesWord(r.votes) }}</i></summary>
            <p class="ogd__text">{{ r.text }}</p>
          </details>
        </article>

        <article class="ogd__card">
          <header><b>{{ s.plugged }}</b><span>включили новогодний дизайн</span></header>
          <details v-if="lists.plugged.length"><summary>Кто</summary><PeopleList :people="lists.plugged" /></details>
        </article>

        <article class="ogd__card">
          <header><b>{{ s.hats }}</b><span>в колпаке на аватарке</span></header>
          <details v-if="lists.hats.length"><summary>Кто</summary><PeopleList :people="lists.hats" /></details>
        </article>

        <article class="ogd__card">
          <header><b>{{ dressTotal }}</b><span>выбрали образ на Огонёк</span></header>
          <details v-for="[look, n] in dresscodeRows" :key="look">
            <summary>{{ look }} <i>· {{ n }}</i></summary>
            <PeopleList :people="lists.dresscode[look] ?? []" />
          </details>
        </article>

        <article class="ogd__card ogd__card--wide">
          <header><b>{{ s.toys }}</b><span>игрушек на ёлке желаний</span></header>
          <details v-if="lists.toys.length">
            <summary>Пожелания</summary>
            <ul class="ogd__wishes">
              <li v-for="(t, i) in lists.toys" :key="i">«{{ t.wish }}» <i>— {{ t.name }}</i></li>
            </ul>
          </details>
        </article>

        <article class="ogd__card">
          <header><b>{{ s.snowflakes }}</b><span>снежинок в метели</span></header>
        </article>
        <article class="ogd__card">
          <header><b>{{ s.thanks }}</b><span>открыток «спасибо»</span></header>
          <p class="ogd__sub">анонимные: кто отправил, не храним в отчёте</p>
        </article>
        <article class="ogd__card">
          <header><b>{{ s.letters }}</b><span>писем себе</span></header>
          <p class="ogd__sub">запечатаны до 30 июня</p>
        </article>
      </section>

      <!-- Воронка по окнам -->
      <section class="ogd__block">
        <h2 class="ogd__h2">По окнам</h2>
        <table class="ogd__table ogd__days">
          <thead>
            <tr><th>Окно</th><th>Открыли</th><th>Выполнили</th></tr>
          </thead>
          <tbody>
            <tr v-for="d in byDay" :key="d.id" :class="{ 'is-today': d.id === s.todayId }">
              <td>{{ d.id }}. {{ d.title }}</td>
              <td>{{ d.opened }}</td>
              <td>{{ d.done }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>

    <section class="ogd__block">
      <h2 class="ogd__h2">Все сотрудники</h2>
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
    </section>
  </div>
</template>

<script setup lang="ts">
/**
 * Статистика «Огонька 2027» для админа — по образцу статистики гонки
 * Pit Stop: охват, звания, карточки по окнам со списками, воронка и все
 * сотрудники. Подробности Тайного Санты — на /admin/ogonek-santa.
 */
import type { PropType } from 'vue';
import { ogonekRankArt } from '~/events/ogonek/rankArt';

type Person = { name: string; department: string };

const PeopleList = defineComponent({
  props: { people: { type: Array as PropType<Person[]>, required: true } },
  setup(props) {
    return () =>
      h(
        'ul',
        { class: 'ogd__people' },
        props.people.map((p) => h('li', [p.name, p.department ? h('i', ` · ${p.department}`) : null]))
      );
  }
});

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

type Lists = {
  plugged: Person[];
  hats: Person[];
  skating: Person[];
  santaClassic: Person[];
  santaElephant: Person[];
  dresscode: Record<string, Person[]>;
  recipes: { title: string; text: string; name: string; department: string; votes: number }[];
  toys: { name: string; department: string; wish: string }[];
};

const SANTA_LABEL: Record<string, string> = { classic: 'классика', elephant: 'слон' };
const COLS = 3;

const rows = ref<Row[]>([]);
const s = ref<Summary | null>(null);
const byDay = ref<{ id: number; title: string; opened: number; done: number }[]>([]);
const dresscode = ref<Record<string, number>>({});
const ranks = ref<{ title: string; from: number; count: number }[]>([]);
const lists = ref<Lists>({ plugged: [], hats: [], skating: [], santaClassic: [], santaElephant: [], dresscode: {}, recipes: [], toys: [] });
const error = ref('');
const loading = ref(false);

const dresscodeRows = computed(() => Object.entries(dresscode.value).sort((a, b) => b[1] - a[1]));
const dressTotal = computed(() => dresscodeRows.value.reduce((n, [, c]) => n + c, 0));

function votesWord(n: number) {
  const d = n % 10;
  const dd = n % 100;
  if (d === 1 && dd !== 11) return 'голос';
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return 'голоса';
  return 'голосов';
}

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
      ranks: typeof ranks.value;
      lists: Lists;
      rows: Row[];
    }>('/api/admin/ogonek-dashboard');
    s.value = data.summary;
    byDay.value = data.byDay;
    dresscode.value = data.dresscode;
    ranks.value = data.ranks;
    lists.value = data.lists;
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
  padding: 8px 12px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.ogd__toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
.ogd__h1 { margin: 0; font-size: 1.1rem; }
.ogd__actions { display: flex; gap: 8px; }
.ogd__btn { padding: 4px 12px; font-size: 0.8rem; text-decoration: none; }

.ogd__kpis {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}
.ogd__kpis li,
.ogd__card {
  border: 2px solid var(--border-brutal);
  border-radius: 14px;
  background: var(--bg-surface);
  padding: 10px 12px;
}
.ogd__kpis li { display: flex; flex-direction: column; gap: 2px; }
.ogd__kpis b { font-size: 1.8rem; line-height: 1.1; font-variant-numeric: tabular-nums; }
.ogd__kpis span { font-size: 0.8rem; color: var(--text-muted); }
.ogd__kpis i, .ogd__card i, .ogd__ranks i { font-style: normal; color: var(--text-soft); }

.ogd__block { display: flex; flex-direction: column; gap: 8px; }
.ogd__h2 { margin: 0; font-size: 0.95rem; }

.ogd__ranks {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 8px;
}
.ogd__ranks li {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  text-align: center;
  padding: 8px 6px;
  border: 2px solid var(--border-brutal);
  border-radius: 14px;
  background: var(--bg-surface);
  font-size: 0.72rem;
}
.ogd__ranks b { font-size: 1.3rem; font-variant-numeric: tabular-nums; }

.ogd__cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  align-items: start;
}
.ogd__card { display: flex; flex-direction: column; gap: 6px; font-size: 0.8rem; }
.ogd__card--wide { grid-column: span 2; }
.ogd__card header { display: flex; align-items: baseline; gap: 8px; }
.ogd__card header b { font-size: 1.5rem; font-variant-numeric: tabular-nums; }
.ogd__card header span { color: var(--text-muted); }
.ogd__sub { margin: 0; color: var(--text-soft); }
.ogd__card details summary { cursor: pointer; font-weight: 600; padding: 2px 0; }
.ogd__text { margin: 4px 0 6px; white-space: pre-line; color: var(--text-muted); }
.ogd__more { font-weight: 600; color: var(--primary); text-decoration: none; }
.ogd__wishes { margin: 4px 0 0; padding-left: 18px; display: flex; flex-direction: column; gap: 3px; }
.ogd :deep(.ogd__people) { margin: 4px 0 0; padding-left: 18px; columns: 2; column-gap: 16px; }
.ogd :deep(.ogd__people i) { font-style: normal; color: var(--text-soft); }

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
.ogd__table td { padding: 3px 6px; border-bottom: 1px solid #e4e4de; text-align: left; }
.ogd__table th { font-weight: 700; background: var(--bg-soft); }
.ogd__table td:not(:first-child),
.ogd__table th:not(:first-child) { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.ogd__table tr.is-idle td { color: var(--text-soft); }
.ogd__table tr.is-today td { font-weight: 700; background: var(--accent-lime-soft); }

@media (max-width: 1100px) {
  .ogd__kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .ogd__ranks { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .ogd__cards, .ogd__cols { grid-template-columns: 1fr; }
  .ogd__card--wide { grid-column: auto; }
}
</style>
