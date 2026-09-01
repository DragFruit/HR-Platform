<template>
  <!-- P0: акцентный первый экран -->
  <section class="creative-hero profile-screen-hero section-card">
    <div class="profile-screen-hero__squares" aria-hidden="true">
      <span class="profile-screen-hero__sq profile-screen-hero__sq--lime" />
      <span class="profile-screen-hero__sq profile-screen-hero__sq--purple" />
      <span class="profile-screen-hero__sq profile-screen-hero__sq--lime" />
      <span class="profile-screen-hero__sq profile-screen-hero__sq--purple" />
      <span class="profile-screen-hero__sq profile-screen-hero__sq--purple" />
      <span class="profile-screen-hero__sq profile-screen-hero__sq--lime" />
      <span class="profile-screen-hero__sq profile-screen-hero__sq--purple" />
      <span class="profile-screen-hero__sq profile-screen-hero__sq--lime" />
    </div>

    <div class="profile-screen-hero__orb" aria-hidden="true" />

    <div class="profile-screen-hero__grid">
      <div class="profile-screen-hero__identity">
        <div class="profile-identity__main">
          <button
            v-if="user && isOwnProfile"
            type="button"
            class="profile-identity__avatar-btn"
            :aria-expanded="showPicker"
            aria-label="Сменить аватар"
            @click="showPicker = !showPicker"
          >
            <UserAvatar :user-id="profileAvatarUserId" :name="profileDisplayName" :size="168" />
          </button>
          <div v-else class="profile-identity__avatar-static">
            <UserAvatar :user-id="profileAvatarUserId" :name="profileDisplayName" :size="168" />
          </div>

          <div class="profile-identity__body">
            <div class="profile-identity__name-row">
              <h2>{{ profileDisplayName }}</h2>
              <a
                v-if="bitrixProfileHref"
                :href="bitrixProfileHref"
                class="profile-identity__bitrix-link"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Открыть профиль в Bitrix"
                title="Профиль в Bitrix"
              >
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
                  <path
                    d="M5 3.5h7.5V11M12.5 3.5 3.5 12.5"
                    stroke="currentColor"
                    stroke-width="1.7"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </a>
            </div>
            <ul
              v-if="isOwnProfile && !achievementsLocked && profileBadges.length"
              class="profile-identity__badges"
              :aria-label="`Достижения: ${profileBadges.length}`"
            >
              <li
                v-for="achievement in profileBadges"
                :key="achievement.id"
                class="profile-achievement-chip"
                :title="achievement.title"
              >
                <img
                  v-if="achievement.imageSrc"
                  :src="achievement.imageSrc"
                  :alt="achievement.title"
                  class="profile-achievement-chip__img"
                  width="28"
                  height="28"
                  loading="lazy"
                />
                <span v-else class="profile-achievement-chip__emoji" aria-hidden="true">
                  {{ achievement.emoji ?? '🏆' }}
                </span>
              </li>
            </ul>
            <p v-if="jobTitle || departmentName" class="profile-identity__meta">
              <span v-if="jobTitle" class="profile-identity__title-pill">{{ jobTitle }}</span>
              <span v-if="departmentName" class="profile-identity__department">{{ departmentName }}</span>
            </p>
          </div>
        </div>
      </div>

      <div class="profile-stat-collage profile-screen-hero__stats" aria-label="Ключевые показатели">
        <NuxtLink
          to="/vacations"
          class="profile-stat-tile profile-stat-tile--hero profile-vacation-calendar"
        >
          <span class="profile-vacation-calendar__shell">
            <span class="profile-vacation-calendar__rings" aria-hidden="true">
              <span class="profile-vacation-calendar__ring" />
              <span class="profile-vacation-calendar__ring" />
              <span class="profile-vacation-calendar__ring" />
            </span>
            <span class="profile-vacation-calendar__binder" aria-hidden="true">
              <span class="profile-vacation-calendar__hole" />
              <span class="profile-vacation-calendar__hole" />
              <span class="profile-vacation-calendar__hole" />
            </span>
            <span class="profile-vacation-calendar__page">
              <span class="profile-stat-tile__value">{{ vacationStat.value }}</span>
              <span class="profile-stat-tile__label">дней отпуска</span>
              <span v-if="vacationStat.planned > 0" class="profile-stat-tile__hint">
                {{ vacationStat.planned }} в плане
              </span>
              <span class="profile-vacation-calendar__curl" aria-hidden="true">
                <svg
                  class="profile-vacation-calendar__curl-svg"
                  viewBox="0 0 72 72"
                  width="72"
                  height="72"
                  fill="none"
                >
                  <path
                    class="profile-vacation-calendar__curl-under"
                    d="M0 72V18C18 34 38 50 72 72H0Z"
                  />
                  <path
                    class="profile-vacation-calendar__curl-shade"
                    d="M0 72V22C16 36 34 52 68 72H0Z"
                  />
                  <path
                    class="profile-vacation-calendar__curl-sheet"
                    d="M0 72V28C14 40 30 54 60 72H0Z"
                  />
                  <path
                    class="profile-vacation-calendar__curl-rim"
                    d="M0 28C14 40 30 54 60 72"
                    stroke-linecap="round"
                  />
                </svg>
              </span>
            </span>
          </span>
        </NuxtLink>

        <NuxtLink to="/ideas" class="profile-stat-tile profile-stat-tile--ideas">
          <span class="profile-stat-tile__value">{{ ideasProfileCount }}</span>
          <span class="profile-stat-tile__label">{{ isOwnProfile ? 'мои идеи' : 'идеи' }}</span>
        </NuxtLink>

        <NuxtLink
          :to="spotlightStat.to"
          class="profile-stat-tile profile-stat-tile--secondary"
          :class="[
            spotlightStat.tone ? `profile-stat-tile--${spotlightStat.tone}` : undefined,
            spotlightStat.kind === 'vacation-soon' ? 'profile-stat-tile--vacation-soon' : undefined,
            spotlightStat.kind === 'vacation-quest' ? 'profile-stat-tile--vacation-quest' : undefined,
            spotlightStat.kind === 'idea-tease' ? 'profile-stat-tile--idea-tease' : undefined
          ]"
        >
          <template v-if="spotlightStat.kind === 'vacation-quest'">
            <img
              class="profile-stat-tile__quest-reward"
              :src="vacationQuestRewardSrc"
              alt=""
              aria-hidden="true"
              width="80"
              height="80"
              loading="lazy"
            />
            <span class="profile-stat-tile__quest-sq profile-stat-tile__quest-sq--tl" aria-hidden="true" />
            <span class="profile-stat-tile__quest-sq profile-stat-tile__quest-sq--br" aria-hidden="true" />
            <span class="profile-stat-tile__value profile-stat-tile__value--quest">{{ spotlightStat.value }}</span>
            <span class="profile-stat-tile__label profile-stat-tile__label--quest">{{ spotlightStat.label }}</span>
            <span class="profile-stat-tile__quest-spark" aria-hidden="true">✦</span>
          </template>
          <template v-else-if="spotlightStat.kind === 'vacation-soon'">
            <img
              class="profile-stat-tile__soon-art"
              :src="VACATION_SOON_ART_SRC"
              alt=""
              aria-hidden="true"
              width="108"
              height="108"
              loading="lazy"
            />
            <span class="profile-stat-tile__soon-sq profile-stat-tile__soon-sq--tl" aria-hidden="true" />
            <span class="profile-stat-tile__soon-sq profile-stat-tile__soon-sq--br" aria-hidden="true" />
            <span class="profile-stat-tile__value profile-stat-tile__value--soon">{{ spotlightStat.value }}</span>
            <span class="profile-stat-tile__label profile-stat-tile__label--soon">{{ spotlightStat.label }}</span>
          </template>
          <template v-else-if="spotlightStat.kind === 'idea-tease'">
            <img
              class="profile-stat-tile__idea-art"
              :src="IDEA_TEASE_ART_SRC"
              alt=""
              aria-hidden="true"
              width="108"
              height="108"
              loading="lazy"
            />
            <span class="profile-stat-tile__idea-sq profile-stat-tile__idea-sq--tl" aria-hidden="true" />
            <span class="profile-stat-tile__idea-sq profile-stat-tile__idea-sq--br" aria-hidden="true" />
            <span class="profile-stat-tile__value profile-stat-tile__value--idea">{{ spotlightStat.value }}</span>
            <span class="profile-stat-tile__label profile-stat-tile__label--idea">{{ spotlightStat.label }}</span>
          </template>
          <template v-else>
            <span class="profile-stat-tile__value">{{ spotlightStat.value }}</span>
            <span class="profile-stat-tile__label">{{ spotlightStat.label }}</span>
          </template>
        </NuxtLink>
      </div>
    </div>

    <nav
      v-if="profileBarLinks.length"
      class="profile-screen-hero__bar"
      aria-label="Разделы профиля"
    >
      <template v-for="(link, index) in profileBarLinks" :key="link.to">
        <span v-if="index > 0" aria-hidden="true">·</span>
        <NuxtLink :to="link.to">{{ link.label }}</NuxtLink>
      </template>
    </nav>
  </section>

  <!-- P1–P2: второй экран — ачивки + команда + активность в одном fold -->
  <div
    class="profile-grid-2"
    :class="{
      'profile-grid-2--own': isOwnProfile,
      'profile-grid-2--compact-team': isCompactTeamLayout
    }"
  >
    <section
      v-if="isOwnProfile"
      class="card profile-itmo-panel profile-achievements-preview profile-slot profile-slot--achievements"
      :class="{ 'profile-achievements-preview--locked': achievementsLocked }"
      :aria-label="achievementsLocked ? 'Ачивки — скоро откроются' : 'Ачивки'"
    >
      <span class="profile-itmo-panel__sq profile-itmo-panel__sq--tl" aria-hidden="true" />
      <span class="profile-itmo-panel__sq profile-itmo-panel__sq--tr" aria-hidden="true" />
      <span class="profile-itmo-panel__sq profile-itmo-panel__sq--bl" aria-hidden="true" />
      <span class="profile-itmo-panel__sq profile-itmo-panel__sq--br" aria-hidden="true" />

      <div class="profile-achievements-preview__head">
        <h3 class="profile-itmo-panel__title">Ачивки</h3>
        <p v-if="achievementsLocked" class="profile-achievements-preview__soon">
          <svg class="profile-achievements-preview__lock" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="3.5" y="7" width="9" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5" />
            <path
              d="M5.5 7V5.5a2.5 2.5 0 0 1 5 0V7"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
          <span>Скоро откроются</span>
        </p>
        <button
          v-else
          type="button"
          class="profile-achievements-preview__all"
          @click="achievementsOpen = true"
        >
          {{ `Все · ${catalogForProfile.length}` }}
        </button>
      </div>
      <div
        v-if="!achievementsLocked"
        ref="achievementsPreviewRef"
        class="profile-achievements-preview__track"
      >
        <button
          v-for="item in previewAchievements"
          :key="item.id"
          type="button"
          class="profile-achievements-preview__item"
          :class="{
            'profile-achievements-preview__item--round': item.previewRound
          }"
          :title="item.title"
          @click="achievementsOpen = true"
        >
          <img
            v-if="item.imageSrc"
            :src="item.imageSrc"
            :alt="item.title"
            class="profile-achievements-preview__img"
            width="44"
            height="44"
            loading="lazy"
          />
          <span v-else class="profile-achievements-preview__emoji" aria-hidden="true">
            {{ item.emoji ?? '🏆' }}
          </span>
        </button>
        <p v-if="!previewAchievements.length" class="muted profile-achievements-preview__empty">
          Пока нет полученных — открой «Все», чтобы посмотреть каталог
        </p>
      </div>
      <div v-else class="profile-achievements-preview__locked-body" aria-hidden="true">
        <span
          v-for="n in 6"
          :key="n"
          class="profile-achievements-preview__ghost"
        />
      </div>
    </section>

    <section
      v-if="isOwnProfile"
      class="card profile-itmo-panel profile-activity profile-slot profile-slot--activity"
      aria-label="Недавняя активность"
    >
      <span class="profile-itmo-panel__sq profile-itmo-panel__sq--tl" aria-hidden="true" />
      <span class="profile-itmo-panel__sq profile-itmo-panel__sq--tr" aria-hidden="true" />
      <span class="profile-itmo-panel__sq profile-itmo-panel__sq--bl" aria-hidden="true" />
      <span class="profile-itmo-panel__sq profile-itmo-panel__sq--br" aria-hidden="true" />

      <h3 class="profile-itmo-panel__title">Недавняя активность</h3>
      <div
        ref="activityScrollRef"
        class="profile-activity__scroll"
        :style="activityScrollStyle"
      >
        <ul
          v-if="profileActivity.length"
          ref="activityListRef"
          class="list-reset profile-activity__list"
        >
          <li
            v-for="item in profileActivity"
            :key="item.id"
            class="profile-activity__row"
            :data-kind="item.kind"
          >
            <img
              :src="item.iconSrc"
              :alt="item.kindLabel"
              class="profile-activity__icon"
              width="40"
              height="40"
              loading="lazy"
            />
            <div class="profile-activity__body">
              <p class="profile-activity__text">{{ item.text }}</p>
              <div class="profile-activity__meta">
                <span
                  class="profile-activity__badge"
                  :class="
                    item.badgeTone === 'purple'
                      ? 'profile-activity__badge--purple'
                      : 'profile-activity__badge--lime'
                  "
                >{{ item.kindLabel }}</span>
                <span class="profile-activity__time">{{ item.timeLabel }}</span>
              </div>
            </div>
          </li>
        </ul>
        <p v-else class="muted profile-activity__empty">
          Пока тихо — события появятся сами чуть позже.
        </p>
      </div>
    </section>

    <section
      class="card profile-team profile-hub-card--compact profile-slot profile-slot--team"
      :class="{ 'profile-team--wide': !isOwnProfile }"
    >
      <h3 class="profile-hub-card__title profile-team__title">{{ teamTitle }}</h3>

      <div v-if="teamDisplayMembers.length" class="profile-team__scroll">
        <ul class="profile-team__row">
          <li
            v-for="member in teamDisplayMembers"
            :key="member.id"
            class="profile-team__member"
            :class="{ 'profile-team__member--manager': member.isManager }"
          >
            <button
              type="button"
              class="profile-team__member-link"
              @click="openEmployeeVisitingCard(member, $event)"
            >
              <div class="profile-team__avatar-wrap" :title="member.isManager ? 'Руководитель' : undefined">
                <UserAvatar :user-id="member.platform_user_id" :name="member.name" :size="48" />
                <span v-if="member.isManager" class="profile-team__manager-badge" aria-hidden="true">★</span>
              </div>
              <span class="profile-team__name">{{ member.name }}</span>
            </button>
          </li>
        </ul>
      </div>

      <p v-else class="muted profile-team__empty">{{ teamEmptyText }}</p>
    </section>
  </div>

  <Teleport to="body">
    <div
      v-if="achievementsOpen && isOwnProfile && !achievementsLocked"
      class="org-confirm-overlay profile-achievements-overlay"
      role="presentation"
      @click.self="achievementsOpen = false"
    >
      <div
        class="card profile-achievements-overlay__panel"
        role="dialog"
        aria-modal="true"
        aria-label="Все ачивки"
        @click.stop
      >
        <div class="profile-achievements-overlay__head">
          <div>
            <h3 class="org-confirm-title">Ачивки</h3>
            <p class="muted soft">
              Получено {{ earnedCount }} из {{ catalogForProfile.length }}
            </p>
          </div>
          <button
            type="button"
            class="admin-notifications-bell__dismiss"
            aria-label="Закрыть"
            @click="achievementsOpen = false"
          >
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
              <path
                d="M4 4l8 8M12 4 4 12"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </div>
        <div class="profile-achievements-overlay__body">
          <section
            v-for="group in catalogSectionsForProfile"
            :key="group.section"
            class="profile-achievements-overlay__section"
            :aria-labelledby="`ach-section-${group.section}`"
          >
            <div class="profile-achievements-overlay__section-head">
              <h4 :id="`ach-section-${group.section}`" class="profile-achievements-overlay__section-title">
                {{ group.title }}
              </h4>
              <span class="profile-achievements-overlay__section-count muted">
                {{ group.earnedCount }} / {{ group.items.length }}
              </span>
            </div>
            <ul class="list-reset profile-achievements-overlay__grid">
              <li
                v-for="item in group.items"
                :key="item.id"
                class="profile-achievements-overlay__card"
                :class="{
                  'profile-achievements-overlay__card--locked': !item.earned,
                  'profile-achievements-overlay__card--round': item.previewRound
                }"
              >
                <div class="profile-achievements-overlay__icon">
                  <img
                    v-if="item.imageSrc"
                    :src="item.imageSrc"
                    :alt="item.title"
                    width="64"
                    height="64"
                    loading="lazy"
                  />
                  <span v-else aria-hidden="true">{{ item.emoji ?? '🏆' }}</span>
                </div>
                <strong>{{ item.title }}</strong>
                <span v-if="item.subtitle" class="muted">{{ item.subtitle }}</span>
                <span class="profile-achievements-overlay__status">
                  {{ item.earned ? 'Получена' : 'Ещё впереди' }}
                </span>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  </Teleport>

  <Teleport to="body">
    <div
      v-if="showPicker && user && isOwnProfile"
      class="org-confirm-overlay profile-avatar-picker-overlay"
      role="presentation"
      @click.self="showPicker = false"
    >
      <div
        class="card profile-avatar-picker-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Выбор персонажа"
        @click.stop
      >
        <div class="profile-avatar-picker-panel__head">
          <h3 class="org-confirm-title">Выберите персонажа</h3>
          <button
            type="button"
            class="admin-notifications-bell__dismiss"
            aria-label="Закрыть"
            @click="showPicker = false"
          >
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4 4 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
            </svg>
          </button>
        </div>
        <div class="avatar-picker-grid profile-avatar-picker-panel__grid">
          <button
            v-for="characterId in AVATAR_CHARACTER_IDS"
            :key="characterId"
            type="button"
            class="avatar-picker-item"
            :class="{ selected: currentAvatarId === characterId }"
            @click="pickAvatar(characterId)"
          >
            <img :src="avatarImageUrl(characterId)" :alt="`Персонаж ${characterId}`" loading="lazy" />
          </button>
        </div>
        <div class="org-confirm-actions row">
          <button type="button" class="button ghost" @click="showPicker = false">Отмена</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { AvatarCharacterId } from '~/composables/useAvatars';
