<template>
  <div class="surveys-admin">
    <section class="card section-card surveys-admin__hero">
      <div class="section-head surveys-admin__head">
        <div>
          <h2 class="section-title">Опросы</h2>
          <p class="muted">
            Соберите фидбек с помощью опроса. Ссылку можно отправить кому угодно — страница
            респондента не выглядит как часть платформы.
          </p>
        </div>
        <button class="button primary" type="button" :disabled="creating" @click="onCreate">
          {{ creating ? 'Создаём…' : '+ Новый опрос' }}
        </button>
      </div>
    </section>

    <section class="card section-card">
      <div v-if="!hydrated" class="muted">Загрузка…</div>
      <div v-else-if="!surveys.length" class="muted">Опросов пока нет — создайте первый.</div>
      <table v-else class="table surveys-admin__table">
        <thead>
          <tr>
            <th>Название</th>
            <th>Статус</th>
            <th>Ответов</th>
            <th>Создан</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in surveys" :key="s.id">
            <td>
              <NuxtLink :to="`/admin/surveys/${s.id}`" class="surveys-admin__title-link">
                {{ s.title }}
              </NuxtLink>
              <span v-if="s.anonymous" class="pill surveys-admin__anon-pill">анонимный</span>
            </td>
            <td>
              <span class="pill" :class="`surveys-admin__status--${s.status}`">
                {{ statusLabel(s.status) }}
              </span>
            </td>
            <td>{{ s.responseCount }}</td>
            <td>{{ s.createdAt }}</td>
            <td class="surveys-admin__actions">
              <SurveysActionsMenu :items="actionItems(s)" trigger-label="Действия с опросом" @select="(key) => onAction(key, s)" />
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<script setup lang="ts">
import { statusLabel } from '~/composables/useSurveys';
import type { AdminSurveyListItem } from '~/composables/useAdminSurveys';

const { surveys, hydrated, fetchList, createSurvey, publishSurvey, unpublishSurvey, deleteSurvey } =
  useAdminSurveys();
const router = useRouter();
const creating = ref(false);

await fetchList();

const onCreate = async () => {
  creating.value = true;
  const survey = await createSurvey('Новый опрос');
  creating.value = false;
  if (survey) router.push(`/admin/surveys/${survey.id}`);
};

const onPublish = async (s: AdminSurveyListItem) => {
  const res = await publishSurvey(s.id);
  if (!res.ok) {
    window.alert(res.error || 'Не удалось опубликовать');
    return;
  }
  await fetchList();
};

const onUnpublish = async (s: AdminSurveyListItem) => {
  await unpublishSurvey(s.id);
  await fetchList();
};

const onDelete = async (s: AdminSurveyListItem) => {
  if (!window.confirm(`Удалить опрос «${s.title}»? Ответы тоже будут удалены.`)) return;
  await deleteSurvey(s.id);
};

const actionItems = (s: AdminSurveyListItem) => [
  { key: 'edit', label: 'Редактировать' },
  { key: 'results', label: 'Результаты' },
  { key: s.status !== 'published' ? 'publish' : 'unpublish', label: s.status !== 'published' ? 'Опубликовать' : 'Остановить' },
  { key: 'delete', label: 'Удалить', danger: true, dividerBefore: true }
];

const onAction = async (key: string, s: AdminSurveyListItem) => {
  if (key === 'edit') return router.push(`/admin/surveys/${s.id}`);
  if (key === 'results') return router.push(`/admin/surveys/${s.id}/results`);
  if (key === 'publish') return onPublish(s);
  if (key === 'unpublish') return onUnpublish(s);
  if (key === 'delete') return onDelete(s);
};
</script>

<style scoped>
/*
 * Опросы (админка) — осознанное исключение из общего necroбрутализма платформы.
 * По просьбе заказчика визуал этого раздела ближе к референсу webask.io:
 * меньше рамок/теней, спокойная типографика, синий акцент вместо лайм/фиолета.
 * Правки локальные (Vue scoped) — не трогают .card/.button/.pill/.table
 * в остальной платформе. См. docs/CHANGELOG.md.
 */
.surveys-admin {
  --sv-accent: #4f6ef7;
  --sv-accent-hover: #3b5ce0;
  --sv-accent-soft: rgba(79, 110, 247, 0.12);
  --sv-border: #e5e5e8;
  --sv-muted: #6b7280;
  --sv-radius: 14px;
  display: grid;
  gap: 12px;
}

.surveys-admin .card {
  border: 1px solid var(--sv-border);
  border-radius: var(--sv-radius);
  box-shadow: none;
  background: #fff;
}

.surveys-admin .card.section-card {
  padding: 16px 20px;
}

.surveys-admin .card::before {
  display: none;
}

.surveys-admin .section-title {
  font-size: 1.6rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.surveys-admin .muted {
  font-size: 0.92rem;
  color: var(--sv-muted);
}

.surveys-admin .button {
  border-radius: 10px;
  text-transform: none;
  letter-spacing: normal;
  font-size: 0.92rem;
  font-weight: 600;
  padding: 9px 20px;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.surveys-admin .button.primary {
  background: var(--sv-accent);
  border-color: var(--sv-accent);
}

.surveys-admin .button.primary:hover {
  background: var(--sv-accent-hover);
  border-color: var(--sv-accent-hover);
  transform: none;
}

.surveys-admin .button.ghost {
  border: 1px solid var(--sv-border);
  color: var(--text);
}

.surveys-admin .button.ghost:hover {
  background: #f7f7f8;
  border-color: var(--sv-border);
  color: var(--text);
  transform: none;
}

.surveys-admin .pill {
  border: none;
  font-weight: 600;
  font-size: 0.76rem;
  text-transform: none;
  background: #eceef2;
  color: var(--sv-muted);
}

.surveys-admin .table th,
.surveys-admin .table td {
  border-bottom: 1px solid var(--sv-border);
  font-size: 0.9rem;
}

.surveys-admin .table th {
  text-transform: none;
  letter-spacing: normal;
  font-size: 0.8rem;
  font-weight: 600;
}

.surveys-admin .table tbody tr:hover td {
  background: #f7f7f8;
}

.surveys-admin__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.surveys-admin__table {
  margin-top: 4px;
}

.surveys-admin__title-link {
  font-weight: 600;
  font-size: 0.98rem;
  color: var(--text);
}

.surveys-admin__anon-pill {
  margin-left: 8px;
  font-size: 0.68rem;
  padding: 2px 8px;
}

.surveys-admin__status--draft {
  background: #eceef2;
}

.surveys-admin__status--published {
  background: var(--sv-accent-soft);
  color: var(--sv-accent);
}

.surveys-admin__status--closed {
  background: #eceef2;
  opacity: 0.7;
}

.surveys-admin .table th:last-child,
.surveys-admin .table td:last-child {
  width: 44px;
}

.surveys-admin__actions {
  display: flex;
  justify-content: flex-end;
}
</style>
