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
              <UserAvatar :user-id="avatarUserId" :name="employee.name" :size="128" />
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
              class="emp-card__rail-bitrix"
              :href="bitrixUrl"
              target="_blank"
              rel="noopener noreferrer"
              title="Профиль в Bitrix"
              aria-label="Открыть профиль в Bitrix"
            >
              <span class="emp-card__bitrix-arrow" aria-hidden="true">
                <svg viewBox="0 0 16 16" width="12" height="12" fill="none">
                  <path
                    d="M5 3.5h7.5V11M12.5 3.5 3.5 12.5"
                    stroke="currentColor"
                    stroke-width="1.7"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
              <span class="emp-card__rail-link">Bitrix</span>
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
import { bitrixEmployeeProfileUrl } from '~/utils/bitrixProfileUrl';
import { formatEmployeeShortName } from '~/utils/employeeName';

const { openEmployeeId, anchor, closeEmployeeVisitingCard } = useEmployeeVisitingCard();
const { findById, employees } = useEmployees();
const { ideas } = useIdeasBank();
const runtimeConfig = useRuntimeConfig();

const cardRef = ref<HTMLElement | null>(null);
const position = ref({ left: 0, top: 0 });

const upper = (value?: string | null) => (value || '').trim().toLocaleUpperCase('ru-RU');

const employee = computed(() => {
  const id = openEmployeeId.value;
  if (id == null) return null;
  return findById(id) ?? employees.value.find((e) => e.id === id) ?? null;
});

const displayName = computed(() => upper(formatEmployeeShortName(employee.value?.name ?? '')) || '—');

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
  const emp = employee.value;
  const bitrixId = emp?.bitrix_user_id ?? emp?.platform_user_id ?? null;
  return bitrixEmployeeProfileUrl(
    String(runtimeConfig.public.bitrixPortalUrl || 'https://crm.vbi.ru'),
    bitrixId
  );
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
  --frame: 7px;
  --dot: 7px;
  position: fixed;
  z-index: 80;
  width: min(540px, calc(100vw - 24px));
  background: var(--face);
  border: var(--frame) solid var(--ink);
  border-radius: 10px;
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
  left: 12px;
  background: var(--lime);
}
.emp-card__dot--tl2 {
  top: calc(var(--frame) / 2 - var(--dot) / 2);
  left: 22px;
  background: var(--lime);
}
.emp-card__dot--tl3 {
  top: calc(var(--frame) / 2 - var(--dot) / 2);
  left: 32px;
  background: var(--purple);
}
.emp-card__dot--bl {
  bottom: calc(var(--frame) / 2 - var(--dot) / 2);
  left: 12px;
  background: var(--purple);
}
.emp-card__dot--br1 {
  bottom: calc(var(--frame) / 2 - var(--dot) / 2);
  right: 22px;
  background: var(--lime);
}
.emp-card__dot--br2 {
  bottom: calc(var(--frame) / 2 - var(--dot) / 2);
  right: 12px;
  background: var(--purple);
}

/* Лаймовый × в правом верхнем углу рамки (LOCKED-etalon-v1-close-avatar) */
.emp-card__close {
  position: absolute;
  top: calc(var(--frame) / 2 - 9px);
  right: 8px;
  z-index: 3;
  width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  border: 0;
  background: var(--lime);
  color: var(--ink);
  font-size: 15px;
  font-weight: 800;
  line-height: 1;
  cursor: pointer;
  padding: 0;
}

.emp-card__close:hover {
  filter: brightness(0.97);
}

.emp-card__face {
  padding: 12px 14px 10px;
}

.emp-card__top {
  display: grid;
  grid-template-columns: 128px minmax(0, 1fr);
  gap: 10px 14px;
  align-items: start;
}

.emp-card__photo {
  width: 128px;
  height: 128px;
  border: 1.5px solid var(--ink);
  background: #fff;
  display: grid;
  place-items: center;
  overflow: hidden;
}

.emp-card__photo :deep(.user-avatar__img) {
  max-width: 100%;
  max-height: 128px;
  width: auto;
  height: auto;
  object-fit: contain;
}

.emp-card__badge {
  display: inline-block;
  margin: 0 0 6px;
  padding: 4px 7px;
  background: var(--ink);
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  line-height: 1;
}

.emp-card__name {
  margin: 0 0 8px;
  font-family: var(--font-display, 'Unbounded', system-ui, sans-serif);
  font-size: clamp(1.05rem, 2.2vw, 1.35rem);
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
  grid-template-columns: 7rem minmax(0, 1fr);
  gap: 6px;
  align-items: baseline;
  border-bottom: 1px solid rgba(17, 17, 17, 0.28);
  padding: 3px 0 2px;
}

.emp-card__field dt {
  margin: 0;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #5c5c5c;
}

.emp-card__field dd {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  text-align: right;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--ink);
  word-break: break-word;
}

.emp-card__rail {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1.5px solid var(--ink);
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 0 8px;
  /* иначе квадрат ↗ у правого края обрезался overflow-x */
  overflow: visible;
}

.emp-card__rail-achs {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1 1 auto;
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
  width: 22px;
  height: 22px;
  border: 1.5px solid var(--ink);
  background: #fff;
  display: grid;
  place-items: center;
  overflow: hidden;
  font-size: 10px;
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
  width: 16px;
  height: 16px;
  object-fit: contain;
}

.emp-card__rail-sep {
  width: 1px;
  height: 16px;
  background: var(--ink);
  flex: 0 0 auto;
}

.emp-card__rail-ideas {
  font-size: 11px;
  font-weight: 700;
  color: var(--ink);
  white-space: nowrap;
}

.emp-card__rail-link {
  font-size: 11px;
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

.emp-card__rail-bitrix {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex: 0 0 auto;
  text-decoration: none;
  color: inherit;
}

.emp-card__rail-bitrix:hover .emp-card__bitrix-arrow {
  background: var(--lime);
  transform: translate(-1px, -1px);
  box-shadow: 2px 2px 0 var(--ink);
}

.emp-card__rail-bitrix:focus-visible {
  outline: none;
}

.emp-card__rail-bitrix:focus-visible .emp-card__bitrix-arrow {
  outline: 2px solid var(--purple);
  outline-offset: 2px;
}

/* Тот же квадрат со стрелкой ↗, что у ФИО на чужом профиле */
.emp-card__bitrix-arrow {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: 1.5px solid var(--ink);
  border-radius: 5px;
  background: #fff;
  color: var(--ink);
  box-shadow: 1.5px 1.5px 0 var(--ink);
  transition: transform 0.12s ease, box-shadow 0.12s ease, background-color 0.12s ease;
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
  height: 22px;
  margin-top: 10px;
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
    width: 96px;
    height: 96px;
  }

  .emp-card__field {
    grid-template-columns: 5.8rem minmax(0, 1fr);
  }
}
</style>
