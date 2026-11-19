<template>
  <div class="ogd">
    <!-- 1. Заголовок: что это и когда обновлено -->
    <header class="ogd-head">
      <div>
        <h1 class="ogd-head__title">Огонёк 2027</h1>
        <p class="ogd-head__sub">
          <template v-if="s?.todayId">Сегодня окно {{ s.todayId }} из 19</template>
          <template v-else>Сегодня окна нет</template>
          <template v-if="updatedAt"> · обновлено {{ updatedAt }}</template>
        </p>
      </div>
      <div class="ogd-head__actions">
        <NuxtLink class="ogd-link" to="/admin/ogonek-santa">Тайный Санта</NuxtLink>
        <button type="button" class="ogd-icon" :disabled="loading" aria-label="Обновить" title="Обновить" @click="load">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 5a7 7 0 0 1 6.32 4H15v2h6V5h-2v2.6A9 9 0 1 0 21 12h-2a7 7 0 1 1-7-7z" /></svg>
        </button>
      </div>
    </header>

    <p v-if="error" class="vac-emp-error">{{ error }}</p>

    <template v-if="s">
      <!-- 2. Главное: охват. Одно акцентное число и прогресс -->
      <section class="ogd-hero">
        <div class="ogd-hero__main">
          <span class="ogd-label">Зашли в ивент</span>
          <p class="ogd-hero__num">
            {{ s.players }}<span> из {{ s.employees }}</span>
          </p>
          <div class="ogd-bar ogd-bar--lg" role="img" :aria-label="`${pct(s.players, s.employees)}% сотрудников`">
            <i :style="{ width: `${pct(s.players, s.employees)}%` }" />
          </div>
          <span class="ogd-hint">{{ pct(s.players, s.employees) }}% сотрудников</span>
        </div>
        <div class="ogd-hero__side">
          <div class="ogd-stat">
            <span class="ogd-label">Открыли сегодня</span>
            <b>{{ s.todayId ? s.openedToday : '—' }}</b>
            <span v-if="s.todayId" class="ogd-hint">{{ pct(s.openedToday, s.players) }}% зашедших</span>
          </div>
          <div class="ogd-stat">
            <span class="ogd-label">Новогодний дизайн</span>
            <b>{{ s.plugged }}</b>
            <span class="ogd-hint">{{ pct(s.plugged, s.players) }}% зашедших</span>
          </div>
        </div>
      </section>

      <!-- 3. Путь по окнам: где люди отваливаются -->
      <section class="ogd-sec">
        <h2 class="ogd-sec__title">По окнам</h2>
        <p class="ogd-sec__lead">Светлая полоса — открыли, тёмная — выполнили действие окна.</p>
        <ol class="ogd-days">
          <li v-for="d in byDay" :key="d.id" :class="{ 'is-today': d.id === s.todayId }">
            <span class="ogd-days__n">{{ d.id }}</span>
            <span class="ogd-days__t">{{ d.title }}</span>
            <span class="ogd-days__bar">
              <i class="is-open" :style="{ width: `${pct(d.opened, maxDay)}%` }" />
              <i class="is-done" :style="{ width: `${pct(d.done, maxDay)}%` }" />
            </span>
            <span class="ogd-days__v">{{ d.opened }} <em>/ {{ d.done }}</em></span>
          </li>
        </ol>
      </section>

      <!-- 4. Звания: одна полоса распределения -->
      <section class="ogd-sec">
        <h2 class="ogd-sec__title">Звания</h2>
        <div class="ogd-ranks">
          <div v-for="r in ranks" :key="r.title" class="ogd-ranks__row">
            <span class="ogd-ranks__t">{{ r.title }}</span>
            <span class="ogd-ranks__bar"><i :style="{ width: `${pct(r.count, maxRank)}%` }" /></span>
            <b>{{ r.count }}</b>
          </div>
        </div>
      </section>

      <!-- 5. Активности: строки «что — сколько — кто» -->
      <section class="ogd-sec">
        <h2 class="ogd-sec__title">Активности</h2>
        <ul class="ogd-acts">
          <li>
            <details>
              <summary>
                <span class="ogd-acts__t">Тайный Санта</span>
                <span class="ogd-acts__meta">классика {{ s.santaClassic }} · Белый слон {{ s.santaElephant }}</span>
                <b>{{ s.santaClassic + s.santaElephant }}</b>
              </summary>
              <div class="ogd-acts__body">
                <p v-if="lists.santaClassic.length" class="ogd-names"><span class="ogd-label">Классика</span>{{ names(lists.santaClassic) }}</p>
                <p v-if="lists.santaElephant.length" class="ogd-names"><span class="ogd-label">Белый слон</span>{{ names(lists.santaElephant) }}</p>
                <NuxtLink class="ogd-link" to="/admin/ogonek-santa">Пары, вишлисты и порядок ходов</NuxtLink>
              </div>
            </details>
          </li>
          <li>
            <details :class="{ 'is-empty': !lists.skating.length }">
              <summary>
                <span class="ogd-acts__t">Каток</span>
                <span class="ogd-acts__meta">записались</span>
                <b>{{ s.skating }}</b>
              </summary>
              <div class="ogd-acts__body"><p class="ogd-names">{{ names(lists.skating) }}</p></div>
            </details>
          </li>
          <li>
            <details :class="{ 'is-empty': !lists.recipes.length }">
              <summary>
                <span class="ogd-acts__t">Рецепты оливье</span>
                <span class="ogd-acts__meta">{{ s.recipeVotes }} {{ votesWord(s.recipeVotes) }}</span>
                <b>{{ s.recipes }}</b>
              </summary>
              <div class="ogd-acts__body">
                <details v-for="r in lists.recipes" :key="r.title + r.name" class="ogd-recipe">
                  <summary>
                    <span>{{ r.title || 'Без названия' }} <em>— {{ r.name }}</em></span>
                    <span class="ogd-recipe__v">{{ r.votes }} {{ votesWord(r.votes) }}</span>
                  </summary>
                  <p>{{ r.text }}</p>
                </details>
              </div>
            </details>
          </li>
          <li>
            <details :class="{ 'is-empty': !lists.plugged.length }">
              <summary>
                <span class="ogd-acts__t">Новогодний дизайн</span>
                <span class="ogd-acts__meta">вилка в розетке</span>
                <b>{{ s.plugged }}</b>
              </summary>
              <div class="ogd-acts__body"><p class="ogd-names">{{ names(lists.plugged) }}</p></div>
            </details>
          </li>
          <li>
            <details :class="{ 'is-empty': !lists.hats.length }">
              <summary>
                <span class="ogd-acts__t">Колпак на аватарке</span>
                <span class="ogd-acts__meta">надели</span>
                <b>{{ s.hats }}</b>
              </summary>
              <div class="ogd-acts__body"><p class="ogd-names">{{ names(lists.hats) }}</p></div>
            </details>
          </li>
          <li class="ogd-acts__plain">
            <span class="ogd-acts__t">Открытки «спасибо»</span>
            <span class="ogd-acts__meta">анонимные, без имён</span>
            <b>{{ s.thanks }}</b>
          </li>
          <li class="ogd-acts__plain">
            <span class="ogd-acts__t">Письма себе</span>
            <span class="ogd-acts__meta">запечатаны до 30 июня</span>
            <b>{{ s.letters }}</b>
          </li>
        </ul>
      </section>
    </template>

    <!-- 6. Сотрудники: одна таблица с поиском, фильтром и сортировкой -->
    <section class="ogd-sec">
      <div class="ogd-sec__row">
        <h2 class="ogd-sec__title">Сотрудники</h2>
        <div class="ogd-filters">
          <input v-model="query" type="search" class="ogd-search" placeholder="Поиск по имени или отделу" aria-label="Поиск сотрудника" />
          <label class="ogd-check"><input v-model="onlyIdle" type="checkbox" /> только не заходили</label>
        </div>
      </div>
      <p v-if="!loading && !rows.length" class="ogd-hint">Нет сотрудников в справочнике</p>
      <div v-else class="ogd-table-wrap">
        <table class="ogd-table">
          <thead>
            <tr>
              <th v-for="c in COLS" :key="c.key" :class="{ 'is-num': c.num }">
                <button type="button" class="ogd-sort" @click="sortBy(c.key)">
                  {{ c.label }}<span v-if="sortKey === c.key">{{ sortDir === 1 ? ' ↑' : ' ↓' }}</span>
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in visibleRows" :key="row.employeeId" :class="{ 'is-idle': !row.entered }">
              <td>{{ row.name }}</td>
              <td class="ogd-table__dep">{{ row.department || '—' }}</td>
              <td class="is-num">{{ row.opened }}</td>
              <td class="is-num">{{ row.done }}</td>
              <td>{{ SANTA_LABEL[row.santa] ?? '' }}</td>
            </tr>
          </tbody>
        </table>
        <p class="ogd-hint">Показано {{ visibleRows.length }} из {{ rows.length }}</p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
