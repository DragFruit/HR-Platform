<template>
  <div class="ideas-bank-page">
    <header class="ideas-bank-header">
      <p class="muted ideas-bank-header__lead">
        Предложения по улучшению офиса, процессов и культуры — в одном месте, без потерь в переписке.
      </p>
      <button type="button" class="button primary ideas-bank-create-btn" @click="openCreate">
        <span class="ideas-bulb-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M12 1.5v2.2M5.2 4.4l1.6 1.6M18.8 4.4l-1.6 1.6M3.2 11h2.2M18.6 11h2.2"
              stroke="#ffe566"
              stroke-width="1.8"
              stroke-linecap="round"
            />
            <path
              d="M8.2 10.2c0-2.2 1.7-4 3.8-4s3.8 1.8 3.8 4c0 1.4-.7 2.6-1.8 3.3-.5.3-.8.8-.8 1.4v.6H10.8v-.6c0-.6-.3-1.1-.8-1.4-1.1-.7-1.8-1.9-1.8-3.3Z"
              fill="#ffe566"
              stroke="#111"
              stroke-width="1.45"
              stroke-linejoin="round"
            />
            <path
              d="M11 11.2v2.1M13 11.2v2.1"
              stroke="#111"
              stroke-width="1.2"
              stroke-linecap="round"
              opacity="0.55"
            />
            <path
              d="M10.2 15.5h3.6M10.2 17.2h3.6M10.6 18.9h2.8"
              stroke="#111"
              stroke-width="1.45"
              stroke-linecap="round"
            />
          </svg>
        </span>
        Создать идею
      </button>
    </header>

    <div class="ideas-bank-layout">
      <div class="ideas-bank-main">
        <div class="ideas-bank-stats" role="list" aria-label="Сводка по идеям — фильтр по статусу">
          <button
            v-for="stat in statCards"
            :key="stat.key"
            type="button"
            class="ideas-bank-stat"
            :class="`ideas-bank-stat--${stat.key}`"
            role="listitem"
            :aria-label="`Фильтр: ${stat.label}`"
            @click="applyStatFilter(stat.key)"
          >
            <span class="ideas-bank-stat__icon" aria-hidden="true" v-html="stat.icon" />
            <span class="ideas-bank-stat__value">{{ stat.value }}</span>
            <span class="ideas-bank-stat__label">{{ stat.label }}</span>
          </button>
        </div>

        <section class="ideas-bank-toolbar">
          <div class="ideas-bank-toolbar__row">
            <div class="filters ideas-bank-scope">
              <button
                v-for="filter in scopeFilters"
                :key="filter.value"
                class="filter-btn"
                type="button"
                :class="{ active: scopeFilter === filter.value }"
                @click="scopeFilter = filter.value"
              >
                {{ filter.label }}
              </button>
            </div>

            <div class="ideas-bank-toolbar__controls">
              <div ref="sortMenuRef" class="ideas-bank-sort" @click.stop>
                <button
                  type="button"
                  class="ideas-bank-sort__btn"
                  :class="{ active: sortMenuOpen || sortMode !== 'new' }"
                  :aria-expanded="sortMenuOpen"
                  aria-haspopup="listbox"
                  aria-label="Сортировка"
                  @click="sortMenuOpen = !sortMenuOpen"
                >
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M8 5v14M8 5l-3 3M8 5l3 3M16 19V5M16 19l-3-3M16 19l3-3"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </button>

                <ul
                  v-if="sortMenuOpen"
                  class="ideas-bank-sort__menu"
                  role="listbox"
                  aria-label="Варианты сортировки"
                >
                  <li v-for="option in sortOptions" :key="option.value" role="none">
                    <button
                      type="button"
                      role="option"
                      class="ideas-bank-sort__option"
                      :class="{ active: sortMode === option.value }"
                      :aria-selected="sortMode === option.value"
                      @click="selectSort(option.value)"
                    >
                      {{ option.label }}
                    </button>
                  </li>
                </ul>
              </div>

              <label class="ideas-bank-select">
                <span class="soft">Категория</span>
                <select v-model="categoryFilter">
                  <option value="all">Все</option>
                  <option v-for="category in categories" :key="category" :value="category">
                    {{ category }}
                  </option>
                </select>
              </label>

              <label class="ideas-bank-select">
                <span class="soft">Статус</span>
                <select v-model="statusFilter">
                  <option value="all">Все</option>
                  <option v-for="option in statusOptions" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
              </label>

              <label class="ideas-bank-search">
                <span class="soft">Поиск</span>
                <input v-model="searchQuery" type="search" placeholder="Название или описание" />
              </label>
            </div>
          </div>

          <p class="ideas-bank-toolbar__meta soft">
            {{ filteredIdeas.length }} {{ filteredIdeasLabel }}
            <button v-if="hasActiveFilters" type="button" class="ideas-bank-reset" @click="resetFilters">
              Сбросить фильтры
            </button>
          </p>
        </section>
      </div>

      <aside class="ideas-bank-authors" aria-label="Топ-авторы">
        <h3 class="ideas-bank-authors__title">Топ-авторы</h3>
        <ol v-if="topAuthors.length" class="ideas-bank-authors__list">
          <li v-for="(author, index) in topAuthors" :key="author.userId" class="ideas-bank-authors__item">
            <span class="ideas-bank-authors__rank">{{ index + 1 }}</span>
            <UserAvatar :user-id="author.userId" :name="author.name" :size="32" />
            <div class="ideas-bank-authors__meta">
              <span class="ideas-bank-authors__name">{{ author.name }}</span>
              <span class="soft">{{ author.count }} {{ authorDoneLabel(author.count) }}</span>
            </div>
          </li>
        </ol>
        <p v-else class="muted ideas-bank-authors__empty">Пока нет реализованных идей.</p>
      </aside>
    </div>

    <section class="ideas-bank-feed">
      <ul v-if="filteredIdeas.length" class="ideas-bank-list">
        <li v-for="idea in filteredIdeas" :key="idea.id" class="ideas-bank-card">
          <div class="ideas-bank-card__main">
            <div class="ideas-bank-card__tags">
              <span class="ideas-chip ideas-chip--accent">{{ idea.category }}</span>
              <span class="ideas-chip">{{ formatDate(idea.createdAt) }}</span>
              <span v-if="idea.attachmentName" class="ideas-chip ideas-chip--file" :title="idea.attachmentName">
                файл
              </span>
            </div>
            <h3 class="ideas-bank-card__title">{{ idea.title }}</h3>
            <p class="ideas-bank-card__text muted">{{ idea.description }}</p>
            <div class="ideas-bank-card__meta">
              <UserAvatar :user-id="idea.authorUserId" :name="idea.authorName" :size="28" />
              <span>{{ idea.authorName }}</span>
              <span class="ideas-bank-card__status" :data-status="idea.status">
                {{ statusLabel(idea.status) }}
              </span>
            </div>
            <p v-if="idea.statusComment" class="ideas-admin-comment muted">
              Комментарий: {{ idea.statusComment }}
            </p>
          </div>

          <div class="ideas-bank-card__votes">
            <button
              type="button"
              class="ideas-bank-vote"
              :class="{ active: userVoteFor(idea.id) === 'up' }"
              :aria-pressed="userVoteFor(idea.id) === 'up'"
              aria-label="Голос за"
              @click="voteIdea(idea.id, 'up')"
            >
              <svg class="ideas-vote-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M7 11v8a1 1 0 0 0 1 1h2v-9H8a1 1 0 0 0-1 1Z" fill="currentColor" />
                <path
                  d="M11 10.2 13.4 5.4a1.4 1.4 0 0 1 2.7.6V10h3a1.4 1.4 0 0 1 1.4 1.5l-1.1 7A1.4 1.4 0 0 1 18 20h-7"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linejoin="round"
                />
              </svg>
              <span>{{ idea.votesUp }}</span>
            </button>
            <button
              type="button"
              class="ideas-bank-vote ideas-bank-vote--down"
              :class="{ active: userVoteFor(idea.id) === 'down' }"
              :aria-pressed="userVoteFor(idea.id) === 'down'"
              aria-label="Голос против"
              @click="voteIdea(idea.id, 'down')"
            >
              <svg class="ideas-vote-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M7 5v8a1 1 0 0 0 1 1h2V5H8a1 1 0 0 0-1 1Z" fill="currentColor" />
                <path
                  d="M11 13.8 13.4 18.6a1.4 1.4 0 0 0 2.7-.6V14h3a1.4 1.4 0 0 0 1.4-1.5l-1.1-7A1.4 1.4 0 0 0 18 4h-7"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linejoin="round"
                />
              </svg>
              <span>{{ idea.votesDown }}</span>
            </button>
            <button
              v-if="canDeleteIdea(idea)"
              type="button"
              class="ideas-bank-delete ideas-bank-delete--compact"
              @click="askDelete(idea.id)"
            >
              Удалить
            </button>
          </div>
        </li>
      </ul>

      <div v-else class="ideas-bank-empty">
        <p class="muted">По этим фильтрам идей не найдено.</p>
        <button v-if="hasActiveFilters" type="button" class="button ghost" @click="resetFilters">
          Сбросить фильтры
        </button>
      </div>
    </section>
  </div>

  <OrgConfirmDialog
    :open="Boolean(pendingDeleteId)"
    message="Удалить эту идею? Действие нельзя отменить."
    @confirm="confirmDelete"
    @cancel="pendingDeleteId = null"
  />

  <Teleport to="body">
    <div
      v-if="showCreate"
      class="org-confirm-overlay ideas-create-overlay"
      role="presentation"
    >
      <form class="ideas-create-form" role="dialog" aria-modal="true" @submit.prevent="submitCreate">
        <h3 class="org-confirm-title">Новая идея</h3>
        <p class="soft ideas-create-form__lead">
          Опиши, что можно улучшить — предложение будет видно в общем банке.
        </p>

        <label class="ideas-create-field">
          <span>Заголовок</span>
          <input
            v-model="createForm.title"
            type="text"
            maxlength="120"
            placeholder="Коротко, о чём идея"
            required
          />
        </label>

        <label class="ideas-create-field">
          <span>Описание</span>
          <textarea
            v-model="createForm.description"
            class="ideas-create-field__description"
            rows="3"
            maxlength="600"
            placeholder="Что именно предлагаешь и какой эффект ожидаешь"
            required
          />
        </label>

        <label class="ideas-create-field">
          <span>Категория</span>
          <select v-model="createForm.category" required>
            <option v-for="category in IDEA_CATEGORIES" :key="category" :value="category">
              {{ category }}
            </option>
          </select>
        </label>

        <div class="ideas-create-field">
          <span>Файл</span>
          <div
            class="ideas-attach"
            :class="{ 'ideas-attach--drag': isAttachDragOver }"
            @dragenter.prevent="onAttachDragEnter"
            @dragover.prevent="onAttachDragOver"
            @dragleave.prevent="onAttachDragLeave"
            @drop.prevent="onAttachDrop"
          >
            <input
              ref="fileInputRef"
              class="ideas-attach__input"
              type="file"
              accept=".png,.jpg,.jpeg,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
              @change="onAttachmentChange"
            />
            <button type="button" class="ideas-attach__btn" @click="pickAttachment">
              <span class="ideas-clip-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M15.4 7.6 8.1 14.9a3.1 3.1 0 1 0 4.4 4.4l7.8-7.8a4.8 4.8 0 0 0-6.8-6.8L5.2 12.9a6.4 6.4 0 0 0 9.1 9.1l6.2-6.2"
                    stroke="#ddf365"
                    stroke-width="2.4"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
              <span class="ideas-attach__label">
                <template v-if="createForm.attachmentName">{{ createForm.attachmentName }}</template>
                <template v-else>Прикрепить файл</template>
              </span>
            </button>
            <button
              v-if="createForm.attachmentName"
              type="button"
              class="ideas-attach__clear"
              aria-label="Убрать файл"
              @click="clearAttachment"
            >
              Убрать
            </button>
          </div>
        </div>

        <p v-if="createError" class="gift-error">{{ createError }}</p>

        <div class="org-confirm-actions row">
          <button type="button" class="button ghost" @click="closeCreate">Отмена</button>
          <button type="submit" class="button primary ideas-bank-create-btn">
            <span class="ideas-bulb-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 1.5v2.2M5.2 4.4l1.6 1.6M18.8 4.4l-1.6 1.6M3.2 11h2.2M18.6 11h2.2"
                  stroke="#ffe566"
                  stroke-width="1.8"
                  stroke-linecap="round"
                />
                <path
                  d="M8.2 10.2c0-2.2 1.7-4 3.8-4s3.8 1.8 3.8 4c0 1.4-.7 2.6-1.8 3.3-.5.3-.8.8-.8 1.4v.6H10.8v-.6c0-.6-.3-1.1-.8-1.4-1.1-.7-1.8-1.9-1.8-3.3Z"
                  fill="#ffe566"
                  stroke="#111"
                  stroke-width="1.45"
                  stroke-linejoin="round"
                />
                <path
                  d="M11 11.2v2.1M13 11.2v2.1"
                  stroke="#111"
                  stroke-width="1.2"
                  stroke-linecap="round"
                  opacity="0.55"
                />
                <path
                  d="M10.2 15.5h3.6M10.2 17.2h3.6M10.6 18.9h2.8"
                  stroke="#111"
                  stroke-width="1.45"
                  stroke-linecap="round"
                />
              </svg>
            </span>
            Предложить
          </button>
        </div>
      </form>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { IdeaStatus } from '~/composables/useIdeasBank';
