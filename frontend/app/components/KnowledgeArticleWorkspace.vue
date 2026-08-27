<template>
  <Teleport to="body">
    <div v-if="open" class="kb-author-layer" role="dialog" aria-modal="true" aria-label="Мои статьи">
      <div class="kb-author-panel">
        <header class="kb-author-panel__head">
          <h2 class="kb-author-panel__title">
            {{ mode === 'review' ? 'Проверка статьи' : 'Статьи в базу знаний' }}
          </h2>
          <button type="button" class="kb-author-panel__close" aria-label="Закрыть" @click="close">
            ×
          </button>
        </header>

        <div class="kb-author-panel__body">
          <!-- Review layout -->
          <div v-if="mode === 'review' && active" class="kb-review">
            <div class="kb-review__main">
              <div class="kb-review__actions">
                <button
                  type="button"
                  class="kb-pill kb-pill--lime"
                  :disabled="busy"
                  @click="doModerate('accept')"
                >
                  Принять
                </button>
                <button
                  type="button"
                  class="kb-pill kb-pill--outline"
                  :disabled="busy"
                  @click="doModerate('revision')"
                >
                  На доработку
                </button>
                <button
                  type="button"
                  class="kb-pill kb-pill--dark"
                  :disabled="busy"
                  @click="rejectOpen = true"
                >
                  Отклонить
                </button>
              </div>

              <h3 class="kb-review__title">{{ reviewFields.title }}</h3>
              <p v-if="reviewFields.summary" class="kb-review__lead muted">{{ reviewFields.summary }}</p>
              <p class="soft">Автор: {{ active.authorName }}</p>

              <KnowledgeWysiwygEditor
                :key="`review-${active.id}`"
                v-model="reviewBody"
                readonly
                enable-comments
                @request-comment="onRequestComment"
              />
            </div>

            <aside class="kb-review__side">
              <h4 class="kb-review__side-title">Комментарии</h4>
              <p v-if="!active.comments?.length" class="muted kb-review__empty">
                Выделите текст → ПКМ «Оставить комментарий» (на телефоне — после выделения кнопка).
              </p>
              <ul v-else class="kb-comments">
                <li v-for="c in active.comments" :key="c.id" class="kb-comments__item">
                  <p v-if="c.quote" class="kb-comments__quote">«{{ c.quote }}»</p>
                  <p class="kb-comments__body">{{ c.body }}</p>
                  <p class="kb-comments__meta soft">{{ c.authorName }} · {{ formatDateTime(c.createdAt) }}</p>
                </li>
              </ul>

              <div v-if="pendingCommentQuote !== null" class="kb-comment-draft">
                <p class="kb-comments__quote">«{{ pendingCommentQuote }}»</p>
                <textarea
                  v-model="pendingCommentBody"
                  class="kb-comment-draft__input"
                  rows="3"
                  maxlength="2000"
                  placeholder="Комментарий к выделенному"
                />
                <div class="kb-comment-draft__actions">
                  <button type="button" class="button ghost" @click="cancelComment">Отмена</button>
                  <button
                    type="button"
                    class="button primary"
                    :disabled="busy || !pendingCommentBody.trim()"
                    @click="saveComment"
                  >
                    Сохранить
                  </button>
                </div>
              </div>
            </aside>
          </div>

          <!-- Edit / create -->
          <template v-else>
            <section class="kb-author-editor card section-card">
              <form class="kb-editor__form" @submit.prevent="saveAndMaybeSubmit">
                <KnowledgeWysiwygEditor
                  :key="editingId || 'new'"
                  v-model="form.body"
                  :readonly="!canEditForm"
                  @ready="onEditorReady"
                >
                  <template #bar-end>
                    <span v-if="editingId && active" class="kb-editor__pill" :data-status="active.status">
                      {{ displayStatusLabel(active) }}
                    </span>
                    <button v-if="editingId" type="button" class="button ghost" :disabled="busy" @click="resetForm">
                      Новая
                    </button>
                    <button
                      v-if="canEditForm"
                      type="button"
                      class="button ghost"
                      :disabled="busy"
                      @click="saveDraft"
                    >
                      {{ busy ? '…' : 'Черновик' }}
                    </button>
                    <button v-if="canEditForm" type="submit" class="button primary" :disabled="busy">
                      {{ busy ? '…' : editingId && active?.status === 'published' ? 'Отправить правку' : 'На проверку' }}
                    </button>
                  </template>
                  <textarea
                    ref="titleRef"
                    v-model="form.title"
                    class="kb-editor__title"
                    rows="1"
                    maxlength="140"
                    required
                    placeholder="Заголовок"
                    :readonly="!canEditForm"
                    aria-label="Заголовок"
                  />
                  <textarea
                    ref="leadRef"
                    v-model="form.summary"
                    class="kb-editor__lead"
                    rows="1"
                    maxlength="320"
                    placeholder="Вводный абзац"
                    :readonly="!canEditForm"
                    aria-label="Вводный абзац"
                  />
                </KnowledgeWysiwygEditor>

                <fieldset class="kb-editor__audience" :disabled="!canEditForm">
                  <legend class="kb-editor__audience-legend">Аудитория</legend>
                  <p class="muted kb-editor__audience-hint">
                    «Вся компания» или отметьте отделы.
                  </p>
                  <div class="kb-editor__audience-chips">
                    <button
                      type="button"
                      class="kb-dept"
                      :class="{ 'is-on': form.departments.length === 0, 'kb-dept--all': form.departments.length === 0 }"
                      @click="form.departments = []"
                    >
                      Вся компания
                    </button>
                    <button
                      v-for="dept in deptOptions"
                      :key="dept"
                      type="button"
                      class="kb-dept"
                      :class="{ 'is-on': form.departments.includes(dept), 'kb-dept--violet': form.departments.includes(dept) }"
                      @click="toggleDept(dept)"
                    >
                      {{ dept }}
                    </button>
                  </div>
                </fieldset>

                <div v-if="active?.comments?.length && (active.status === 'revision_requested' || active.pendingRevision?.status === 'revision_requested')" class="kb-author-comments">
                  <h4>Комментарии руководителя</h4>
                  <ul class="kb-comments">
                    <li v-for="c in active.comments" :key="c.id" class="kb-comments__item">
                      <p v-if="c.quote" class="kb-comments__quote">«{{ c.quote }}»</p>
                      <p class="kb-comments__body">{{ c.body }}</p>
                    </li>
                  </ul>
                </div>

                <p v-if="active?.status === 'rejected'" class="gift-error">
                  Отклонено навсегда.
                  <template v-if="active.rejectionReason"> Причина: {{ active.rejectionReason }}</template>
                </p>
                <p v-if="errorText" class="gift-error">{{ errorText }}</p>
                <p v-if="okText" class="success-note">{{ okText }}</p>
              </form>
            </section>

            <section class="kb-author-list card section-card">
              <div class="section-head row">
                <h3 class="section-title">Мои статьи ({{ own.length }})</h3>
              </div>
              <p v-if="!hydrated" class="muted">Загружаю…</p>
              <p v-else-if="!own.length" class="muted">Пока нет своих статей — напишите первую выше.</p>
              <ul v-else class="kb-queue">
                <li
                  v-for="article in own"
                  :key="article.id"
                  class="kb-queue__item"
                  :class="{ 'is-editing': article.id === editingId }"
                >
                  <div class="kb-queue__main">
                    <div class="kb-queue__meta">
                      <span class="kb-editor__pill" :data-status="article.status">
                        {{ displayStatusLabel(article) }}
                      </span>
                      <span class="kb-queue__date">{{ formatDateTime(article.updatedAt) }}</span>
                    </div>
                    <h3 class="kb-queue__title">{{ article.title }}</h3>
                  </div>
                  <div class="kb-queue__actions">
                    <button
                      type="button"
                      class="button ghost"
                      :disabled="!articleEditable(article) && article.status !== 'pending_review' && article.status !== 'rejected'"
                      @click="startEdit(article)"
                    >
                      {{ articleEditable(article) ? 'Редактировать' : 'Открыть' }}
                    </button>
                  </div>
                </li>
              </ul>

              <template v-if="reports.length || reviewQueue.length">
                <div class="section-head row kb-author-list__reports-head">
                  <h3 class="section-title">Статьи команды ({{ reports.length }})</h3>
                </div>
                <ul class="kb-queue">
                  <li v-for="article in reports" :key="`r-${article.id}`" class="kb-queue__item">
                    <div class="kb-queue__main">
                      <div class="kb-queue__meta">
                        <span class="kb-editor__pill" :data-status="article.status">
                          {{ displayStatusLabel(article) }}
                        </span>
                        <span class="soft">{{ article.authorName }}</span>
                      </div>
                      <h3 class="kb-queue__title">{{ article.title }}</h3>
                    </div>
                    <div class="kb-queue__actions">
                      <button
                        v-if="articleNeedsReview(article)"
                        type="button"
                        class="button primary"
                        @click="startReview(article)"
                      >
                        Проверить
                      </button>
                      <button v-else type="button" class="button ghost" @click="startReview(article)">
                        Открыть
                      </button>
                    </div>
                  </li>
                </ul>
              </template>
            </section>
          </template>
        </div>
      </div>

      <!-- Reject modal -->
      <div v-if="rejectOpen" class="kb-reject-layer" @click.self="rejectOpen = false">
        <div class="kb-reject-modal" role="dialog" aria-modal="true" aria-labelledby="kb-reject-title">
          <h3 id="kb-reject-title" class="kb-reject-modal__title">Отклонить статью</h3>
          <p class="muted">Статья будет закрыта навсегда. Укажите причину — без неё отклонить нельзя.</p>
          <textarea
            v-model="rejectReason"
            class="kb-reject-modal__input"
            rows="4"
            maxlength="1000"
            placeholder="Причина отклонения"
          />
          <div class="kb-reject-modal__actions">
            <button type="button" class="kb-pill kb-pill--outline" @click="rejectOpen = false">Отмена</button>
            <button
              type="button"
              class="kb-pill kb-pill--dark"
              :disabled="busy || rejectReason.trim().length < 3"
              @click="doModerate('reject')"
            >
              Отклонить навсегда
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { KnowledgeAuthorArticle } from '~/composables/useKnowledgeAuthor';
import { articleEditorFields as fieldsOf } from '~/composables/useKnowledgeAuthor';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ 'update:open': [value: boolean] }>();