import { calcEmployeeBalance } from '~/utils/vacationBalance';
import type { VacationRequest } from '~/composables/useVacations';
import { profileTeamHeading } from '~/utils/profileTeamTitle';
import {
  findUpcomingVacationWithinDays,
  formatVacationStartShort
} from '~/utils/profileSpotlight';
import { bitrixEmployeeProfileUrl } from '~/utils/bitrixProfileUrl';
import type { Employee } from '~/composables/useEmployees';

const VACATION_QUEST_TEASE_SRC = '/images/profile/quest-gift-tease.svg';
const VACATION_SOON_ART_SRC = '/images/profile/vacation-soon-palm.png?v=4';
const IDEA_TEASE_ART_SRC = '/images/profile/idea-tease.png?v=4';

type TeamMemberView = Employee & { isManager: boolean };

const route = useRoute();
const runtimeConfig = useRuntimeConfig();
const { user } = useAuth();
const { profileTeamForUser, findByUserId, managerForEmployee, employees } = useEmployees();
const { openEmployeeVisitingCard } = useEmployeeVisitingCard();
const { AVATAR_CHARACTER_IDS, avatarImageUrl, getAvatarId, setAvatarId } = useAvatars();
const { ideas, hydrate: hydrateIdeasBank } = useIdeasBank();
const { isProduction } = useAppEnv();
const { myCoupons, hydrate: hydrateCoupons } = useTenureCoupons();
const { employeeRequests, hydrate: hydrateVacations } = useVacations();
const { profileBadges, catalogForProfile, catalogSectionsForProfile, catalogForProfilePreview, earnedCount } =
  useAchievements();