import { IDEA_CATEGORIES } from '~/composables/useIdeasBank';

const {
  ideas,
  stats,
  statusLabel,
  hydrate,
  myIdeas,
  categories,
  topAuthors,
  createIdea,
  voteIdea,
  userVoteFor,
  canDeleteIdea,
  deleteIdea
} = useIdeasBank();

type ScopeFilter = 'all' | 'mine';
type SortMode = 'new' | 'old' | 'popular' | 'unpopular';

const scopeFilter = ref<ScopeFilter>('all');
const categoryFilter = ref('all');
const statusFilter = ref<IdeaStatus | 'all'>('all');
const searchQuery = ref('');
const sortMode = ref<SortMode>('new');
const sortMenuOpen = ref(false);
const sortMenuRef = ref<HTMLElement | null>(null);
const showCreate = ref(false);
const createError = ref('');
const pendingDeleteId = ref<string | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const isAttachDragOver = ref(false);
let attachDragDepth = 0;

const ATTACH_ACCEPT = new Set([
  'png',
  'jpg',
  'jpeg',
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx'
]);

const createForm = reactive({
  title: '',
  description: '',
  category: IDEA_CATEGORIES[0],
  attachmentName: ''
});

const pickAttachment = () => {
  fileInputRef.value?.click();
};