const {
  own,
  reports,
  reviewQueue,
  hydrated,
  hydrate,
  createArticle,
  updateArticle,
  submitArticle,
  moderateArticle,
  addComment,
  displayStatusLabel,
  articleNeedsReview,
  articleEditable
} = useKnowledgeAuthor();

const mode = ref<'edit' | 'review'>('edit');
const editingId = ref<string | null>(null);
const active = ref<KnowledgeAuthorArticle | null>(null);
const busy = ref(false);
const errorText = ref('');
const okText = ref('');
const rejectOpen = ref(false);
const rejectReason = ref('');
const pendingCommentQuote = ref<string | null>(null);
const pendingCommentBody = ref('');
const titleRef = ref<HTMLTextAreaElement | null>(null);
const leadRef = ref<HTMLTextAreaElement | null>(null);
const reviewBody = ref('');

const form = reactive({
  title: '',
  summary: '',
  body: '',
  tags: [] as string[],
  departments: [] as string[]
});

const deptOptions = [
  'Digital',
  'DEV',
  'SEO / ORM',
  'Отдел продаж',
  'Маркетинг',
  'Бухгалтерия',
  'Дирекция',
  'Внутренние проекты',
  'HR'
];

const canEditForm = computed(() => {
  if (!editingId.value || !active.value) return true;
  return articleEditable(active.value);
});

