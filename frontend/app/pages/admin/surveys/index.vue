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
              <NuxtLink class="button ghost" :to="`/admin/surveys/${s.id}`">Редактировать</NuxtLink>
              <NuxtLink class="button ghost" :to="`/admin/surveys/${s.id}/results`">Результаты</NuxtLink>
              <button
                v-if="s.status !== 'published'"
                class="button ghost"
                type="button"
                @click="onPublish(s)"
              >
                Опубликовать
              </button>
              <button v-else class="button ghost" type="button" @click="onUnpublish(s)">
                Остановить
              </button>
              <button class="button ghost surveys-admin__delete" type="button" @click="onDelete(s)">
                Удалить
              </button>
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
</script>

<style scoped>
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
  font-weight: 700;
  color: var(--text);
}

.surveys-admin__anon-pill {
  margin-left: 8px;
  font-size: 0.68rem;
  padding: 2px 8px;
}

.surveys-admin__status--draft {
  background: var(--bg-elevated);
}

.surveys-admin__status--published {
  background: var(--accent-lime);
}

.surveys-admin__status--closed {
  background: var(--bg-elevated);
  opacity: 0.7;
}

.surveys-admin__actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.surveys-admin__delete:hover {
  background: #fd81ff;
}
</style>
