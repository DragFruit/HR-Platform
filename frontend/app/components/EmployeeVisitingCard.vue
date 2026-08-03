<template>
  <Teleport to="body">
    <template v-if="employee">
      <div class="emp-card-catcher" aria-hidden="true" @click="closeEmployeeVisitingCard" />
      <article
        ref="cardRef"
        class="emp-card"
        role="dialog"
        aria-modal="true"
        :aria-label="`Визитка: ${employee.name}`"
        :style="cardStyle"
      >
        <!-- Декор рамки как в LOCKED-etalon (квадратики сидят в чёрной полосе) -->
        <div class="emp-card__chrome" aria-hidden="true">
          <span class="emp-card__dot emp-card__dot--tl1" />
          <span class="emp-card__dot emp-card__dot--tl2" />
          <span class="emp-card__dot emp-card__dot--tl3" />
          <span class="emp-card__dot emp-card__dot--bl" />
          <span class="emp-card__dot emp-card__dot--br1" />
          <span class="emp-card__dot emp-card__dot--br2" />
        </div>

        <button
          type="button"
          class="emp-card__close"
          aria-label="Закрыть"
          @click="closeEmployeeVisitingCard"
        >
          <span aria-hidden="true">×</span>
        </button>

        <div class="emp-card__face">
          <div class="emp-card__top">
            <div class="emp-card__photo">
              <UserAvatar :user-id="avatarUserId" :name="employee.name" :size="168" />
            </div>

            <div class="emp-card__info">
              <p class="emp-card__badge">VBI · Сотрудник</p>
              <h2 class="emp-card__name">{{ displayName }}</h2>

              <dl class="emp-card__fields">
                <div class="emp-card__field">
                  <dt>Должность</dt>
                  <dd>{{ upper(employee.title) || '—' }}</dd>
                </div>
                <div class="emp-card__field">
                  <dt>Отдел</dt>
                  <dd>{{ upper(employee.department) || '—' }}</dd>
                </div>
                <div class="emp-card__field">
                  <dt>В команде с</dt>
                  <dd>{{ hiredLabel }}</dd>
                </div>
                <div class="emp-card__field">
                  <dt>Стаж</dt>
                  <dd>{{ tenureLabel }}</dd>
                </div>
                <div class="emp-card__field">
                  <dt>День рождения</dt>
                  <dd>{{ birthdayLabel }}</dd>
                </div>
              </dl>
            </div>
          </div>

          <div class="emp-card__rail">
            <div class="emp-card__rail-achs">
              <span class="emp-card__rail-label">Достижения</span>
              <ul class="emp-card__achs" aria-label="Достижения">
                <li
                  v-for="(a, index) in displayAchievements"
                  :key="a.id"
                  class="emp-card__ach"
                  :class="{
                    'emp-card__ach--lime': index === 0,
                    'emp-card__ach--purple': index === 1
                  }"
                  :title="a.title"
                >
                  <img
                    v-if="a.imageSrc"
                    :src="a.imageSrc"
                    :alt="a.title"
                    width="20"
                    height="20"
                  />
                  <span v-else aria-hidden="true">{{ a.emoji ?? '★' }}</span>
                </li>
              </ul>
            </div>

            <span class="emp-card__rail-sep" aria-hidden="true" />
            <span class="emp-card__rail-ideas">Идеи: {{ ideasCount }}</span>
            <span class="emp-card__rail-sep" aria-hidden="true" />
            <button
              type="button"
              class="emp-card__rail-link"
              title="Скоро"
              disabled
            >
              Вишлист
            </button>
            <span class="emp-card__rail-sep" aria-hidden="true" />
            <a
              v-if="bitrixUrl"
              class="emp-card__rail-link"
              :href="bitrixUrl"
              target="_blank"
              rel="noopener noreferrer"
            >
              Bitrix
            </a>
            <span v-else class="emp-card__rail-link emp-card__rail-link--off">Bitrix</span>
          </div>

          <img
            class="emp-card__barcode"
            src="/employee-card/barcode-strip.png"
            alt=""
            width="1129"
            height="44"
            draggable="false"
          />
        </div>
      </article>
    </template>
  </Teleport>
</template>

<script setup lang="ts">
import {
  formatBirthdayDot,
  formatHiredAtDot,
  tenureCardLabel
} from '~/utils/tenureAnniversary';
import { publicAchievementsForEmployee } from '~/utils/employeePublicCard';

const { openEmployeeId, anchor, closeEmployeeVisitingCard } = useEmployeeVisitingCard();
const { findById, employees } = useEmployees();
const { ideas } = useIdeasBank();

const cardRef = ref<HTMLElement | null>(null);
const position = ref({ left: 0, top: 0 });

