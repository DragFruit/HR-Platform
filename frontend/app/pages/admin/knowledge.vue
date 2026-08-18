<template>
  <section class="card section-card kb-habr">
    <form class="kb-habr__form" @submit.prevent="saveArticle">
      <div class="kb-habr__meta">
        <select v-model="form.status" class="kb-habr__status" aria-label="Статус">
          <option value="draft">Черновик</option>
          <option value="published">Опубликовано</option>
        </select>
        <input
          v-model.trim="tagsDraft"
          class="kb-habr__tags"
          type="text"
          maxlength="300"
          placeholder="Теги через запятую"
          aria-label="Теги"
        />
        <div class="kb-habr__actions">
          <button v-if="editingId" type="button" class="button ghost" :disabled="saving" @click="resetForm">
            Отмена
          </button>
          <button type="submit" class="button primary" :disabled="saving">
            {{ editingId ? 'Сохранить' : 'Сохранить статью' }}
          </button>
        </div>
      </div>

      <input
        v-model.trim="form.title"
        class="kb-habr__title"
        type="text"
        maxlength="140"
        required
        placeholder="Заголовок"
        aria-label="Заголовок"
      />

      <textarea
        v-model.trim="form.summary"
        class="kb-habr__lead"
        rows="2"
        maxlength="320"
        placeholder="Вводный абзац"
        aria-label="Вводный абзац"
      />

      <KnowledgeWysiwygEditor :key="editingId || 'new'" v-model="form.body" />

      <p v-if="errorText" class="gift-error">{{ errorText }}</p>
      <p v-if="okText" class="success-note">{{ okText }}</p>
    </form>
  </section>

  <section class="card section-card">
    <div class="section-head row">
      <h3 class="section-title">Статьи ({{ articles.length }})</h3>
    </div>

    <p v-if="!articles.length" class="muted state-box compact-state">Пока нет статей. Напиши первую выше.</p>

    <ul v-else class="ideas-bank-list">
      <li v-for="article in articles" :key="article.id" class="ideas-bank-card ideas-bank-card--admin">
        <div class="ideas-bank-card__main">
          <div class="ideas-bank-card__tags">
            <span class="ideas-chip ideas-chip--accent">{{ statusLabel(article.status) }}</span>
            <span class="ideas-chip">{{ formatDateTime(article.updatedAt) }}</span>
            <span v-for="tag in article.tags" :key="`${article.id}-${tag}`" class="ideas-chip">{{ tag }}</span>
          </div>
          <h3 class="ideas-bank-card__title">{{ article.title }}</h3>
          <p v-if="article.summary" class="ideas-bank-card__text muted">{{ article.summary }}</p>
          <p class="soft">Автор: {{ article.authorName }}</p>
        </div>

        <div class="ideas-bank-card__admin-actions">
          <button type="button" class="button ghost" @click="startEdit(article)">Редактировать</button>
          <button type="button" class="button ghost ideas-bank-delete" @click="removeArticle(article.id)">Удалить</button>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import type { AdminKnowledgeArticle, AdminKnowledgeArticleStatus } from '~/composables/useAdminKnowledge';

const { articles, hydrate, createArticle, updateArticle, deleteArticle, statusLabel } = useAdminKnowledge();

const editingId = ref<string | null>(null);
const saving = ref(false);
const errorText = ref('');
const okText = ref('');
const tagsDraft = ref('');

const form = reactive<{
  title: string;
  summary: string;
  body: string;
  status: AdminKnowledgeArticleStatus;
}>({
  title: '',
  summary: '',
  body: '',
  status: 'draft'
});

const parseTags = () =>
  tagsDraft.value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);

const bodyPlainText = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const resetForm = () => {
  editingId.value = null;
  form.title = '';
  form.summary = '';
  form.body = '';
  form.status = 'draft';
  tagsDraft.value = '';
  errorText.value = '';
  okText.value = '';
};

const startEdit = (article: AdminKnowledgeArticle) => {
  editingId.value = article.id;
  form.title = article.title;
  form.summary = article.summary;
  form.body = article.body;
  form.status = article.status;
  tagsDraft.value = article.tags.join(', ');
  errorText.value = '';
  okText.value = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const saveArticle = async () => {
  saving.value = true;
  errorText.value = '';
  okText.value = '';
  try {
    if (bodyPlainText(form.body).length < 20) {
      errorText.value = 'Текст статьи: минимум 20 символов';
      return;
    }
    const payload = {
      title: form.title.trim(),
      summary: form.summary.trim(),
      body: form.body.trim(),
      tags: parseTags(),
      status: form.status
    };
    if (editingId.value) {
      await updateArticle(editingId.value, payload);
      okText.value = 'Статья обновлена';
    } else {
      await createArticle(payload);
      okText.value = 'Статья создана';
    }
    resetForm();
  } catch (error: unknown) {
    const message =
      error && typeof error === 'object' && 'data' in error
        ? String((error as { data?: { statusMessage?: string } }).data?.statusMessage || '')
        : '';
    errorText.value = message || 'Не удалось сохранить статью';
  } finally {
    saving.value = false;
  }
};

const removeArticle = async (id: string) => {
  if (!confirm('Удалить статью? Это действие нельзя отменить.')) return;
  errorText.value = '';
  okText.value = '';
  try {
    await deleteArticle(id);
    if (editingId.value === id) resetForm();
    okText.value = 'Статья удалена';
  } catch (error: unknown) {
    const message =
      error && typeof error === 'object' && 'data' in error
        ? String((error as { data?: { statusMessage?: string } }).data?.statusMessage || '')
        : '';
    errorText.value = message || 'Не удалось удалить статью';
  }
};

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

onMounted(() => {
  void hydrate();
});
</script>
