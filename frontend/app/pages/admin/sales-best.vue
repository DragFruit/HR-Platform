<template>
  <section class="card section-card">
    <div class="section-head row">
      <div>
        <h2 class="section-title">Лучший специалист продаж</h2>
        <p class="muted">
          Раз в месяц (уведомление 29-го) выберите, кто выше всех перевыполнил план в ОП.
          Ачивка у победителя появится только в первый рабочий день следующего месяца — до этого интрига.
          Можно перевыбрать до reveal.
        </p>
      </div>
    </div>

    <form class="profile-activity-admin-form" @submit.prevent="submit">
      <label class="adaptation-assign-form__field">
        <span>Месяц (период)</span>
        <input v-model="period" class="table-input" type="month" required />
      </label>
      <label class="adaptation-assign-form__field">
        <span>Сотрудник ОП</span>
        <select v-model="employeeId" class="table-input" required>
          <option disabled value="">Выберите</option>
          <option v-for="emp in salesEmployees" :key="emp.id" :value="String(emp.id)">
            {{ emp.name }}
          </option>
        </select>
      </label>
      <button type="submit" class="button primary" :disabled="saving">
        {{ saving ? 'Сохранение…' : current ? 'Перевыбрать' : 'Зафиксировать лучшего' }}
      </button>
    </form>

    <p v-if="formError" class="gift-error">{{ formError }}</p>
    <p v-if="formOk" class="soft">{{ formOk }}</p>

    <div v-if="meta" class="soft" style="margin-top: 12px">
      <p>
        Период: <strong>{{ meta.period_label }}</strong>
        · ачивка откроется с <strong>{{ meta.reveal_on }}</strong>
      </p>
      <p v-if="current">
        Сейчас выбран: <strong>{{ current.employee_name }}</strong>
        ({{ formatDate(current.selected_at) }})
      </p>
      <p v-else class="muted">За этот месяц ещё никто не выбран.</p>
    </div>

    <div class="inline-controls" style="margin-top: 16px">
      <button type="button" class="button ghost" @click="reload">Обновить</button>
      <button type="button" class="button ghost" :disabled="testingNotify" @click="sendTestNotify">
        {{ testingNotify ? 'Отправка…' : 'Тест: уведомление как 29-го' }}
      </button>
    </div>

    <h3 class="section-title" style="margin-top: 24px">История</h3>
    <ul class="list-reset profile-activity-admin-list">
      <li v-for="row in awards" :key="row.id" class="profile-activity-admin-list__row">
        <div>
          <strong>{{ row.employee_name }}</strong>
          <span class="muted"> · {{ row.period }}</span>
          <p class="soft">
            reveal {{ row.reveal_on }}
            <template v-if="row.reveal_on > todayIso"> · ещё скрыто</template>
            <template v-else> · видно в профиле</template>
          </p>
        </div>
      </li>
      <li v-if="!awards.length" class="muted">Пока нет выборов.</li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { normalizeDepartment } from '~/data/departments';
import { todayIso } from '~/utils/vacationCalendar';

type Award = {
  id: string;
  period: string;
  employee_id: number;
  employee_name: string;
  selected_at: string;
  reveal_on: string;
};

const route = useRoute();
const { employees, hydrate: hydrateEmployees } = useEmployees();

const period = ref('');
const employeeId = ref('');
const saving = ref(false);
const testingNotify = ref(false);
const formError = ref('');
const formOk = ref('');
const meta = ref<{ period_label: string; reveal_on: string } | null>(null);
const current = ref<Award | null>(null);
const awards = ref<Award[]>([]);

const salesEmployees = computed(() =>
  employees.value
    .filter((e) => {
      const d = normalizeDepartment(String(e.department || ''));
      return d === 'Отдел продаж' || /продаж/i.test(String(e.department || ''));
    })
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
);

const formatDate = (iso: string) => {
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const defaultPeriod = () => {
  const q = String(route.query.period || '').trim();
  if (/^\d{4}-\d{2}$/.test(q)) return q;
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const reload = async () => {
  formError.value = '';
  const data = await $fetch<{
    period: string;
    period_label: string;
    reveal_on: string;
    current: Award | null;
    awards: Award[];
  }>('/api/admin/sales-best', { query: { period: period.value } });
  meta.value = { period_label: data.period_label, reveal_on: data.reveal_on };
  current.value = data.current;
  awards.value = data.awards || [];
  if (data.current) employeeId.value = String(data.current.employee_id);
};

const submit = async () => {
  saving.value = true;
  formError.value = '';
  formOk.value = '';
  try {
    const res = await $fetch<{ ok: boolean; message: string }>('/api/admin/sales-best', {
      method: 'POST',
      body: { period: period.value, employee_id: Number(employeeId.value) }
    });
    formOk.value = res.message;
    await reload();
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; message?: string };
    formError.value = err.data?.statusMessage || err.message || 'Ошибка сохранения';
  } finally {
    saving.value = false;
  }
};

const sendTestNotify = async () => {
  testingNotify.value = true;
  formError.value = '';
  try {
    await $fetch('/api/admin/sales-best/notify-test', {
      method: 'POST',
      body: { period: period.value }
    });
    formOk.value = 'Тестовое уведомление отправлено в колокольчик админа (как 29-е число).';
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; message?: string };
    formError.value = err.data?.statusMessage || err.message || 'Не удалось отправить';
  } finally {
    testingNotify.value = false;
  }
};

onMounted(async () => {
  period.value = defaultPeriod();
  await hydrateEmployees();
  await reload();
});

watch(period, () => {
  void reload();
});
</script>