const upper = (value?: string | null) => (value || '').trim().toLocaleUpperCase('ru-RU');

const employee = computed(() => {
  const id = openEmployeeId.value;
  if (id == null) return null;
  return findById(id) ?? employees.value.find((e) => e.id === id) ?? null;
});

const displayName = computed(() => upper(employee.value?.name) || '—');

const avatarUserId = computed(
  () => employee.value?.platform_user_id ?? employee.value?.bitrix_user_id ?? null
);

const hiredLabel = computed(() =>
  employee.value?.hired_at ? formatHiredAtDot(employee.value.hired_at) : '—'
);

const tenureLabel = computed(() =>
  employee.value?.hired_at ? tenureCardLabel(employee.value.hired_at) : '—'
);

const birthdayLabel = computed(() => {
  const b = employee.value?.birthday?.trim();
  return b ? formatBirthdayDot(b) : '—';
});

const ideasCount = computed(() => {
  const emp = employee.value;
  if (!emp) return 0;
  const uid = emp.platform_user_id;
  const nameKey = emp.name.trim().toLowerCase();
  return ideas.value.filter((idea) => {
    if (uid && idea.authorUserId === uid) return true;
    return idea.authorName.trim().toLowerCase() === nameKey;
  }).length;
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
  return publicAchievementsForEmployee(emp, ideasDone.value).slice(0, 5);
});

/** Плитки как на эскизе (ровно 5 слотов). */
const displayAchievements = computed(() => {
  const real = achievements.value.slice(0, 5);
  const slots: Array<{
    id: string;
    title: string;
    imageSrc?: string;
    emoji?: string;
  }> = real.map((a) => ({
    id: a.id,
    title: a.title,
    imageSrc: a.imageSrc,
    emoji: a.emoji
  }));
  while (slots.length < 5) {
    slots.push({ id: `empty-${slots.length}`, title: '' });
  }
  return slots;
});

const bitrixUrl = computed(() => {
  const id = employee.value?.bitrix_user_id;
  if (!id) return null;
  return `https://crm.vbi.ru/company/personal/user/${id}/`;
});

const cardStyle = computed(() => ({
  left: `${position.value.left}px`,
  top: `${position.value.top}px`
}));

const placeCard = async () => {
  await nextTick();
  const el = cardRef.value;
  if (!el) return;
  const pad = 12;
  const gap = 10;
  const rect = el.getBoundingClientRect();
  const aw = rect.width || 680;
  const ah = rect.height || 360;
  const ax = anchor.value?.x ?? window.innerWidth / 2;
  const ay = anchor.value?.y ?? window.innerHeight / 2;

  let left = ax + gap;
  let top = ay + gap;
  if (left + aw > window.innerWidth - pad) left = ax - aw - gap;
  if (top + ah > window.innerHeight - pad) top = ay - ah - gap;
  left = Math.max(pad, Math.min(left, window.innerWidth - aw - pad));
  top = Math.max(pad, Math.min(top, window.innerHeight - ah - pad));
  position.value = { left, top };
};

watch(
  () => [openEmployeeId.value, anchor.value?.x, anchor.value?.y] as const,
  async ([id]) => {
    if (id == null) return;
    position.value = {
      left: (anchor.value?.x ?? 24) + 10,
      top: (anchor.value?.y ?? 24) + 10
    };
    await placeCard();
  }
);

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
.emp-card-catcher {
  position: fixed;
  inset: 0;
  z-index: 79;
  background: transparent;
}

.emp-card {
  --lime: #ddf365;
  --purple: #7451f4;
  --ink: #111;
  --face: #eeeee8;
  --frame: 14px;
  --dot: 9px;
  position: fixed;
  z-index: 80;
  width: min(680px, calc(100vw - 24px));
  background: var(--face);
  border: var(--frame) solid var(--ink);
  border-radius: 14px;
  box-sizing: border-box;
  overflow: visible;
}

.emp-card__chrome {
  pointer-events: none;
}

.emp-card__dot {
  position: absolute;
  width: var(--dot);
  height: var(--dot);
  z-index: 2;
}

/* Квадратики внутри верхней чёрной полосы рамки (как эталон) */
.emp-card__dot--tl1 {
  top: calc(var(--frame) / 2 - var(--dot) / 2);
  left: 18px;
  background: var(--lime);
}
.emp-card__dot--tl2 {
  top: calc(var(--frame) / 2 - var(--dot) / 2);
  left: 30px;
  background: var(--lime);
}
.emp-card__dot--tl3 {
  top: calc(var(--frame) / 2 - var(--dot) / 2);
  left: 42px;
  background: var(--purple);
}
.emp-card__dot--bl {
  bottom: calc(var(--frame) / 2 - var(--dot) / 2);
  left: 18px;
  background: var(--purple);
}
.emp-card__dot--br1 {
  bottom: calc(var(--frame) / 2 - var(--dot) / 2);
  right: 30px;
  background: var(--lime);
}
.emp-card__dot--br2 {
  bottom: calc(var(--frame) / 2 - var(--dot) / 2);
  right: 18px;
  background: var(--purple);
}