const { isEnabled: vacationTrainingEnabled, isCompletedForCurrentUser } = useVacationTraining();
const {
  hydrate: hydrateActivity,
  activityFor
} = useProfileActivity();

/** На бое ачивки пока закрыты — открываем только по явной команде. */
const achievementsLocked = computed(() => isProduction.value);

const showPicker = ref(false);
const achievementsOpen = ref(false);
const achievementsPreviewRef = ref<HTMLElement | null>(null);
const achievementsVisibleCount = ref(8);
const activityScrollRef = ref<HTMLElement | null>(null);
const activityListRef = ref<HTMLElement | null>(null);
const activityScrollMaxHeight = ref<number | null>(null);

/** Высота поля = 6.5 строк (только чужой профиль без fold-сетки). */
const ACTIVITY_SLOT_ROWS = 6.5;
const ACTIVITY_ROW_FALLBACK_PX = 72;

const activityScrollStyle = computed(() => {
  /* Свой профиль: высоту даёт второй экран (CSS fold), не фиксированные 6.5 строк */
  if (isOwnProfile.value) return {};
  const height = activityScrollMaxHeight.value ?? Math.round(ACTIVITY_ROW_FALLBACK_PX * ACTIVITY_SLOT_ROWS);
  return {
    height: `${height}px`,
    minHeight: `${height}px`,
    maxHeight: `${height}px`
  };
});

