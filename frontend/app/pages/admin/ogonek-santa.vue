<template>
  <div class="ogsa">
    <div class="ogsa__toolbar">
      <h1 class="ogsa__h1">Тайный Санта · «Огонёк 2027»</h1>
      <div class="ogsa__actions">
        <NuxtLink class="button ghost ogsa__btn" to="/admin/ogonek">← Статистика</NuxtLink>
        <button type="button" class="button ghost ogsa__btn" :disabled="loading" @click="load">Обновить</button>
      </div>
    </div>

    <p v-if="error" class="vac-emp-error">{{ error }}</p>

    <template v-if="d">
      <p class="ogsa__status">
        Классика: <b>{{ d.counts.classic }}</b> · Белый слон: <b>{{ d.counts.elephant }}</b> ·
        <template v-if="d.open">регистрация открыта до 11 декабря включительно</template>
        <template v-else-if="d.drawAt">жеребьёвка прошла {{ fmt(d.drawAt) }}</template>
        <template v-else>регистрация закрыта, жеребьёвка пройдёт при первом входе участника на страницу Санты</template>
      </p>

      <!-- Пары классики: кто кому Санта -->
      <section v-if="d.pairs.length" class="ogsa__block">
        <h2 class="ogsa__h2">Классика: кто кому дарит</h2>
        <table class="ogsa__table">
          <thead>
            <tr><th>Санта</th><th>Подопечный</th><th>Вишлист подопечного</th></tr>
          </thead>
          <tbody>
            <tr v-for="(p, i) in d.pairs" :key="i">
              <td>{{ p.santa.name }}<i v-if="p.santa.department"> · {{ p.santa.department }}</i></td>
              <td>{{ p.ward.name }}<i v-if="p.ward.department"> · {{ p.ward.department }}</i></td>
              <td>{{ p.ward.wish || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- Порядок ходов Белого слона -->
      <section v-if="d.order.length" class="ogsa__block">
        <h2 class="ogsa__h2">Белый слон: порядок ходов</h2>
        <ol class="ogsa__order">
          <li v-for="p in d.order" :key="p.n">{{ p.name }}<i v-if="p.department"> · {{ p.department }}</i></li>
        </ol>
      </section>

      <!-- Все участники -->
      <section class="ogsa__block">
        <h2 class="ogsa__h2">Участники</h2>
        <p v-if="!d.participants.length" class="muted">Пока никто не записался.</p>
        <table v-else class="ogsa__table">
          <thead>
            <tr><th>ФИО</th><th>Отдел</th><th>Формат</th><th>Вишлист</th></tr>
          </thead>
          <tbody>
            <tr v-for="p in d.participants" :key="p.userId">
              <td>{{ p.name }}</td>
              <td>{{ p.department || '—' }}</td>
              <td>{{ p.format === 'classic' ? 'Классика' : 'Белый слон' }}</td>
              <td>{{ p.format === 'classic' ? (p.wish || '—') : '' }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * Тайный Санта для админа: участники по форматам и вишлисты, после
 * жеребьёвки — пары «Санта → подопечный» и порядок ходов «Белого слона».
 */
type Who = { name: string; department: string };
type Data = {
  open: boolean;
  until: string;
  counts: { classic: number; elephant: number };
  participants: { userId: number; name: string; department: string; format: 'classic' | 'elephant'; wish: string }[];
  drawAt: string | null;
  pairs: { santa: Who; ward: Who & { wish: string } }[];
  order: ({ n: number } & Who)[];
};

const d = ref<Data | null>(null);
const error = ref('');
const loading = ref(false);

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    d.value = await $fetch<Data>('/api/admin/ogonek-santa');
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Ошибка загрузки';
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.ogsa { box-sizing: border-box; padding: 8px 12px 20px; display: flex; flex-direction: column; gap: 14px; }
.ogsa__toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
.ogsa__h1 { margin: 0; font-size: 1.1rem; }
.ogsa__actions { display: flex; gap: 8px; }
.ogsa__btn { padding: 4px 12px; font-size: 0.8rem; text-decoration: none; }
.ogsa__status { margin: 0; font-size: 0.9rem; }
.ogsa__block { display: flex; flex-direction: column; gap: 8px; }
.ogsa__h2 { margin: 0; font-size: 0.95rem; }
.ogsa__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
  background: var(--bg-surface);
  border: 2px solid var(--border-brutal);
}
.ogsa__table th, .ogsa__table td { padding: 5px 8px; border-bottom: 1px solid #e4e4de; text-align: left; vertical-align: top; }
.ogsa__table th { font-weight: 700; background: var(--bg-soft); }
.ogsa i { font-style: normal; color: var(--text-soft); }
.ogsa__order { margin: 0; padding-left: 26px; columns: 3; column-gap: 24px; font-size: 0.85rem; line-height: 1.6; }

@media (max-width: 900px) {
  .ogsa__order { columns: 1; }
}
</style>
