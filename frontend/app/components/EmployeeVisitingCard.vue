<template>
  <Teleport to="body">
    <div
      v-if="employee"
      class="emp-card-overlay"
      role="presentation"
      @click.self="closeEmployeeVisitingCard"
    >
      <article
        class="emp-card"
        role="dialog"
        aria-modal="true"
        :aria-label="`Визитка: ${employee.name}`"
        @keydown.esc="closeEmployeeVisitingCard"
      >
        <button
          type="button"
          class="emp-card__close"
          aria-label="Закрыть"
          @click="closeEmployeeVisitingCard"
        >
          <span aria-hidden="true">×</span>
        </button>

        <div class="emp-card__body">
          <div class="emp-card__photo">
            <UserAvatar
              :user-id="avatarUserId"
              :name="employee.name"
              :size="120"
            />
          </div>

          <div class="emp-card__main">
            <p class="emp-card__eyebrow">VBI · Сотрудник</p>
            <h2 class="emp-card__name">{{ employee.name }}</h2>

            <dl class="emp-card__fields">
              <div class="emp-card__field">
                <dt>Должность</dt>
                <dd>{{ employee.title || '—' }}</dd>
              </div>
              <div class="emp-card__field">
                <dt>Отдел</dt>
                <dd>{{ employee.department || '—' }}</dd>
              </div>
              <div class="emp-card__field">
                <dt>В команде с</dt>
                <dd>{{ hiredLabel }}</dd>
              </div>
              <div class="emp-card__field">
                <dt>Стаж</dt>
                <dd>{{ tenureLabel }}</dd>
              </div>
              <div v-if="birthdayLabel" class="emp-card__field">
                <dt>День рождения</dt>
                <dd>{{ birthdayLabel }}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div class="emp-card__footer">
          <ul v-if="achievements.length" class="emp-card__achs" aria-label="Достижения">
            <li
              v-for="a in achievements"
              :key="a.id"
              class="emp-card__ach"
              :title="a.title"
            >
              <img
                v-if="a.imageSrc"
                :src="a.imageSrc"
                :alt="a.title"
                width="28"
                height="28"
              />
              <span v-else class="emp-card__ach-emoji" aria-hidden="true">{{
                a.emoji ?? '🏆'
              }}</span>
            </li>
          </ul>
          <p v-else class="emp-card__achs-empty muted">Пока без ачивок</p>

          <div class="emp-card__meta">
            <span class="emp-card__ideas">Идеи: {{ ideasDone }}</span>
            <div class="emp-card__links">
              <button
                type="button"
                class="emp-card__link"
                title="Скоро"
                disabled
              >
                Вишлист
              </button>
              <a
                v-if="bitrixUrl"
                class="emp-card__link"
                :href="bitrixUrl"
                target="_blank"
                rel="noopener noreferrer"
              >
                Bitrix
              </a>
            </div>
          </div>
        </div>
      </article>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import {
  formatBirthdayRu,
  formatHiredAtRu,
  tenureYmLabel
} from '~/utils/tenureAnniversary';
import { publicAchievementsForEmployee } from '~/utils/employeePublicCard';

const { openEmployeeId, closeEmployeeVisitingCard } = useEmployeeVisitingCard();
const { findById, employees } = useEmployees();
const { ideas } = useIdeasBank();

const employee = computed(() => {
  const id = openEmployeeId.value;
  if (id == null) return null;
  return findById(id) ?? employees.value.find((e) => e.id === id) ?? null;
});

const avatarUserId = computed(
  () => employee.value?.platform_user_id ?? employee.value?.bitrix_user_id ?? null
);

const hiredLabel = computed(() =>
  employee.value?.hired_at ? formatHiredAtRu(employee.value.hired_at) : '—'
);

const tenureLabel = computed(() =>
  employee.value?.hired_at ? tenureYmLabel(employee.value.hired_at) : '—'
);