const setAttachmentFile = (file: File | undefined | null) => {
  if (!file) {
    createForm.attachmentName = '';
    return;
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ATTACH_ACCEPT.has(ext)) {
    createError.value = 'Можно прикрепить png, jpg, pdf, doc, xls или ppt.';
    return;
  }

  createError.value = '';
  createForm.attachmentName = file.name;

  if (fileInputRef.value) {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    fileInputRef.value.files = transfer.files;
  }
};

const onAttachmentChange = (event: Event) => {
  const input = event.target as HTMLInputElement;
  setAttachmentFile(input.files?.[0] ?? null);
};

const onAttachDragEnter = () => {
  attachDragDepth += 1;
  isAttachDragOver.value = true;
};

const onAttachDragOver = () => {
  isAttachDragOver.value = true;
};

const onAttachDragLeave = () => {
  attachDragDepth = Math.max(0, attachDragDepth - 1);
  if (attachDragDepth === 0) isAttachDragOver.value = false;
};

const onAttachDrop = (event: DragEvent) => {
  attachDragDepth = 0;
  isAttachDragOver.value = false;
  const file = event.dataTransfer?.files?.[0];
  setAttachmentFile(file ?? null);
};

const clearAttachment = () => {
  createForm.attachmentName = '';
  isAttachDragOver.value = false;
  attachDragDepth = 0;
  if (fileInputRef.value) fileInputRef.value.value = '';
};