const measureActivityScroll = () => {
  const list = activityListRef.value;
  const row = list?.querySelector<HTMLElement>('.profile-activity__row');
  const rowH = row?.offsetHeight || ACTIVITY_ROW_FALLBACK_PX;
  activityScrollMaxHeight.value = Math.max(1, Math.round(rowH * ACTIVITY_SLOT_ROWS));
};

const PREVIEW_ICON = 48;
const PREVIEW_GAP = 10;
const PREVIEW_ROWS = 2;

const previewAchievements = computed(() =>
  catalogForProfilePreview.value.slice(0, achievementsVisibleCount.value)
);

const measureAchievementsPreview = () => {
  const el = achievementsPreviewRef.value;
  if (!el) return;
  const width = el.clientWidth;
  if (width <= 0) return;
  const cols = Math.max(1, Math.floor((width + PREVIEW_GAP) / (PREVIEW_ICON + PREVIEW_GAP)));
  achievementsVisibleCount.value = cols * PREVIEW_ROWS;
};

let achievementsResizeObserver: ResizeObserver | null = null;
let activityResizeObserver: ResizeObserver | null = null;

const onAchievementsKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && achievementsOpen.value) achievementsOpen.value = false;
};

/** Чужой профиль: /profile?user={platform_user_id|bitrix_user_id} */
const viewedUserId = computed(() => {
  const raw = route.query.user;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
});