/**
 * Статистика «Огонька 2027» для админа. Порядок по важности: охват →
 * сегодня → путь по окнам → звания → активности → сотрудники. Один акцент
 * (главное число), полосы вместо таблиц там, где важна пропорция, без
 * рамок у каждого блока. Подробности Тайного Санты — /admin/ogonek-santa.
 */
type Person = { name: string; department: string };

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
  plugged: number;
  hats: number;
  santaClassic: number;
  santaElephant: number;
  skating: number;
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
  recipes: { title: string; text: string; name: string; department: string; votes: number }[];
};

type SortKey = 'name' | 'department' | 'opened' | 'done' | 'santa';

const SANTA_LABEL: Record<string, string> = { classic: 'классика', elephant: 'Белый слон' };
const COLS: { key: SortKey; label: string; num?: boolean }[] = [
  { key: 'name', label: 'Сотрудник' },
  { key: 'department', label: 'Отдел' },
  { key: 'opened', label: 'Окон', num: true },
  { key: 'done', label: 'Огоньков', num: true },
  { key: 'santa', label: 'Санта' }
];

const rows = ref<Row[]>([]);
const s = ref<Summary | null>(null);
const byDay = ref<{ id: number; title: string; opened: number; done: number }[]>([]);
const ranks = ref<{ title: string; from: number; count: number }[]>([]);
const lists = ref<Lists>({ plugged: [], hats: [], skating: [], santaClassic: [], santaElephant: [], recipes: [] });
const error = ref('');
const loading = ref(false);
const updatedAt = ref('');

