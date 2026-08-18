<template>
  <section class="card section-card">
    <div class="section-head row">
      <div>
        <h2 class="section-title">База знаний</h2>
        <p class="muted">
          Редактор контента для теста шаблонов статей и RAG-структуры. Здесь только CRUD по статьям, без поиска.
        </p>
      </div>
      <NuxtLink to="/knowledge" class="button ghost">Открыть пользовательский раздел</NuxtLink>
    </div>
  </section>

  <section class="card section-card">
    <div class="section-head row">
      <h3 class="section-title">{{ editingId ? 'Редактирование статьи' : 'Новая статья' }}</h3>
      <button
        v-if="editingId"
        type="button"
        class="button ghost"
        @click="resetForm"
      >
        Сбросить
      </button>
    </div>

    <form class="ideas-create-form" @submit.prevent="saveArticle">
      <label class="ideas-create-field">
        <span>Заголовок</span>
        <input v-model.trim="form.title" type="text" maxlength="140" required />
      </label>

      <label class="ideas-create-field">
        <span>Кратко (summary)</span>
        <textarea
          v-model.trim="form.summary"
          rows="2"
          maxlength="320"
          placeholder="Короткое резюме статьи"
        />
      </label>

      <label class="ideas-create-field">
        <span>Теги (через запятую)</span>
        <input
          v-model.trim="tagsDraft"
          type="text"
          maxlength="300"
          placeholder="например: Bitrix, Отпуска, HR"
        />
      </label>

      <label class="ideas-create-field">
        <span>Статус</span>
        <select v-model="form.status">
          <option value="draft">Черновик</option>
          <option value="published">Опубликовано</option>
        </select>
      </label>

      <label class="ideas-create-field">
        <span>Текст статьи</span>
        <div class="kb-editor-tools" role="group" aria-label="Инструменты редактора">
          <button type="button" class="button ghost" @click="insertSnippet('h2')">H2</button>
          <button type="button" class="button ghost" @click="insertSnippet('bold')">Жирный</button>
          <button type="button" class="button ghost" @click="insertSnippet('list')">Список</button>
          <button type="button" class="button ghost" @click="insertSnippet('link')">Ссылка</button>
          <button type="button" class="button ghost" @click="insertSnippet('note')">Заметка</button>
        </div>
        <textarea
          ref="bodyRef"
          v-model="form.body"
          rows="14"
          required
          placeholder="Пишите статью в Markdown: заголовки, списки, ссылки."
        />
      </label>

      <p v-if="errorText" class="gift-error">{{ errorText }}</p>
      <p v-if="okText" class="success-note">{{ okText }}</p>

      <div class="row gap-8">
        <button type="submit" class="button primary" :disabled="saving">
          {{ editingId ? 'Сохранить изменения' : 'Создать статью' }}
        </button>
        <button v-if="editingId" type="button" class="button ghost" :disabled="saving" @click="resetForm">
          Отмена
        </button>
      </div>
    </form>
  </section>

  <section class="card section-card">
    <div class="section-head row">
      <h3 class="section-title">Статьи ({{ articles.length }})</h3>
    </div>

    <p v-if="!articles.length" class="muted state-box compact-state">Пока нет статей. Создай первую черновую запись.</p>

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

const bodyRef = ref<HTMLTextAreaElement | null>(null);
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
  nextTick(() => bodyRef.value?.focus());
};

const saveArticle = async () => {
  saving.value = true;
  errorText.value = '';
  okText.value = '';
  try {
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

type SnippetType = 'h2' | 'bold' | 'list' | 'link' | 'note';

const snippets: Record<SnippetType, string> = {
  h2: '\n## Новый раздел\n',
  bold: '**ключевая мысль**',
  list: '\n- Пункт 1\n- Пункт 2\n',
  link: '[Текст ссылки](https://)',
  note: '\n> Важно: добавь пояснение для команды.\n'
};

const insertSnippet = (type: SnippetType) => {
  const field = bodyRef.value;
  const snippet = snippets[type];
  if (!field) {
    form.body = `${form.body}${snippet}`;
    return;
  }

  const start = field.selectionStart ?? form.body.length;
  const end = field.selectionEnd ?? form.body.length;
  form.body = `${form.body.slice(0, start)}${snippet}${form.body.slice(end)}`;
  nextTick(() => {
    const cursor = start + snippet.length;
    field.focus();
    field.setSelectionRange(cursor, cursor);
  });
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