const scopeFilters: { value: ScopeFilter; label: string }[] = [
  { value: 'all', label: 'Все идеи' },
  { value: 'mine', label: 'Мои идеи' }
];

const statusOptions: { value: IdeaStatus; label: string }[] = [
  { value: 'review', label: 'На рассмотрении' },
  { value: 'implementation', label: 'Реализация' },
  { value: 'done', label: 'Реализовано' },
  { value: 'rejected', label: 'Отклонено' }
];

const sortOptions: { value: SortMode; label: string }[] = [
  { value: 'new', label: 'Сначала новые' },
  { value: 'old', label: 'Сначала старые' },
  { value: 'popular', label: 'Популярные' },
  { value: 'unpopular', label: 'Непопулярные' }
];

const selectSort = (mode: SortMode) => {
  sortMode.value = mode;
  sortMenuOpen.value = false;
};

const onDocumentClick = (event: MouseEvent) => {
  const target = event.target as Node | null;
  if (!sortMenuRef.value || !target) return;
  if (!sortMenuRef.value.contains(target)) sortMenuOpen.value = false;
};

const statIcons = {
  total:
    '<svg viewBox="0 0 24 24" fill="none"><path d="M9 18h6M10 22h4M12 3a6 6 0 0 1 6 6c0 2.2-1.2 4.1-3 5.2V16H9v-1.8A6 6 0 0 1 12 3Z" stroke="currentColor" stroke-width="1.6"/></svg>',
  review:
    '<svg viewBox="0 0 24 24" fill="none"><path d="M7 11h10M7 15h6M8 21h8a4 4 0 0 0 4-4V8l-4-4H8a4 4 0 0 0-4 4v9a4 4 0 0 0 4 4Z" stroke="currentColor" stroke-width="1.6"/></svg>',
  implementation:
    '<svg viewBox="0 0 24 24" fill="none"><path d="M6 8l6-4 6 4v8l-6 4-6-4V8Z" stroke="currentColor" stroke-width="1.6"/><path d="M12 4v16M6 8l12 8M18 8 6 16" stroke="currentColor" stroke-width="1.4"/></svg>',
  done:
    '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/><path d="m8 12.5 2.5 2.5L16 9.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  rejected:
    '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/><path d="m9 9 6 6M15 9l-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
};