const query = ref('');
const onlyIdle = ref(false);
const sortKey = ref<SortKey>('opened');
const sortDir = ref<1 | -1>(-1);

const maxDay = computed(() => Math.max(1, s.value?.players ?? 0, ...byDay.value.map((d) => d.opened)));
const maxRank = computed(() => Math.max(1, ...ranks.value.map((r) => r.count)));

function pct(a: number, b: number) {
  return b > 0 ? Math.round((a / b) * 100) : 0;
}

function names(list: Person[]) {
  return list.map((p) => p.name).join(', ');
}

function votesWord(n: number) {
  const d = n % 10;
  const dd = n % 100;
  if (d === 1 && dd !== 11) return 'голос';
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return 'голоса';
  return 'голосов';
}

function sortBy(key: SortKey) {
  if (sortKey.value === key) sortDir.value = sortDir.value === 1 ? -1 : 1;
  else {
    sortKey.value = key;
    sortDir.value = key === 'opened' || key === 'done' ? -1 : 1;
  }
}

const visibleRows = computed(() => {
  const q = query.value.trim().toLowerCase();
  const k = sortKey.value;
  const dir = sortDir.value;
  return rows.value
    .filter((r) => !onlyIdle.value || !r.entered)
    .filter((r) => !q || r.name.toLowerCase().includes(q) || r.department.toLowerCase().includes(q))
    .sort((a, b) => {
      const av = a[k];
      const bv = b[k];
      const c = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), 'ru');
      return c * dir || a.name.localeCompare(b.name, 'ru');
    });
});

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const data = await $fetch<{
      summary: Summary;
      byDay: typeof byDay.value;
      ranks: typeof ranks.value;
      lists: Lists;
      rows: Row[];
    }>('/api/admin/ogonek-dashboard');
    s.value = data.summary;
    byDay.value = data.byDay;
    ranks.value = data.ranks;
    lists.value = data.lists;
    rows.value = data.rows;
    updatedAt.value = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
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
  --ogd-accent: var(--primary);
  --ogd-line: rgba(32, 32, 32, 0.1);
  --ogd-track: rgba(32, 32, 32, 0.07);
  box-sizing: border-box;
  max-width: 1180px;
  padding: 12px 16px 32px;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