const reviewFields = computed(() => (active.value ? fieldsOf(active.value) : { title: '', summary: '', body: '', tags: [], departments: [] }));

watch(
  () => reviewFields.value.body,
  (body) => {
    if (mode.value === 'review') reviewBody.value = body;
  },
  { immediate: true }
);

const close = () => {
  emit('update:open', false);
  mode.value = 'edit';
  rejectOpen.value = false;
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

const toggleDept = (dept: string) => {
  const i = form.departments.indexOf(dept);
  if (i >= 0) form.departments.splice(i, 1);
  else form.departments.push(dept);
};

const bodyPlainText = (html: string) =>
  html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();

const sanitizeBody = (html: string) => {
  if (typeof document === 'undefined') return html;
  const box = document.createElement('div');
  box.innerHTML = html;
  box.querySelectorAll('.kb-spoiler.is-open').forEach((el) => el.classList.remove('is-open'));
  box.querySelectorAll('.kb-img-wrap').forEach((wrap) => {
    const img = wrap.querySelector('img');
    if (img) {
      img.classList.remove('kb-img--selected');
      wrap.replaceWith(img);
    }
  });
  box.querySelectorAll('.kb-img-resize-handle').forEach((el) => el.remove());
  box.querySelectorAll('[contenteditable]').forEach((el) => el.removeAttribute('contenteditable'));
  box.querySelectorAll('script, style, iframe').forEach((el) => el.remove());
  return box.innerHTML.trim();
};

const resizeField = (el: HTMLTextAreaElement | null, minPx: number) => {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${Math.max(el.scrollHeight, minPx)}px`;
};

const resizeEditorFields = () => {
  resizeField(titleRef.value, 40);
  resizeField(leadRef.value, 36);
};

const blankForm = () => {
  editingId.value = null;
  active.value = null;
  form.title = '';
  form.summary = '';
  form.body = '';
  form.tags = [];
  form.departments = [];
  mode.value = 'edit';
};

const resetForm = () => {
  blankForm();
  errorText.value = '';
  okText.value = '';
  nextTick(resizeEditorFields);
};

const fillForm = (article: KnowledgeAuthorArticle) => {
  editingId.value = article.id;
  active.value = article;
  const fields = fieldsOf(article);
  form.title = fields.title;
  form.summary = fields.summary;
  form.body = fields.body;
  form.tags = fields.tags;
  form.departments = fields.departments;
  errorText.value = '';
  nextTick(resizeEditorFields);
};

const startEdit = (article: KnowledgeAuthorArticle) => {
  mode.value = 'edit';
  fillForm(article);
};

const startReview = (article: KnowledgeAuthorArticle) => {
  mode.value = 'review';
  active.value = article;
  editingId.value = article.id;
  reviewBody.value = fieldsOf(article).body;
  pendingCommentQuote.value = null;
  pendingCommentBody.value = '';
  errorText.value = '';
  okText.value = '';
};

const onEditorReady = () => nextTick(resizeEditorFields);

const payloadFromForm = () => ({
  title: form.title.trim(),
  summary: form.summary.trim(),
  body: sanitizeBody(form.body),
  tags: form.tags,
  departments: [...form.departments]
});

const validateForm = () => {
  if (form.title.trim().length < 3) {
    errorText.value = 'Заголовок: минимум 3 символа';
    return false;
  }
  if (bodyPlainText(sanitizeBody(form.body)).length < 20) {
    errorText.value = 'Текст статьи: минимум 20 символов';
    return false;
  }
  return true;
};

const saveDraft = async () => {
  if (!canEditForm.value) return;
  if (!validateForm()) return;
  busy.value = true;
  errorText.value = '';
  okText.value = '';
  try {
    const data = payloadFromForm();
    if (editingId.value) {
      const article = await updateArticle(editingId.value, data);
      fillForm(article);
      okText.value = 'Сохранено';
    } else {
      const article = await createArticle({ ...data, asDraft: true });
      fillForm(article);
      okText.value = 'Черновик сохранён';
    }
  } catch (error: unknown) {
    errorText.value = apiErrorMessage(error, 'Не удалось сохранить');
  } finally {
    busy.value = false;
  }
};

const saveAndMaybeSubmit = async () => {
  if (!canEditForm.value) return;
  if (!validateForm()) return;
  busy.value = true;
  errorText.value = '';
  okText.value = '';
  try {
    const data = payloadFromForm();
    let article: KnowledgeAuthorArticle;
    if (editingId.value) {
      article = await updateArticle(editingId.value, data);
      article = await submitArticle(article.id);
    } else {
      article = await createArticle({ ...data, asDraft: false });
    }
    fillForm(article);
    okText.value = 'Отправлено на проверку руководителю';
  } catch (error: unknown) {
    errorText.value = apiErrorMessage(error, 'Не удалось отправить');
  } finally {
    busy.value = false;
  }
};

const doModerate = async (action: 'accept' | 'revision' | 'reject') => {
  if (!active.value) return;
  if (action === 'reject' && rejectReason.value.trim().length < 3) {
    errorText.value = 'Укажите причину отклонения';
    return;
  }
  busy.value = true;
  errorText.value = '';
  okText.value = '';
  try {
    const article = await moderateArticle(
      active.value.id,
      action,
      action === 'reject' ? rejectReason.value.trim() : undefined
    );
    rejectOpen.value = false;
    rejectReason.value = '';
    okText.value =
      action === 'accept'
        ? 'Статья принята и опубликована'
        : action === 'revision'
          ? 'Возвращено автору на доработку'
          : 'Статья отклонена';
    mode.value = 'edit';
    active.value = article;
    if (action !== 'reject') fillForm(article);
    else blankForm();
  } catch (error: unknown) {
    errorText.value = apiErrorMessage(error, 'Не удалось выполнить действие');
  } finally {
    busy.value = false;
  }
};

const onRequestComment = (payload: { quote: string }) => {
  pendingCommentQuote.value = payload.quote;
  pendingCommentBody.value = '';
};

const cancelComment = () => {
  pendingCommentQuote.value = null;
  pendingCommentBody.value = '';
};

const saveComment = async () => {
  if (!active.value || !pendingCommentQuote.value) return;
  const body = pendingCommentBody.value.trim();
  if (!body) return;
  busy.value = true;
  try {
    const article = await addComment(active.value.id, pendingCommentQuote.value, body);
    active.value = article;
    cancelComment();
  } catch (error: unknown) {
    errorText.value = apiErrorMessage(error, 'Не удалось сохранить комментарий');
  } finally {
    busy.value = false;
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
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    void hydrate().catch((error: unknown) => {
      errorText.value = apiErrorMessage(error, 'Не удалось загрузить статьи');
    });
  }
);

// silence unused if tree-shaken — reviewQueue used in template via reports primarily
void reviewQueue;
</script>

<style scoped>
.kb-author-layer {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: rgba(20, 16, 30, 0.45);
  display: flex;
  justify-content: center;
  align-items: stretch;
  padding: 16px;
}

.kb-author-panel {
  width: min(1100px, 100%);
  max-height: 100%;
  overflow: auto;
  background: #eeeee8;
  border: 3px solid #111;
  box-shadow: 8px 8px 0 #7451f4;
  display: flex;
  flex-direction: column;
}

.kb-author-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px;
  border-bottom: 2px solid #111;
  background: #fff;
  position: sticky;
  top: 0;
  z-index: 2;
}

.kb-author-panel__title {
  margin: 0;
  font-family: Unbounded, sans-serif;
  font-size: 1.05rem;
}

.kb-author-panel__close {
  width: 40px;
  height: 40px;
  border: 2px solid #111;
  background: #ddf365;
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
}

.kb-author-panel__body {
  padding: 16px;
  display: grid;
  gap: 16px;
}

.kb-author-list__reports-head {
  margin-top: 20px;
}

.kb-review {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 16px;
  align-items: start;
}

@media (max-width: 860px) {
  .kb-review {
    grid-template-columns: 1fr;
  }
}

.kb-review__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.kb-pill {
  border: 2px solid #111;
  border-radius: 999px;
  padding: 8px 16px;
  font-weight: 700;
  cursor: pointer;
  font-family: Golos Text, sans-serif;
}

.kb-pill:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.kb-pill--lime {
  background: #ddf365;
  color: #111;
}

.kb-pill--outline {
  background: #fff;
  color: #111;
}

.kb-pill--dark {
  background: #1a1a1a;
  color: #fff;
}

.kb-review__title {
  margin: 0 0 6px;
  font-family: Unbounded, sans-serif;
  font-size: 1.25rem;
}

.kb-review__lead {
  margin: 0 0 8px;
}

.kb-review__side {
  border: 2px solid #111;
  background: #fff;
  padding: 12px;
  min-height: 200px;
}

.kb-review__side-title {
  margin: 0 0 10px;
  font-family: Unbounded, sans-serif;
  font-size: 0.95rem;
}

.kb-comments {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}

.kb-comments__item {
  border-left: 3px solid #7451f4;
  padding-left: 10px;
}

.kb-comments__quote {
  margin: 0 0 4px;
  font-size: 0.85rem;
  color: #555;
  font-style: italic;
}

.kb-comments__body {
  margin: 0;
}

.kb-comments__meta {
  margin: 4px 0 0;
  font-size: 0.8rem;
}

.kb-comment-draft {
  margin-top: 14px;
  display: grid;
  gap: 8px;
}

.kb-comment-draft__input {
  width: 100%;
  border: 2px solid #111;
  padding: 8px;
  font: inherit;
  resize: vertical;
}

.kb-comment-draft__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.kb-reject-layer {
  position: fixed;
  inset: 0;
  z-index: 90;
  background: rgba(10, 8, 16, 0.55);
  display: grid;
  place-items: center;
  padding: 16px;
}

.kb-reject-modal {
  width: min(440px, 100%);
  background: #eeeee8;
  border: 3px solid #111;
  box-shadow: 6px 6px 0 #ddf365;
  padding: 18px;
  display: grid;
  gap: 12px;
}

.kb-reject-modal__title {
  margin: 0;
  font-family: Unbounded, sans-serif;
}

.kb-reject-modal__input {
  width: 100%;
  border: 2px solid #111;
  padding: 10px;
  font: inherit;
  resize: vertical;
}

.kb-reject-modal__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.kb-author-comments {
  margin-top: 12px;
  padding: 12px;
  border: 2px solid #111;
  background: #fff;
}
</style>