const statCards = computed(() => [
  { key: 'total', value: stats.value.total, label: 'Всего идей', icon: statIcons.total },
  { key: 'review', value: stats.value.review, label: 'На рассмотрении', icon: statIcons.review },
  {
    key: 'implementation',
    value: stats.value.implementation,
    label: 'Реализация',
    icon: statIcons.implementation
  },
  { key: 'done', value: stats.value.done, label: 'Реализовано', icon: statIcons.done },
  { key: 'rejected', value: stats.value.rejected, label: 'Отклонено', icon: statIcons.rejected }
]);

type StatFilterKey = 'total' | IdeaStatus;

const applyStatFilter = (key: StatFilterKey) => {
  statusFilter.value = key === 'total' ? 'all' : key;
};

const filteredIdeas = computed(() => {
  let list = scopeFilter.value === 'mine' ? myIdeas.value : ideas.value;

  if (categoryFilter.value !== 'all') {
    list = list.filter((idea) => idea.category === categoryFilter.value);
  }
  if (statusFilter.value !== 'all') {
    list = list.filter((idea) => idea.status === statusFilter.value);
  }

  const query = searchQuery.value.trim().toLowerCase();
  if (query) {
    list = list.filter(
      (idea) =>
        idea.title.toLowerCase().includes(query) || idea.description.toLowerCase().includes(query)
    );
  }

  return [...list].sort((a, b) => {
    switch (sortMode.value) {
      case 'old':
        return a.createdAt.localeCompare(b.createdAt);
      case 'popular': {
        const scoreA = a.votesUp - a.votesDown;
        const scoreB = b.votesUp - b.votesDown;
        return scoreB - scoreA || b.votesUp - a.votesUp;
      }
      case 'unpopular': {
        const scoreA = a.votesUp - a.votesDown;
        const scoreB = b.votesUp - b.votesDown;
        return scoreA - scoreB || a.votesUp - b.votesUp;
      }
      case 'new':
      default:
        return b.createdAt.localeCompare(a.createdAt);
    }
  });
});

const hasActiveFilters = computed(
  () =>
    categoryFilter.value !== 'all' ||
    statusFilter.value !== 'all' ||
    searchQuery.value.trim().length > 0 ||
    sortMode.value !== 'new'
);

const ideasWord = (count: number) => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'идея';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'идеи';
  return 'идей';
};

const filteredIdeasLabel = computed(() => ideasWord(filteredIdeas.value.length));

const authorDoneLabel = (count: number) => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'реализованная идея';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'реализованные идеи';
  return 'реализованных идей';
};

const formatDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

const resetFilters = () => {
  categoryFilter.value = 'all';
  statusFilter.value = 'all';
  searchQuery.value = '';
  sortMode.value = 'new';
};

const openCreate = () => {
  createError.value = '';
  showCreate.value = true;
};

const closeCreate = () => {
  showCreate.value = false;
  createError.value = '';
  clearAttachment();
};

const submitCreate = async () => {
  createError.value = '';
  const title = createForm.title.trim();
  const description = createForm.description.trim();
  if (title.length < 3 || description.length < 10) {
    createError.value = 'Заполните заголовок (от 3 символов) и описание (от 10 символов).';
    return;
  }

  const created = await createIdea({
    title: createForm.title,
    description: createForm.description,
    category: createForm.category,
    city: 'Москва',
    attachmentName: createForm.attachmentName || undefined
  });

  if (!created) {
    createError.value = 'Не удалось сохранить идею. Попробуйте ещё раз.';
    return;
  }

  createForm.title = '';
  createForm.description = '';
  createForm.category = IDEA_CATEGORIES[0];
  clearAttachment();
  scopeFilter.value = 'mine';
  closeCreate();
};

const askDelete = (ideaId: string) => {
  pendingDeleteId.value = ideaId;
};

const confirmDelete = async () => {
  if (!pendingDeleteId.value) return;
  await deleteIdea(pendingDeleteId.value);
  pendingDeleteId.value = null;
};

onMounted(() => {
  void hydrate();
  document.addEventListener('click', onDocumentClick);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick);
});
</script>