/* Заголовок */
.ogd-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.ogd-head__title { margin: 0; font-family: var(--font-display); font-size: 1.5rem; line-height: 1.2; }
.ogd-head__sub { margin: 4px 0 0; color: var(--text-muted); font-size: 0.9rem; }
.ogd-head__actions { display: flex; align-items: center; gap: 14px; }
.ogd-link { font-weight: 600; color: var(--ogd-accent); text-decoration: none; }
.ogd-link:hover { text-decoration: underline; }
.ogd-icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 50%;
  background: var(--bg-soft);
  color: var(--text);
  cursor: pointer;
}
.ogd-icon:hover { background: var(--primary-soft); color: var(--ogd-accent); }
.ogd-icon:disabled { opacity: 0.5; cursor: progress; }

/* Общие подписи */
.ogd-label { display: block; font-size: 0.75rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--text-soft); }
.ogd-hint { font-size: 0.82rem; color: var(--text-muted); }

/* Главное: охват */
.ogd-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  gap: 24px;
  padding: 22px 24px;
  border-radius: var(--radius-lg);
  background: var(--bg-surface);
}
.ogd-hero__main { display: flex; flex-direction: column; gap: 8px; }
.ogd-hero__num { margin: 0; font-family: var(--font-display); font-size: 3.2rem; line-height: 1; color: var(--ogd-accent); font-variant-numeric: tabular-nums; }
.ogd-hero__num span { font-size: 1.2rem; color: var(--text-muted); }
.ogd-hero__side { display: grid; gap: 16px; align-content: center; padding-left: 24px; border-left: 1px solid var(--ogd-line); }
.ogd-stat { display: flex; flex-direction: column; gap: 2px; }
.ogd-stat b { font-size: 1.8rem; line-height: 1.1; font-variant-numeric: tabular-nums; }

/* Полосы */
.ogd-bar { height: 8px; border-radius: 999px; background: var(--ogd-track); overflow: hidden; }
.ogd-bar--lg { height: 10px; }
.ogd-bar i { display: block; height: 100%; border-radius: inherit; background: var(--ogd-accent); }

/* Разделы */
.ogd-sec { display: flex; flex-direction: column; gap: 10px; }
.ogd-sec__row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.ogd-sec__title { margin: 0; font-size: 1.05rem; }
.ogd-sec__lead { margin: -4px 0 4px; font-size: 0.82rem; color: var(--text-muted); }