const birthdayLabel = computed(() => {
  const b = employee.value?.birthday?.trim();
  return b ? formatBirthdayRu(b) : '';
});

const ideasDone = computed(() => {
  const emp = employee.value;
  if (!emp) return 0;
  const uid = emp.platform_user_id;
  const nameKey = emp.name.trim().toLowerCase();
  return ideas.value.filter((idea) => {
    if (idea.status !== 'done') return false;
    if (uid && idea.authorUserId === uid) return true;
    return idea.authorName.trim().toLowerCase() === nameKey;
  }).length;
});

const achievements = computed(() => {
  const emp = employee.value;
  if (!emp) return [];
  return publicAchievementsForEmployee(emp, ideasDone.value).slice(0, 10);
});

const bitrixUrl = computed(() => {
  const id = employee.value?.bitrix_user_id;
  if (!id) return null;
  return `https://crm.vbi.ru/company/personal/user/${id}/`;
});

onMounted(() => {
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && openEmployeeId.value != null) {
      closeEmployeeVisitingCard();
    }
  };
  window.addEventListener('keydown', onKey);
  onUnmounted(() => window.removeEventListener('keydown', onKey));
});
</script>

<style scoped>
.emp-card-overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(32, 32, 32, 0.35);
}

.emp-card {
  position: relative;
  width: min(560px, 100%);
  background: var(--page-bg, #eeeee8);
  border: 3px solid var(--border-brutal, #202020);
  box-shadow: 6px 6px 0 #ddf365;
  padding: 18px 20px 14px;
}

.emp-card__close {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border: 2px solid #202020;
  background: #ddf365;
  color: #202020;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  padding: 0;
}

.emp-card__close:hover {
  filter: brightness(0.97);
}

.emp-card__body {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 16px 18px;
  align-items: start;
  padding-right: 28px;
}

.emp-card__photo {
  border: 2px solid #202020;
  background: #fff;
  display: grid;
  place-items: center;
  min-height: 120px;
  overflow: hidden;
}

.emp-card__eyebrow {
  margin: 0 0 4px;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted, #565656);
}

.emp-card__name {
  margin: 0 0 12px;
  font-size: 1.35rem;
  font-weight: 800;
  line-height: 1.15;
}

.emp-card__fields {
  margin: 0;
  display: grid;
  gap: 6px 0;
}

.emp-card__field {
  display: grid;
  grid-template-columns: 7.5rem 1fr;
  gap: 8px;
  align-items: baseline;
  border-bottom: 1px solid rgba(32, 32, 32, 0.12);
  padding-bottom: 4px;
}

.emp-card__field dt {
  margin: 0;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted, #565656);
}

.emp-card__field dd {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.emp-card__footer {
  margin-top: 14px;
  padding-top: 10px;
  border-top: 2px solid #202020;
}

.emp-card__achs {
  list-style: none;
  margin: 0 0 8px;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.emp-card__ach {
  width: 32px;
  height: 32px;
  border: 1.5px solid #202020;
  background: #fff;
  display: grid;
  place-items: center;
  overflow: hidden;
}

.emp-card__ach img {
  width: 28px;
  height: 28px;
  object-fit: contain;
}

.emp-card__ach-emoji {
  font-size: 14px;
  line-height: 1;
}

.emp-card__achs-empty {
  margin: 0 0 8px;
  font-size: 13px;
}

.emp-card__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.emp-card__ideas {
  font-size: 13px;
  font-weight: 600;
}

.emp-card__links {
  display: flex;
  gap: 12px;
}

.emp-card__link {
  font-size: 12px;
  color: var(--text-muted, #565656);
  text-decoration: underline;
  text-underline-offset: 2px;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
}

.emp-card__link:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  text-decoration: none;
}

a.emp-card__link {
  color: var(--text-muted, #565656);
}

@media (max-width: 520px) {
  .emp-card__body {
    grid-template-columns: 1fr;
  }

  .emp-card__photo {
    width: 96px;
  }
}
</style>
