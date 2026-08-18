<template>
  <div class="kb-admin-page">
    <section class="card section-card kb-editor">
      <form class="kb-editor__form" @submit.prevent="saveArticle">
        <div class="kb-editor__top">
          <span v-if="editingId" class="kb-editor__pill" :data-status="form.status">
            {{ statusLabel(form.status) }}
          </span>
          <p v-else class="kb-editor__hint">После сохранения статья уйдёт руководителю на проверку</p>
          <div class="kb-editor__actions">
            <button v-if="editingId" type="button" class="button ghost" :disabled="saving" @click="resetForm">
              Новая
            </button>
            <button type="submit" class="button primary" :disabled="saving">
              {{ saving ? 'Сохраняю…' : 'Сохранить' }}
            </button>
          </div>
        </div>

        <KnowledgeWysiwygEditor :key="editingId || 'new'" v-model="form.body" @ready="onEditorReady">
          <input
            v-model="form.title"
            class="kb-editor__title"
            type="text"
            maxlength="140"
            required
            placeholder="Заголовок"
            aria-label="Заголовок"
          />
          <textarea
            ref="leadRef"
            v-model="form.summary"
            class="kb-editor__lead"
            rows="1"
            maxlength="320"
            placeholder="Вводный абзац"
            aria-label="Вводный абзац"
          />
        </KnowledgeWysiwygEditor>

        <p v-if="errorText" class="gift-error">{{ errorText }}</p>
        <p v-if="okText" class="success-note">{{ okText }}</p>
      </form>
    </section>

    <section class="card section-card kb-editor-list">
      <div class="section-head row">
        <h3 class="section-title">Статьи ({{ articles.length }})</h3>
      </div>

      <p v-if="loadError" class="gift-error">{{ loadError }}</p>
      <p v-else-if="!hydrated" class="muted state-box compact-state">Загружаю статьи…</p>
      <p v-else-if="!articles.length" class="muted state-box compact-state">Пока нет статей. Напиши первую выше.</p>

      <ul v-else class="kb-queue">
        <li
          v-for="article in articles"
          :key="article.id"
          class="kb-queue__item"
          :class="{ 'is-editing': article.id === editingId }"
        >
          <div class="kb-queue__main">
            <div class="kb-queue__meta">
              <span class="kb-editor__pill" :data-status="article.status">{{ statusLabel(article.status) }}</span>
              <span class="kb-queue__date">{{ formatDateTime(article.updatedAt) }}</span>
            </div>
            <h3 class="kb-queue__title">{{ article.title }}</h3>
            <p v-if="article.summary" class="kb-queue__text muted">{{ article.summary }}</p>
            <p class="soft">Автор: {{ article.authorName }}</p>
          </div>

          <div class="kb-queue__actions">
            <button
              v-if="article.status === 'review'"
              type="button"
              class="button primary"
              :disabled="publishingId === article.id"
              @click="publishArticle(article)"
            >
              {{ publishingId === article.id ? 'Публикую…' : 'Опубликовать' }}
            </button>
            <button type="button" class="button ghost" @click="startEdit(article)">
              {{ article.id === editingId ? 'В работе' : 'Редактировать' }}
            </button>
            <button type="button" class="button ghost ideas-bank-delete" @click="removeArticle(article.id)">
              Удалить
            </button>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { AdminKnowledgeArticle, AdminKnowledgeArticleStatus } from '~/composables/useAdminKnowledge';

const { articles, hydrated, hydrate, createArticle, updateArticle, deleteArticle, statusLabel } =
  useAdminKnowledge();

const editingId = ref<string | null>(null);
const saving = ref(false);
const publishingId = ref<string | null>(null);
const errorText = ref('');
const okText = ref('');
const loadError = ref('');
const leadRef = ref<HTMLTextAreaElement | null>(null);
let savedSnapshot = '';

const form = reactive<{
  title: string;
  summary: string;
  body: string;
  status: AdminKnowledgeArticleStatus;
  tags: string[];
}>({
  title: '',
  summary: '',
  body: '',
  status: 'review',
  tags: []
});

const bodyPlainText = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const sanitizeBody = (html: string) => {
  if (typeof document === 'undefined') return html;
  const box = document.createElement('div');
  box.innerHTML = html;
  box.querySelectorAll('.kb-spoiler.is-open').forEach((el) => el.classList.remove('is-open'));
  box.querySelectorAll('[contenteditable]').forEach((el) => el.removeAttribute('contenteditable'));
  box.querySelectorAll('script, style, iframe').forEach((el) => el.remove());
  return box.innerHTML.trim();
};

