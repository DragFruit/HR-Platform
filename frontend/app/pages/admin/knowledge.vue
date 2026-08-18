<template>
  <div class="kb-admin-page">
    <section class="card section-card kb-habr">
      <form class="kb-habr__form" @submit.prevent="saveArticle">
        <div class="kb-habr__meta">
          <select v-model="form.status" class="kb-habr__status" aria-label="Статус">
            <option value="draft">Черновик</option>
            <option value="published">Опубликовано</option>
          </select>
          <input
            v-model="tagsDraft"
            class="kb-habr__tags"
            type="text"
            maxlength="300"
            placeholder="Теги через запятую"
            aria-label="Теги"
          />
          <div class="kb-habr__actions">
            <button v-if="editingId" type="button" class="button ghost" :disabled="saving" @click="resetForm">
              Новая
            </button>
            <button type="submit" class="button primary" :disabled="saving">
              {{ saving ? 'Сохраняю…' : 'Сохранить' }}
            </button>
          </div>
        </div>

        <div class="kb-habr__column">
          <input
            v-model="form.title"
            class="kb-habr__title"
            type="text"
            maxlength="140"
            required
            placeholder="Заголовок"
            aria-label="Заголовок"
          />

          <textarea
            ref="leadRef"
            v-model="form.summary"
            class="kb-habr__lead"
            rows="1"
            maxlength="320"
            placeholder="Вводный абзац"
            aria-label="Вводный абзац"
          />
        </div>

        <KnowledgeWysiwygEditor :key="editingId || 'new'" v-model="form.body" @ready="onEditorReady" />

        <p v-if="errorText" class="gift-error">{{ errorText }}</p>
        <p v-if="okText" class="success-note">{{ okText }}</p>
      </form>
    </section>

    <section class="card section-card kb-habr-list">
      <div class="section-head row">
        <h3 class="section-title">Статьи ({{ articles.length }})</h3>
      </div>

      <p v-if="loadError" class="gift-error">{{ loadError }}</p>
      <p v-else-if="!hydrated" class="muted state-box compact-state">Загружаю статьи…</p>
      <p v-else-if="!articles.length" class="muted state-box compact-state">Пока нет статей. Напиши первую выше.</p>

      <ul v-else class="ideas-bank-list">
        <li
          v-for="article in articles"
          :key="article.id"
          class="ideas-bank-card ideas-bank-card--admin"
          :class="{ 'is-editing': article.id === editingId }"
        >
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
            <button type="button" class="button ghost" @click="startEdit(article)">
              {{ article.id === editingId ? 'В работе' : 'Редактировать' }}
            </button>
            <button type="button" class="button ghost ideas-bank-delete" @click="removeArticle(article.id)">Удалить</button>
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
const errorText = ref('');
const okText = ref('');
const loadError = ref('');
const tagsDraft = ref('');
const leadRef = ref<HTMLTextAreaElement | null>(null);
let savedSnapshot = '';

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
    body: form.body,
    status: form.status,
    tags: tagsDraft.value
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

const resetForm = () => {
  if (!confirmDiscard()) return;
  editingId.value = null;
  form.title = '';
  form.summary = '';
  form.body = '';
  form.status = 'draft';
  tagsDraft.value = '';
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
  tagsDraft.value = article.tags.join(', ');
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
    const payload = {
      title,
      summary: form.summary.trim(),
      body,
      tags: parseTags(),
      status: form.status
    };
    const wasNew = !editingId.value;
    if (editingId.value) {
      const article = await updateArticle(editingId.value, payload);
      fillForm(article);
      okText.value = 'Статья обновлена';
    } else {
      const article = await createArticle(payload);
      fillForm(article);
      okText.value = 'Статья создана';
    }
    if (!wasNew) nextTick(markClean);
  } catch (error: unknown) {
    errorText.value = apiErrorMessage(error, 'Не удалось сохранить статью');
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
    if (editingId.value === id) {
      editingId.value = null;
      form.title = '';
      form.summary = '';
      form.body = '';
      form.status = 'draft';
      tagsDraft.value = '';
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
