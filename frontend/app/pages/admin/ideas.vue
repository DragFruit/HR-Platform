<template>
  <div class="ideas-bank-page ideas-bank-page--admin">
  <section class="card section-card ideas-admin-hero">
    <div class="section-head ideas-admin-hero__head">
      <div class="ideas-admin-hero__copy">
        <h2 class="section-title">Банк идей</h2>
        <p class="muted ideas-admin-hero__lead">
          Все предложения сотрудников. Меняйте этап через подтверждение и при необходимости удаляйте заявки.
        </p>
      </div>
      <NuxtLink to="/ideas" class="button ghost ideas-admin-hero__link">
        <span class="ideas-admin-hero__link-full">Открыть как сотрудник</span>
        <span class="ideas-admin-hero__link-short">Как сотрудник</span>
      </NuxtLink>
    </div>

    <div class="ideas-bank-stats ideas-bank-stats--admin" role="list" aria-label="Сводка по идеям — фильтр по статусу">
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
  </section>

  <section class="card section-card ideas-admin-list">
    <div class="filters ideas-bank-scope">
      <button
        v-for="filter in statusFilters"
        :key="filter.value"
        class="filter-btn"
        type="button"
        :class="{ active: statusFilter === filter.value }"
        @click="statusFilter = filter.value"
      >
        {{ filter.label }}
      </button>
    </div>

    <p class="soft ideas-admin-list__count">{{ filteredIdeas.length }} {{ ideasWord(filteredIdeas.length) }}</p>

    <ul v-if="filteredIdeas.length" class="ideas-bank-list ideas-admin-list__items">
      <li v-for="idea in filteredIdeas" :key="idea.id" class="ideas-bank-card ideas-bank-card--admin">
        <div class="ideas-bank-card__main">
          <div class="ideas-bank-card__tags">
            <span class="ideas-chip ideas-chip--accent">{{ idea.category }}</span>
            <span class="ideas-chip">{{ formatDate(idea.createdAt) }}</span>
            <button
              v-if="idea.attachmentName"
              type="button"
              class="ideas-chip ideas-chip--file"
              :title="idea.attachmentName"
              @click="openIdeaAttachment(idea)"
            >
              файл
            </button>
            <label
              v-if="idea.attachmentName && !idea.attachmentStored"
              class="ideas-chip ideas-chip--file ideas-chip--upload"
            >
              загрузить файл
              <input
                type="file"
                class="ideas-attach__input"
                accept=".png,.jpg,.jpeg,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                @change="onAdminAttach(idea.id, $event)"
              />
            </label>
          </div>
          <h3 class="ideas-bank-card__title">{{ idea.title }}</h3>
          <p class="ideas-bank-card__text muted">{{ idea.description }}</p>
          <div class="ideas-bank-card__meta">
            <UserAvatar :user-id="idea.authorUserId" :name="idea.authorName" :size="28" />
            <span>{{ idea.authorName }}</span>
            <span class="ideas-bank-card__status" :data-status="idea.status">
              {{ statusLabel(idea.status) }}
            </span>
            <span class="soft">за {{ idea.votesUp }} · против {{ idea.votesDown }}</span>
          </div>
          <p v-if="idea.statusComment" class="ideas-admin-comment muted">
            Комментарий: {{ idea.statusComment }}
          </p>

          <div class="ideas-admin-stages" role="group" :aria-label="`Этап: ${idea.title}`">
            <button
              v-for="stage in statusStages"
              :key="stage.value"
              type="button"
              class="ideas-admin-stage"
              :class="{ active: idea.status === stage.value }"
              :data-status="stage.value"
              :disabled="idea.status === stage.value"
              @click="askStatusChange(idea.id, stage.value)"
            >
              {{ stage.label }}
            </button>
          </div>
        </div>

        <div class="ideas-bank-card__admin-actions">
          <button type="button" class="button ghost ideas-bank-delete" @click="askDelete(idea.id)">
            Удалить
          </button>
        </div>
      </li>
    </ul>

    <p v-else class="muted state-box compact-state">Идей в этой подборке нет.</p>
  </section>
  </div>

  <OrgConfirmDialog
    :open="Boolean(pendingDeleteId)"
    message="Удалить эту идею? Действие нельзя отменить."
    @confirm="confirmDelete"
    @cancel="pendingDeleteId = null"
  />

  <Teleport to="body">
    <div v-if="pendingStatus" class="org-confirm-overlay" role="presentation">
      <form class="ideas-create-form ideas-status-form" role="dialog" aria-modal="true" @submit.prevent="confirmStatusChange">
        <h3 class="org-confirm-title">{{ statusConfirmTitle }}</h3>
        <p class="soft ideas-create-form__lead">{{ statusConfirmLead }}</p>

        <label class="ideas-create-field">
          <span>
            Комментарий
            <template v-if="pendingStatus.status === 'rejected'"> (обязательно)</template>
            <template v-else> (необязательно)</template>
          </span>
          <textarea
            v-model="statusComment"
            class="ideas-create-field__description"
            rows="3"
            maxlength="400"
            :placeholder="
              pendingStatus.status === 'rejected'
                ? 'Почему отклоняем заявку'
                : 'Можно добавить пояснение для команды'
            "
            :required="pendingStatus.status === 'rejected'"
          />
        </label>

        <p v-if="statusError" class="gift-error">{{ statusError }}</p>

        <div class="org-confirm-actions row">
          <button type="button" class="button ghost" @click="cancelStatusChange">Отмена</button>
          <button type="submit" class="button primary">Подтвердить</button>
        </div>
      </form>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { IdeaStatus } from '~/composables/useIdeasBank';