const isOwnProfile = computed(
  () => !viewedUserId.value || viewedUserId.value === user.value?.id
);

/** Временно: чужие профили недоступны — сбрасываем ?user= на свой. */
watch(
  [viewedUserId, () => user.value?.id],
  ([otherId, selfId]) => {
    if (!otherId) return;
    if (selfId && otherId === selfId) return;
    navigateTo('/profile', { replace: true });
  },
  { immediate: true }
);

const findEmployeeByAnyUserId = (userId: number) =>
  employees.value.find(
    (emp) => emp.platform_user_id === userId || emp.bitrix_user_id === userId
  ) ?? null;

const profileEmployee = computed(() => {
  if (isOwnProfile.value) {
    return user.value ? findByUserId(user.value.id) : null;
  }
  return viewedUserId.value ? findEmployeeByAnyUserId(viewedUserId.value) : null;
});

const profileActivity = computed(() =>
  activityFor({
    employeeId: profileEmployee.value?.id ?? null,
    platformUserId:
      (isOwnProfile.value ? user.value?.id : null) ??
      profileEmployee.value?.platform_user_id ??
      profileEmployee.value?.bitrix_user_id ??
      viewedUserId.value
  })
);

watch(
  profileActivity,
  () => {
    nextTick(() => {
      measureActivityScroll();
      const list = activityListRef.value;
      if (!list || typeof ResizeObserver === 'undefined') return;
      activityResizeObserver?.disconnect();
      activityResizeObserver = new ResizeObserver(() => measureActivityScroll());
      activityResizeObserver.observe(list);
    });
  },
  { flush: 'post' }
);