const formSnapshot = () =>
  JSON.stringify({
    title: form.title,
    summary: form.summary,
    body: form.body
  });

const markClean = () => {
  savedSnapshot = formSnapshot();
};

const isDirty = () => formSnapshot() !== savedSnapshot;

const confirmDiscard = () => {
  if (!isDirty()) return true;
  return confirm('Есть несохранённые изменения. Сбросить?');
};

const apiErrorMessage = (error: unknown, fallback: string) => {
  if (!error || typeof error !== 'object') return fallback;
  const err = error as {
    data?: { statusMessage?: string; message?: string };
    statusMessage?: string;
    message?: string;
  };
  return err.data?.statusMessage || err.statusMessage || err.data?.message || err.message || fallback;
};

const resizeLead = () => {
  const el = leadRef.value;
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${Math.max(el.scrollHeight, 36)}px`;
};

const blankForm = () => {
  editingId.value = null;
  form.title = '';
  form.summary = '';
  form.body = '';
  form.status = 'review';
  form.tags = [];
};

const resetForm = () => {
  if (!confirmDiscard()) return;
  blankForm();
  errorText.value = '';
  okText.value = '';
  markClean();
  nextTick(resizeLead);
};

const fillForm = (article: AdminKnowledgeArticle) => {
  editingId.value = article.id;
  form.title = article.title;
  form.summary = article.summary;
  form.body = article.body;
  form.status = article.status;
  form.tags = [...article.tags];
  errorText.value = '';
  nextTick(resizeLead);
};

const startEdit = (article: AdminKnowledgeArticle) => {
  if (article.id === editingId.value) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  if (!confirmDiscard()) return;
  okText.value = '';
  fillForm(article);
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const onEditorReady = () => {
  markClean();
  nextTick(resizeLead);
};

const articlePayload = (status: AdminKnowledgeArticleStatus) => ({
  title: form.title.trim(),
  summary: form.summary.trim(),
  body: sanitizeBody(form.body),
  tags: form.tags,
  status
});

const saveArticle = async () => {
  saving.value = true;
  errorText.value = '';
  okText.value = '';
  try {
    const title = form.title.trim();
    if (title.length < 3) {
      errorText.value = 'Заголовок: минимум 3 символа';
      return;
    }
    const body = sanitizeBody(form.body);
    if (bodyPlainText(body).length < 20) {
      errorText.value = 'Текст статьи: минимум 20 символов';
      return;
    }
    const payload = articlePayload('review');
    if (editingId.value) {
      const article = await updateArticle(editingId.value, payload);
      fillForm(article);
      okText.value = 'Сохранено, на проверке';
    } else {
      const article = await createArticle(payload);
      fillForm(article);
      okText.value = 'Отправлено на проверку';
    }
    nextTick(markClean);
  } catch (error: unknown) {
    errorText.value = apiErrorMessage(error, 'Не удалось сохранить статью');
  } finally {
    saving.value = false;
  }
};

const publishArticle = async (article: AdminKnowledgeArticle) => {
  publishingId.value = article.id;
  errorText.value = '';
  okText.value = '';
  try {
    const updated = await updateArticle(article.id, {
      title: article.title,
      summary: article.summary,
      body: article.body,
      tags: article.tags,
      status: 'published'
    });
    if (editingId.value === article.id) fillForm(updated);
    okText.value = 'Статья опубликована';
  } catch (error: unknown) {
    errorText.value = apiErrorMessage(error, 'Не удалось опубликовать статью');
  } finally {
    publishingId.value = null;
  }
};

const removeArticle = async (id: string) => {
  if (!confirm('Удалить статью? Это действие нельзя отменить.')) return;
  errorText.value = '';
  okText.value = '';
  try {
    await deleteArticle(id);
    if (editingId.value === id) {
      blankForm();
      markClean();
      nextTick(resizeLead);
    }
    okText.value = 'Статья удалена';
  } catch (error: unknown) {
    errorText.value = apiErrorMessage(error, 'Не удалось удалить статью');
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

watch(
  () => form.summary,
  () => nextTick(resizeLead)
);

onMounted(() => {
  void hydrate()
    .catch((error: unknown) => {
      loadError.value = apiErrorMessage(error, 'Не удалось загрузить статьи');
    })
    .finally(() => {
      markClean();
      nextTick(resizeLead);
    });
});
</script>