const { ideas, stats, statusLabel, hydrate, deleteIdea, setIdeaStatus, openIdeaAttachment, uploadIdeaAttachment } =
  useIdeasBank();

const statusFilter = ref<IdeaStatus | 'all'>('all');
const pendingDeleteId = ref<string | null>(null);
const pendingStatus = ref<{ ideaId: string; status: IdeaStatus } | null>(null);
const statusComment = ref('');
const statusError = ref('');

const statusFilters: { value: IdeaStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'review', label: 'На рассмотрении' },
  { value: 'implementation', label: 'Реализация' },
  { value: 'done', label: 'Реализовано' },
  { value: 'rejected', label: 'Отклонено' }
];

type StatFilterKey = 'total' | IdeaStatus;

const applyStatFilter = (key: StatFilterKey) => {
  statusFilter.value = key === 'total' ? 'all' : key;
};

const statusStages: { value: IdeaStatus; label: string }[] = [
  { value: 'review', label: 'На рассмотрении' },
  { value: 'implementation', label: 'Реализация' },
  { value: 'done', label: 'Реализовано' },
  { value: 'rejected', label: 'Отклонено' }
];

const onAdminAttach = async (ideaId: string, event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const ok = await uploadIdeaAttachment(ideaId, file);
  input.value = '';
  if (!ok) {
    window.alert('Не удалось загрузить файл');
  }
};

const statusConfirmTitle = computed(() => {
  const status = pendingStatus.value?.status;
  if (status === 'implementation') return 'Взять в работу?';
  if (status === 'done') return 'Отметить реализованной?';
  if (status === 'rejected') return 'Отклонить идею?';
  return 'Вернуть на рассмотрение?';
});

const statusConfirmLead = computed(() => {
  const status = pendingStatus.value?.status;
  if (status === 'rejected') {
    return 'Укажите причину отклонения — автор и команда поймут решение.';
  }
  if (status === 'done') {
    return 'Идея попадёт в статистику автора и может изменить топ-авторов.';
  }
  if (status === 'implementation') {
    return 'Заявка перейдёт в этап реализации.';
  }
  return 'Заявка вернётся на этап рассмотрения.';
});

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

const filteredIdeas = computed(() => {
  const list =
    statusFilter.value === 'all'
      ? ideas.value
      : ideas.value.filter((idea) => idea.status === statusFilter.value);
  return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
});

const ideasWord = (count: number) => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'идея';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'идеи';
  return 'идей';
};

const formatDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

const askDelete = (ideaId: string) => {
  pendingDeleteId.value = ideaId;
};

const confirmDelete = async () => {
  if (!pendingDeleteId.value) return;
  await deleteIdea(pendingDeleteId.value);
  pendingDeleteId.value = null;
};

const askStatusChange = (ideaId: string, status: IdeaStatus) => {
  pendingStatus.value = { ideaId, status };
  statusComment.value = '';
  statusError.value = '';
};

const cancelStatusChange = () => {
  pendingStatus.value = null;
  statusComment.value = '';
  statusError.value = '';
};

const confirmStatusChange = async () => {
  if (!pendingStatus.value) return;
  const result = await setIdeaStatus(
    pendingStatus.value.ideaId,
    pendingStatus.value.status,
    statusComment.value
  );
  if (!result.ok) {
    statusError.value = result.error;
    return;
  }
  cancelStatusChange();
};

onMounted(() => {
  void hydrate();
});
</script>
