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
        <div class="emp-card__frame" aria-hidden="true">
          <span class="emp-card__sq emp-card__sq--tl-a" />
          <span class="emp-card__sq emp-card__sq--tl-b" />
          <span class="emp-card__sq emp-card__sq--tl-c" />
          <span class="emp-card__sq emp-card__sq--bl" />
          <span class="emp-card__sq emp-card__sq--br-a" />
          <span class="emp-card__sq emp-card__sq--br-b" />
        </div>

        <button
          type="button"
          class="emp-card__close"
          aria-label="Закрыть"
          @click="closeEmployeeVisitingCard"
        >
          <span aria-hidden="true">×</span>
        </button>

        <div class="emp-card__inner">
          <div class="emp-card__body">
            <div class="emp-card__photo">
              <UserAvatar :user-id="avatarUserId" :name="employee.name" :size="148" />
            </div>

            <div class="emp-card__main">
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

          <div class="emp-card__footer">
            <div class="emp-card__achs-block">
              <span class="emp-card__achs-label">Достижения</span>
              <ul v-if="achievements.length" class="emp-card__achs" aria-label="Достижения">
                <li
                  v-for="(a, index) in achievements"
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
                    width="22"
                    height="22"
                  />
                  <span v-else class="emp-card__ach-emoji" aria-hidden="true">{{
                    a.emoji ?? '★'
                  }}</span>
                </li>
              </ul>
              <span v-else class="emp-card__achs-empty">—</span>
            </div>

            <span class="emp-card__divider" aria-hidden="true" />
            <span class="emp-card__ideas">Идеи: {{ ideasCount }}</span>
            <span class="emp-card__divider" aria-hidden="true" />

            <div class="emp-card__links">
              <button type="button" class="emp-card__link" title="Скоро" disabled>Вишлист</button>
              <a
                v-if="bitrixUrl"
                class="emp-card__link"
                :href="bitrixUrl"
                target="_blank"
                rel="noopener noreferrer"
              >
                Bitrix
              </a>
              <span v-else class="emp-card__link emp-card__link--muted">Bitrix</span>
            </div>
          </div>

          <div class="emp-card__barcode" aria-hidden="true">
            <span v-for="(bar, i) in barcodeBars" :key="i" :class="bar" />
          </div>
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

const barcodeBars = [
  'emp-card__bar emp-card__bar--wide',
  'emp-card__bar emp-card__bar--thin',
  'emp-card__bar emp-card__bar--mid',
  'emp-card__bar emp-card__bar--dot',
  'emp-card__bar emp-card__bar--thin',
  'emp-card__bar emp-card__bar--wide emp-card__bar--purple',
  'emp-card__bar emp-card__bar--mid',
  'emp-card__bar emp-card__bar--thin',
  'emp-card__bar emp-card__bar--gap',
  'emp-card__bar emp-card__bar--mid',
  'emp-card__bar emp-card__bar--thin',
  'emp-card__bar emp-card__bar--wide',
  'emp-card__bar emp-card__bar--dot emp-card__bar--purple',
  'emp-card__bar emp-card__bar--thin',
  'emp-card__bar emp-card__bar--mid',
  'emp-card__bar emp-card__bar--wide',
  'emp-card__bar emp-card__bar--thin',
  'emp-card__bar emp-card__bar--mid emp-card__bar--lime',
  'emp-card__bar emp-card__bar--thin',
  'emp-card__bar emp-card__bar--wide',
  'emp-card__bar emp-card__bar--dot',
  'emp-card__bar emp-card__bar--thin',
  'emp-card__bar emp-card__bar--mid',
  'emp-card__bar emp-card__bar--wide emp-card__bar--purple',
  'emp-card__bar emp-card__bar--thin'
] as const;

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
  const aw = rect.width || 640;
  const ah = rect.height || 320;
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
  --emp-lime: #ddf365;
  --emp-purple: #7451f4;
  --emp-ink: #111;
  --emp-bg: #eeeee8;
  position: fixed;
  z-index: 80;
  width: min(640px, calc(100vw - 24px));
  background: var(--emp-bg);
  border: 10px solid var(--emp-ink);
  border-radius: 10px;
  padding: 0;
  box-shadow: none;
  overflow: hidden;
}

.emp-card__frame {
  pointer-events: none;
}

.emp-card__sq {
  position: absolute;
  width: 10px;
  height: 10px;
  z-index: 2;
}

.emp-card__sq--tl-a {
  top: -10px;
  left: 14px;
  background: var(--emp-lime);
}
.emp-card__sq--tl-b {
  top: -10px;
  left: 28px;
  background: var(--emp-lime);
}
.emp-card__sq--tl-c {
  top: -10px;
  left: 42px;
  background: var(--emp-purple);
}
.emp-card__sq--bl {
  bottom: -10px;
  left: 14px;
  background: var(--emp-purple);
}
.emp-card__sq--br-a {
  bottom: -10px;
  right: 28px;
  background: var(--emp-lime);
}
.emp-card__sq--br-b {
  bottom: -10px;
  right: 14px;
  background: var(--emp-purple);
}