/* По окнам */
.ogd-days { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
.ogd-days li {
  display: grid;
  grid-template-columns: 24px minmax(0, 220px) minmax(0, 1fr) 70px;
  align-items: center;
  gap: 12px;
  padding: 5px 8px;
  border-radius: 8px;
  font-size: 0.85rem;
}
.ogd-days li.is-today { background: var(--accent-lime-soft); font-weight: 600; }
.ogd-days__n { color: var(--text-soft); font-variant-numeric: tabular-nums; }
.ogd-days__t { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ogd-days__bar { position: relative; height: 10px; border-radius: 999px; background: var(--ogd-track); overflow: hidden; }
.ogd-days__bar i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: inherit; }
.ogd-days__bar i.is-open { background: color-mix(in srgb, var(--ogd-accent) 30%, transparent); }
.ogd-days__bar i.is-done { background: var(--ogd-accent); }
.ogd-days__v { text-align: right; font-variant-numeric: tabular-nums; }
.ogd-days__v em { font-style: normal; color: var(--text-soft); }

/* Звания */
.ogd-ranks { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 32px; }
.ogd-ranks__row { display: grid; grid-template-columns: 160px minmax(0, 1fr) 40px; align-items: center; gap: 10px; font-size: 0.85rem; }
.ogd-ranks__bar { height: 8px; border-radius: 999px; background: var(--ogd-track); overflow: hidden; }
.ogd-ranks__bar i { display: block; height: 100%; border-radius: inherit; background: var(--accent-teal); }
.ogd-ranks__row b { text-align: right; font-variant-numeric: tabular-nums; }

/* Активности */
.ogd-acts { list-style: none; margin: 0; padding: 0; }
.ogd-acts > li { border-top: 1px solid var(--ogd-line); }
.ogd-acts > li:last-child { border-bottom: 1px solid var(--ogd-line); }
.ogd-acts summary,
.ogd-acts__plain {
  display: grid;
  grid-template-columns: minmax(0, 220px) minmax(0, 1fr) 60px;
  align-items: center;
  gap: 12px;
  padding: 11px 8px;
  font-size: 0.9rem;
}
.ogd-acts summary { cursor: pointer; list-style: none; }
.ogd-acts summary::-webkit-details-marker { display: none; }
.ogd-acts summary:hover { background: var(--bg-soft); }
.ogd-acts details.is-empty summary { cursor: default; }
.ogd-acts__t { font-weight: 600; }
.ogd-acts__t::before { content: '▸ '; color: var(--text-soft); }
.ogd-acts details[open] > summary .ogd-acts__t::before { content: '▾ '; }
.ogd-acts__plain .ogd-acts__t::before,
.ogd-acts details.is-empty .ogd-acts__t::before { content: ''; }
.ogd-acts__meta { color: var(--text-muted); font-size: 0.82rem; }
.ogd-acts summary b,
.ogd-acts__plain b { text-align: right; font-size: 1.1rem; font-variant-numeric: tabular-nums; }
.ogd-acts__body { display: flex; flex-direction: column; gap: 8px; padding: 0 8px 14px 24px; }
.ogd-names { margin: 0; font-size: 0.85rem; line-height: 1.6; color: var(--text-muted); }
.ogd-names .ogd-label { margin-bottom: 2px; }
.ogd-recipe summary { display: flex; justify-content: space-between; gap: 12px; padding: 6px 0; font-size: 0.85rem; grid-template-columns: none; }
.ogd-recipe summary em { font-style: normal; color: var(--text-soft); }
.ogd-recipe__v { color: var(--text-muted); white-space: nowrap; }
.ogd-recipe p { margin: 0 0 8px; white-space: pre-line; font-size: 0.85rem; color: var(--text-muted); }

/* Сотрудники */
.ogd-filters { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.ogd-search {
  width: 260px;
  max-width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--ogd-line);
  border-radius: 10px;
  background: var(--bg-surface);
  font: inherit;
  font-size: 0.85rem;
}
.ogd-check { display: flex; align-items: center; gap: 6px; font-size: 0.85rem; color: var(--text-muted); cursor: pointer; }
.ogd-table-wrap { display: flex; flex-direction: column; gap: 6px; }
.ogd-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; background: var(--bg-surface); border-radius: var(--radius-md); overflow: hidden; }
.ogd-table th { position: sticky; top: 0; background: var(--bg-surface); text-align: left; border-bottom: 1px solid var(--ogd-line); }
.ogd-table td { padding: 7px 12px; border-bottom: 1px solid var(--ogd-line); }
.ogd-table tr:last-child td { border-bottom: 0; }
.ogd-table .is-num { text-align: right; font-variant-numeric: tabular-nums; }
.ogd-table__dep { color: var(--text-muted); }
.ogd-table tr.is-idle td { color: var(--text-soft); }
.ogd-sort {
  width: 100%;
  padding: 9px 12px;
  border: 0;
  background: none;
  font: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-soft);
  text-align: inherit;
  cursor: pointer;
}
.ogd-sort:hover { color: var(--text); }
th.is-num .ogd-sort { text-align: right; }

@media (max-width: 900px) {
  .ogd-hero { grid-template-columns: 1fr; }
  .ogd-hero__side { padding-left: 0; border-left: 0; padding-top: 16px; border-top: 1px solid var(--ogd-line); }
  .ogd-ranks { grid-template-columns: 1fr; }
  .ogd-days li { grid-template-columns: 24px minmax(0, 1fr) 70px; }
  .ogd-days__bar { grid-column: 2 / 4; }
  .ogd-acts summary, .ogd-acts__plain { grid-template-columns: minmax(0, 1fr) auto; }
  .ogd-acts__meta { display: none; }
}
</style>