const profileDisplayName = computed(
  () => profileEmployee.value?.name?.trim() || (isOwnProfile.value ? user.value?.name : null) || 'Сотрудник'
);

const profileAvatarUserId = computed(() => {
  if (isOwnProfile.value) return user.value?.id ?? null;
  return (
    profileEmployee.value?.platform_user_id ??
    profileEmployee.value?.bitrix_user_id ??
    viewedUserId.value
  );
});

const bitrixProfileHref = computed(() => {
  if (isOwnProfile.value) return null;
  const emp = profileEmployee.value;
  const bitrixId = emp?.bitrix_user_id ?? emp?.platform_user_id ?? viewedUserId.value;
  return bitrixEmployeeProfileUrl(
    String(runtimeConfig.public.bitrixPortalUrl || ''),
    bitrixId
  );
});

const currentAvatarId = computed(() => (user.value ? getAvatarId(user.value.id) : null));

const myEmployee = computed(() => profileEmployee.value);

/** Должность и отдел — без стажа и «регалий». */
const jobTitle = computed(() => myEmployee.value?.title?.trim() ?? '');
const departmentName = computed(() => {
  const fromEmp = myEmployee.value?.department?.trim() || '';
  if (fromEmp) return fromEmp;
  if (isOwnProfile.value) return user.value?.department?.trim() || '';
  return '';
});