.emp-card__close {
  position: absolute;
  top: -7px;
  right: -7px;
  z-index: 3;
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border: 2px solid var(--emp-ink);
  background: var(--emp-lime);
  color: var(--emp-ink);
  font-size: 18px;
  font-weight: 800;
  line-height: 1;
  cursor: pointer;
  padding: 0;
}

.emp-card__close:hover {
  filter: brightness(0.97);
}

.emp-card__inner {
  padding: 18px 18px 10px;
}

.emp-card__body {
  display: grid;
  grid-template-columns: 148px minmax(0, 1fr);
  gap: 16px 18px;
  align-items: start;
}

.emp-card__photo {
  border: 2px solid var(--emp-ink);
  background: #fff;
  display: grid;
  place-items: center;
  width: 148px;
  height: 148px;
  overflow: hidden;
}

.emp-card__photo :deep(.user-avatar) {
  max-width: 100%;
  max-height: 100%;
}

.emp-card__photo :deep(.user-avatar__img) {
  max-width: 100%;
  max-height: 148px;
  width: auto;
  height: auto;
  object-fit: contain;
}

.emp-card__badge {
  display: inline-block;
  margin: 0 0 8px;
  padding: 4px 8px;
  background: var(--emp-ink);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  line-height: 1.2;
}

.emp-card__name {
  margin: 0 0 12px;
  font-family: var(--font-display, 'Unbounded', system-ui, sans-serif);
  font-size: clamp(1.15rem, 2.4vw, 1.55rem);
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--emp-ink);
}

.emp-card__fields {
  margin: 0;
  display: grid;
  gap: 0;
}

.emp-card__field {
  display: grid;
  grid-template-columns: 8.2rem minmax(0, 1fr);
  gap: 10px;
  align-items: baseline;
  border-bottom: 1px solid rgba(17, 17, 17, 0.22);
  padding: 5px 0 4px;
}

.emp-card__field dt {
  margin: 0;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #6a6a6a;
}

.emp-card__field dd {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  text-align: right;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--emp-ink);
  word-break: break-word;
}

.emp-card__footer {
  margin-top: 14px;
  padding-top: 10px;
  border-top: 2px solid var(--emp-ink);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 12px;
}

.emp-card__achs-block {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1 1 auto;
}

.emp-card__achs-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--emp-ink);
}

.emp-card__achs {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.emp-card__ach {
  width: 28px;
  height: 28px;
  border: 1.5px solid var(--emp-ink);
  background: #fff;
  display: grid;
  place-items: center;
  overflow: hidden;
}

.emp-card__ach--lime {
  background: var(--emp-lime);
}

.emp-card__ach--purple {
  background: var(--emp-purple);
}

.emp-card__ach img {
  width: 22px;
  height: 22px;
  object-fit: contain;
}

.emp-card__ach-emoji {
  font-size: 12px;
  line-height: 1;
  color: var(--emp-ink);
}

.emp-card__achs-empty {
  font-size: 12px;
  font-weight: 700;
  color: #888;
}

.emp-card__divider {
  width: 1px;
  height: 18px;
  background: var(--emp-ink);
  flex: 0 0 auto;
}

.emp-card__ideas {
  font-size: 12px;
  font-weight: 700;
  color: var(--emp-ink);
  white-space: nowrap;
}

.emp-card__links {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
}

.emp-card__link {
  font-size: 12px;
  font-weight: 700;
  color: var(--emp-purple);
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 3px;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
}

.emp-card__link:disabled,
.emp-card__link--muted {
  opacity: 0.45;
  cursor: not-allowed;
  text-decoration: none;
  color: #888;
}

a.emp-card__link {
  color: var(--emp-purple);
}

.emp-card__barcode {
  margin-top: 12px;
  height: 18px;
  display: flex;
  align-items: stretch;
  gap: 3px;
  padding: 2px 0 0;
  border-top: 1px solid rgba(17, 17, 17, 0.15);
}

.emp-card__bar {
  display: block;
  background: var(--emp-ink);
  align-self: stretch;
}

.emp-card__bar--wide {
  width: 14px;
}
.emp-card__bar--mid {
  width: 8px;
}
.emp-card__bar--thin {
  width: 3px;
}
.emp-card__bar--dot {
  width: 5px;
  align-self: center;
  height: 5px;
  border-radius: 0;
}
.emp-card__bar--gap {
  width: 10px;
  background: transparent;
}
.emp-card__bar--purple {
  background: var(--emp-purple);
}
.emp-card__bar--lime {
  background: var(--emp-lime);
}

@media (max-width: 560px) {
  .emp-card__body {
    grid-template-columns: 1fr;
  }

  .emp-card__photo {
    width: 112px;
    height: 112px;
  }

  .emp-card__field {
    grid-template-columns: 6.5rem minmax(0, 1fr);
  }

  .emp-card__links {
    margin-left: 0;
  }

  .emp-card__divider {
    display: none;
  }
}
</style>