/* Лаймовый × в правом верхнем углу рамки (LOCKED-etalon-v1-close-avatar) */
.emp-card__close {
  position: absolute;
  top: calc(var(--frame) / 2 - 11px);
  right: 10px;
  z-index: 3;
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border: 0;
  background: var(--lime);
  color: var(--ink);
  font-size: 18px;
  font-weight: 800;
  line-height: 1;
  cursor: pointer;
  padding: 0;
}

.emp-card__close:hover {
  filter: brightness(0.97);
}

.emp-card__face {
  padding: 16px 18px 12px;
}

.emp-card__top {
  display: grid;
  grid-template-columns: 168px minmax(0, 1fr);
  gap: 14px 18px;
  align-items: start;
}

.emp-card__photo {
  width: 168px;
  height: 168px;
  border: 2px solid var(--ink);
  background: #fff;
  display: grid;
  place-items: center;
  overflow: hidden;
}

.emp-card__photo :deep(.user-avatar__img) {
  max-width: 100%;
  max-height: 168px;
  width: auto;
  height: auto;
  object-fit: contain;
}

.emp-card__badge {
  display: inline-block;
  margin: 0 0 8px;
  padding: 5px 9px;
  background: var(--ink);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  line-height: 1;
}

.emp-card__name {
  margin: 0 0 10px;
  font-family: var(--font-display, 'Unbounded', system-ui, sans-serif);
  font-size: clamp(1.2rem, 2.5vw, 1.65rem);
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: 0.01em;
  text-transform: uppercase;
  color: var(--ink);
}

.emp-card__fields {
  margin: 0;
}

.emp-card__field {
  display: grid;
  grid-template-columns: 7.8rem minmax(0, 1fr);
  gap: 8px;
  align-items: baseline;
  border-bottom: 1px solid rgba(17, 17, 17, 0.28);
  padding: 4px 0 3px;
}

.emp-card__field dt {
  margin: 0;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #5c5c5c;
}

.emp-card__field dd {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  text-align: right;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--ink);
  word-break: break-word;
}

.emp-card__rail {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1.5px solid var(--ink);
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 0 10px;
  overflow-x: auto;
}

.emp-card__rail-achs {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.emp-card__rail-label {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--ink);
  white-space: nowrap;
}

.emp-card__achs {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  gap: 4px;
}

.emp-card__ach {
  width: 26px;
  height: 26px;
  border: 1.5px solid var(--ink);
  background: #fff;
  display: grid;
  place-items: center;
  overflow: hidden;
  font-size: 11px;
  line-height: 1;
  flex: 0 0 auto;
}

.emp-card__ach--lime {
  background: var(--lime);
}

.emp-card__ach--purple {
  background: var(--purple);
  color: #fff;
}

.emp-card__ach img {
  width: 20px;
  height: 20px;
  object-fit: contain;
}

.emp-card__rail-sep {
  width: 1px;
  height: 16px;
  background: var(--ink);
  flex: 0 0 auto;
}

.emp-card__rail-ideas {
  font-size: 12px;
  font-weight: 700;
  color: var(--ink);
  white-space: nowrap;
}

.emp-card__rail-link {
  font-size: 12px;
  font-weight: 700;
  color: var(--purple);
  text-decoration: underline;
  text-underline-offset: 2px;
  background: none;
  border: 0;
  padding: 0;
  cursor: pointer;
  white-space: nowrap;
}

button.emp-card__rail-link:disabled {
  color: var(--purple);
  opacity: 1;
  cursor: default;
  text-decoration: underline;
}

.emp-card__rail-link--off {
  opacity: 0.4;
  text-decoration: none;
  cursor: default;
}

.emp-card__barcode {
  display: block;
  width: 100%;
  height: 28px;
  margin-top: 12px;
  object-fit: cover;
  object-position: left center;
  user-select: none;
  pointer-events: none;
}

@media (max-width: 560px) {
  .emp-card__top {
    grid-template-columns: 1fr;
  }

  .emp-card__photo {
    width: 120px;
    height: 120px;
  }

  .emp-card__field {
    grid-template-columns: 6.2rem minmax(0, 1fr);
  }
}
</style>