/** Подстраницы профиля, которых нет в боковом меню — на prod пока скрываем. */
const profileBarLinks = computed((): { to: string; label: string }[] => {
  if (isProduction.value || !isOwnProfile.value) return [];
  return [];
});

const profileTeam = computed(() => {
  if (isOwnProfile.value) return profileTeamForUser(user.value);
  const emp = profileEmployee.value;
  const department = emp?.department?.trim() || '';
  if (!department || !emp) {
    return { mode: 'department' as const, department: '', members: [] as Employee[] };
  }
  const members = employees.value
    .filter(
      (row) =>
        row.department.trim() === department &&
        row.name.trim() &&
        row.id !== emp.id
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  return { mode: 'department' as const, department, members };
});

const teamMembers = computed(() => profileTeam.value.members);

const myManager = computed(() => managerForEmployee(myEmployee.value));
const managerName = computed(() => myManager.value?.name.trim() ?? '');

const teamDisplayMembers = computed((): TeamMemberView[] => {
  const selfId = myEmployee.value?.id;
  const managerFromDirectory = myManager.value;
  const mgrName = managerName.value;

  let list = [...teamMembers.value];

  if (
    managerFromDirectory &&
    managerFromDirectory.id !== selfId &&
    !list.some((m) => m.id === managerFromDirectory.id)
  ) {
    list = [managerFromDirectory, ...list];
  }

  return list
    .map((member) => ({
      ...member,
      isManager: Boolean(mgrName && member.name.trim() === mgrName)
    }))
    .sort((a, b) => {
      if (a.isManager !== b.isManager) return a.isManager ? -1 : 1;
      return a.name.localeCompare(b.name, 'ru');
    });
});

/** ≤5 коллег в блоке → команда под ачивками, активность справа. */
const isCompactTeamLayout = computed(
  () => isOwnProfile.value && teamDisplayMembers.value.length <= 5
);

const teamTitle = computed(() => profileTeamHeading(profileTeam.value.department));

const ideasProfileCount = computed(() => {
  const uid =
    (isOwnProfile.value ? user.value?.id : null) ??
    profileEmployee.value?.platform_user_id ??
    profileEmployee.value?.bitrix_user_id ??
    viewedUserId.value;
  if (!uid) return 0;
  return ideas.value.filter((idea) => idea.authorUserId === uid).length;
});

const vacationQuestRewardSrc = VACATION_QUEST_TEASE_SRC;

type ProfileSpotlightStat = {
  kind: 'vacation-soon' | 'vacation-quest' | 'idea-tease' | 'default';
  value: string | number;
  label: string;
  to: string;
  tone?: 'lime' | 'accent';
};

const PROFILE_SPOTLIGHT_COMPLIMENTS = [
  { value: 'Молодец!', label: 'так держать' },
  { value: 'Отлично!', label: 'ты на волне' },
  { value: 'Класс!', label: 'продолжаем' },
  { value: 'Супер!', label: 'всё идёт хорошо' },
  { value: 'Красота!', label: 'хороший ритм' },
  { value: 'Браво!', label: 'приятно заходить' }
] as const;

const myVacationRequests = computed(() => {
  const name = myEmployee.value?.name ?? (isOwnProfile.value ? user.value?.name : '') ?? '';
  if (!name) return [];
  const year = new Date().getFullYear();
  return [...employeeRequests(name, year), ...employeeRequests(name, year + 1)];
});

const upcomingVacationSoon = computed(() =>
  findUpcomingVacationWithinDays(myVacationRequests.value, 14)
);

const spotlightStat = computed((): ProfileSpotlightStat => {
  if (!isOwnProfile.value) {
    return {
      kind: 'default',
      value: ideasProfileCount.value,
      label: 'идеи',
      to: '/ideas'
    };
  }

  const soon = upcomingVacationSoon.value;
  if (soon) {
    return {
      kind: 'vacation-soon',
      value: formatVacationStartShort(soon.start),
      label: 'отпуск начнётся',
      to: '/vacations'
    };
  }

  const coupon = myCoupons.value.find((c) => c.status === 'available');
  if (coupon) {
    return { kind: 'default', value: coupon.years, label: 'лет · купон', to: '/store', tone: 'lime' };
  }

  if (vacationTrainingEnabled.value && !isCompletedForCurrentUser.value) {
    return {
      kind: 'vacation-quest',
      value: 'Начать квест',
      label: 'график отпусков',
      to: '/vacations'
    };
  }

  if (ideasProfileCount.value === 0) {
    return {
      kind: 'idea-tease',
      value: 'Есть идея?',
      label: '+ предложи',
      to: '/ideas'
    };
  }

  const dayKey = new Date().toISOString().slice(0, 10);
  const base = `${user.value?.id ?? 0}-${dayKey}`;
  let hash = 0;
  for (let i = 0; i < base.length; i++) hash = (hash * 31 + base.charCodeAt(i)) % 10_000;
  const pick = PROFILE_SPOTLIGHT_COMPLIMENTS[hash % PROFILE_SPOTLIGHT_COMPLIMENTS.length]!;
  return { kind: 'default', ...pick, to: '/profile' };
});

const vacationStat = computed(() => {
  const emp = myEmployee.value;
  const name = emp?.name ?? (isOwnProfile.value ? user.value?.name : '') ?? '';
  if (!name || !emp?.hired_at) {
    return { value: '—', planned: 0 };
  }
  const year = new Date().getFullYear();
  const byId = new Map<number, VacationRequest>();
  for (const yr of [year - 1, year, year + 1]) {
    for (const req of employeeRequests(name, yr)) {
      byId.set(req.id, req);
    }
  }
  const requests = [...byId.values()];
  const result = calcEmployeeBalance(
    name,
    emp.hired_at,
    requests,
    new Date(),
    year,
    emp.vacation_opening_balance
  );
  return { value: result.remain, planned: result.planned };
});

const teamEmptyText = computed(() => {
  if (!profileEmployee.value && !user.value) return 'Нет данных';
  if (profileTeam.value.mode === 'reports') {
    return 'Подчинённых пока нет.';
  }
  if (profileTeam.value.department) {
    return 'В отделе пока никого, кроме вас.';
  }
  return 'Добавьте отдел в справочнике.';
});

const pickAvatar = (characterId: AvatarCharacterId) => {
  if (!user.value || !isOwnProfile.value) return;
  setAvatarId(user.value.id, characterId);
  showPicker.value = false;
};

onMounted(() => {
  if (isOwnProfile.value) {
    hydrateCoupons();
    const emp = user.value ? findByUserId(user.value.id) : null;
    hydrateActivity({
      employeeId: emp?.id,
      platformUserId: user.value?.id
    }).catch(() => {});
  }
  void hydrateIdeasBank();
  hydrateVacations().catch(() => {});

  if (import.meta.client) {
    window.addEventListener('keydown', onAchievementsKeydown);
    nextTick(() => {
      measureAchievementsPreview();
      measureActivityScroll();
      const el = achievementsPreviewRef.value;
      if (el && typeof ResizeObserver !== 'undefined') {
        achievementsResizeObserver = new ResizeObserver(() => measureAchievementsPreview());
        achievementsResizeObserver.observe(el);
      }
      const list = activityListRef.value;
      if (list && typeof ResizeObserver !== 'undefined') {
        activityResizeObserver = new ResizeObserver(() => measureActivityScroll());
        activityResizeObserver.observe(list);
      }
    });
  }
});

onBeforeUnmount(() => {
  if (import.meta.client) {
    window.removeEventListener('keydown', onAchievementsKeydown);
  }
  achievementsResizeObserver?.disconnect();
  achievementsResizeObserver = null;
  activityResizeObserver?.disconnect();
  activityResizeObserver = null;
});
</script>
