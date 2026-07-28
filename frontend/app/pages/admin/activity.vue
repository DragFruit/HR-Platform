<template>
  <section class="card section-card">
    <div class="section-head row">
      <div>
        <h2 class="section-title">Недавняя активность</h2>
        <p class="muted">
          Ручные события в профиле: выступления, курсы, повышения, наставник, практика.
          Юбилеи, отпуск, идеи и покупки в магазине подтягиваются сами.
        </p>
      </div>
    </div>

    <form class="profile-activity-admin-form" @submit.prevent="submit">
      <label class="adaptation-assign-form__field">
        <span>Сотрудник</span>
        <select v-model="form.employee_id" class="table-input" required>
          <option disabled value="">Выберите</option>
          <option v-for="emp in employeeOptions" :key="emp.id" :value="String(emp.id)">
            {{ emp.name }}{{ emp.department ? ` · ${emp.department}` : '' }}
          </option>
        </select>
      </label>
      <label class="adaptation-assign-form__field">
        <span>Тип</span>
        <select v-model="form.kind" class="table-input" required>
          <option v-for="kind in kindOptions" :key="kind.id" :value="kind.id">
            {{ kind.label }}
          </option>
        </select>
      </label>
      <label class="adaptation-assign-form__field">
        <span>Дата</span>
        <input v-model="form.occurred_at" class="table-input" type="date" />
      </label>
      <label class="adaptation-assign-form__field profile-activity-admin-form__text">
        <span>Текст</span>
        <input
          v-model="form.text"
          class="table-input"
          required
          minlength="3"
          placeholder="Выступил на конференции…"
        />
      </label>
      <button type="submit" class="button primary" :disabled="saving">
        {{ saving ? 'Сохранение…' : 'Добавить' }}
      </button>
    </form>

    <p v-if="formError" class="gift-error">{{ formError }}</p>
    <p v-if="formOk" class="soft">Запись добавлена — видно в профиле сотрудника.</p>

    <div class="inline-controls" style="margin-top: 16px">
      <button type="button" class="button ghost" @click="reload">Обновить</button>
    </div>

    <p v-if="loading" class="muted">Загрузка…</p>
    <ul v-else class="list-reset profile-activity-admin-list">
      <li v-for="item in serverItems" :key="item.id" class="profile-activity-admin-list__row">
        <div>
          <strong>{{ employeeName(item.employee_id) }}</strong>
          <span class="muted"> · {{ kindLabel[item.kind] || item.kind }}</span>
          <p class="soft">{{ item.text }}</p>
          <p class="muted">
            {{ formatDate(item.occurred_at) }}
            <template v-if="item.source === 'seed'"> · тест</template>
            <template v-else-if="item.source === 'manual'"> · вручную</template>
          </p>
        </div>
        <button
          type="button"
          class="button ghost"
          :disabled="item.source === 'seed' && false"
          @click="remove(item.id)"
        >
          Удалить
        </button>
      </li>
      <li v-if="!serverItems.length" class="muted">Пока нет записей.</li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import type { ProfileActivityKind } from '~/composables/useProfileActivity';

const { employees, hydrate: hydrateEmployees } = useEmployees();
const {
  serverItems,
  kindOptions,
  loading,
  hydrate,
  createManual,
  removeManual,
  kindLabel
} = useProfileActivity();

const saving = ref(false);
const formError = ref('');
const formOk = ref(false);

const form = reactive({
  employee_id: '',
  kind: 'talk' as ProfileActivityKind,
  text: '',
  occurred_at: new Date().toISOString().slice(0, 10)
});

const employeeOptions = computed(() =>
  [...employees.value]
    .filter((e) => e.name.trim())
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
);

const employeeName = (id?: number) =>
  employees.value.find((e) => e.id === id)?.name ?? (id ? `#${id}` : '—');

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('ru-RU');
  } catch {
    return iso;
  }
};

const reload = () => {
  hydrate().catch(() => {});
};

const submit = async () => {
  formError.value = '';
  formOk.value = false;
  saving.value = true;
  try {
    await createManual({
      employee_id: Number(form.employee_id),
      kind: form.kind,
      text: form.text,
      occurred_at: form.occurred_at ? `${form.occurred_at}T12:00:00.000Z` : undefined
    });
    form.text = '';
    formOk.value = true;
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; message?: string };
    formError.value = err.data?.statusMessage ?? err.message ?? 'Не удалось сохранить';
  } finally {
    saving.value = false;
  }
};

const remove = async (id: string) => {
  if (!window.confirm('Удалить запись?')) return;
  try {
    await removeManual(id);
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; message?: string };
    formError.value = err.data?.statusMessage ?? err.message ?? 'Не удалось удалить';
  }
};

onMounted(() => {
  hydrateEmployees().catch(() => {});
  reload();
});
</script>
