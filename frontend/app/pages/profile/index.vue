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
              <button
                v-if="isOwnProfile"
                type="button"
                class="profile-identity__settings-btn"
                aria-label="Настройки профиля"
                title="Настройки: вход, вишлист, аватар"
                @click="openSettings('login')"
              >
                <img
                  class="profile-identity__settings-gear"
                  src="/images/profile-vibe-gear.png?v=2"
                  alt=""
                  width="22"
                  height="22"
                  draggable="false"
                />
              </button>
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
              v-if="isOwnProfile && profileBadges.length"
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

        <button
          v-if="showWishlistReminder"
          type="button"
          class="profile-stat-tile profile-stat-tile--wish-reminder"
          :class="{ 'profile-stat-tile--wish-reminder-art': WISHLIST_REMINDER_ART_ENABLED }"
          aria-label="Хочешь подарок? Заполни вишлист — откроются настройки профиля"
          @click="openSettings('wishlist')"
        >
          <!-- Гирлянда привязана к краям плитки: левый конец — верхний край, правый — правый край -->
          <svg
            v-if="WISHLIST_REMINDER_ART_ENABLED"
            class="profile-stat-tile__wish-corner-bunting"
            viewBox="0 0 64 34"
            fill="none"
            aria-hidden="true"
          >
            <path d="M0 0.6 Q26 22 64 26" stroke="#202020" stroke-width="1.2" />
            <g stroke="#202020" stroke-width="1" stroke-linejoin="round">
              <path d="M1.5 1.9 L6.8 5.8 L1.9 11.5 Z" fill="#ddf365" />
              <path d="M9.3 7.5 L14.9 10.9 L10.2 17 Z" fill="#7451f4" />
              <path d="M17.6 12.4 L23.5 15.3 L18.9 21.7 Z" fill="#fd81ff" />
              <path d="M26.4 16.6 L32.5 19 L28.1 25.7 Z" fill="#f3b33e" />
              <path d="M35.7 20.1 L42 22 L37.8 29 Z" fill="#9fd6c9" />
              <path d="M45.5 22.9 L52 24.3 L48 31.6 Z" fill="#ee815a" />
              <path d="M55.9 25 L62.4 25.9 L58.7 33.4 Z" fill="#ddf365" />
            </g>
          </svg>
          <picture v-if="WISHLIST_REMINDER_ART_ENABLED">
            <source srcset="/images/profile/wishlist-reminder.webp?v=2" type="image/webp" />
            <img
              class="profile-stat-tile__wish-art-img"
              src="/images/profile/wishlist-reminder.jpg?v=2"
              alt=""
              aria-hidden="true"
              width="300"
              height="277"
              decoding="async"
            />
          </picture>
          <template v-if="!WISHLIST_REMINDER_ART_ENABLED">
            <svg
              class="profile-stat-tile__wish-bunting"
              viewBox="0 0 120 22"
              fill="none"
              aria-hidden="true"
            >
              <path d="M2 3 Q60 15 118 3" stroke="#202020" stroke-width="1.3" />
              <g stroke="#202020" stroke-width="1.1" stroke-linejoin="round">
                <path d="M8 4.6 L20 7 L12.4 17 Z" fill="#ddf365" />
                <path d="M30 8.6 L42 10.2 L35.2 20 Z" fill="#fd81ff" />
                <path d="M54 10.6 L66 10.6 L60 21 Z" fill="#f3b33e" />
                <path d="M78 10.2 L90 8.6 L84.8 20 Z" fill="#9fd6c9" />
                <path d="M100 7 L112 4.6 L107.6 17 Z" fill="#ddf365" />
              </g>
            </svg>
            <svg
              class="profile-stat-tile__wish-gift"
              viewBox="0 0 64 64"
              fill="none"
              aria-hidden="true"
            >
              <g stroke="#202020" stroke-width="2.4" stroke-linejoin="round">
                <rect x="10" y="28" width="44" height="30" rx="4" fill="#fd81ff" />
                <rect x="6" y="18" width="52" height="12" rx="3" fill="#ffb3ff" />
                <path d="M28 18v40M36 18v40" />
                <rect x="28" y="18" width="8" height="40" fill="#ddf365" />
                <path d="M32 18c-6-10-18-10-16-2 1 4 10 3 16 2Z" fill="#ddf365" />
                <path d="M32 18c6-10 18-10 16-2-1 4-10 3-16 2Z" fill="#ddf365" />
              </g>
            </svg>
            <span class="profile-stat-tile__wish-dot profile-stat-tile__wish-dot--a" aria-hidden="true" />
            <span class="profile-stat-tile__wish-dot profile-stat-tile__wish-dot--b" aria-hidden="true" />
          </template>
          <span class="profile-stat-tile__value profile-stat-tile__value--wish">Хочешь подарок?</span>
          <span class="profile-stat-tile__label profile-stat-tile__label--wish">Заполни вишлист</span>
        </button>
        <NuxtLink v-else to="/ideas" class="profile-stat-tile profile-stat-tile--ideas">
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
            <picture>
              <source v-if="VACATION_TRAINING_ART.webp" :srcset="VACATION_TRAINING_ART.webp" type="image/webp" />
              <img
                class="profile-stat-tile__quest-reward"
                :src="VACATION_TRAINING_ART.src"
                alt=""
                aria-hidden="true"
                width="360"
                height="210"
                loading="lazy"
              />
            </picture>
            <span class="profile-stat-tile__quest-sq profile-stat-tile__quest-sq--tl" aria-hidden="true" />
            <span class="profile-stat-tile__quest-sq profile-stat-tile__quest-sq--br" aria-hidden="true" />
            <span class="profile-stat-tile__value profile-stat-tile__value--quest">{{ spotlightStat.value }}</span>
            <span class="profile-stat-tile__label profile-stat-tile__label--quest">{{ spotlightStat.label }}</span>
            <span class="profile-stat-tile__quest-spark" aria-hidden="true">✦</span>
          </template>
          <template v-else-if="spotlightStat.kind === 'vacation-soon'">
            <picture>
              <source v-if="VACATION_SOON_ART.webp" :srcset="VACATION_SOON_ART.webp" type="image/webp" />
              <img
                class="profile-stat-tile__soon-art"
                :src="VACATION_SOON_ART.src"
                alt=""
                aria-hidden="true"
                width="440"
                height="377"
                loading="lazy"
              />
            </picture>
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
      'profile-grid-2--compact-team': isCompactTeamLayout,
      'profile-grid-2--no-achievements': isOwnProfile && !hasEarnedAchievements
    }"
  >
    <!-- Только полученные ачивки; нет ни одной — блока нет совсем -->
    <section
      v-if="isOwnProfile && hasEarnedAchievements"
      class="card profile-itmo-panel profile-achievements-preview profile-slot profile-slot--achievements"
      aria-label="Ачивки"
    >
      <span class="profile-itmo-panel__sq profile-itmo-panel__sq--tl" aria-hidden="true" />
      <span class="profile-itmo-panel__sq profile-itmo-panel__sq--tr" aria-hidden="true" />
      <span class="profile-itmo-panel__sq profile-itmo-panel__sq--bl" aria-hidden="true" />
      <span class="profile-itmo-panel__sq profile-itmo-panel__sq--br" aria-hidden="true" />

      <div class="profile-achievements-preview__head">
        <h3 class="profile-itmo-panel__title">Ачивки</h3>
        <button
          type="button"
          class="profile-achievements-preview__all"
          @click="achievementsOpen = true"
        >
          Все
        </button>
      </div>
      <div
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
                <UserAvatar
                  :user-id="member.platform_user_id"
                  :name="formatEmployeeShortName(member.name)"
                  :size="48"
                />
                <span v-if="member.isManager" class="profile-team__manager-badge" aria-hidden="true">★</span>
              </div>
              <span class="profile-team__name">{{ formatEmployeeShortName(member.name) }}</span>
            </button>
          </li>
        </ul>
      </div>

      <p v-else class="muted profile-team__empty">{{ teamEmptyText }}</p>
    </section>
  </div>

  <Teleport to="body">
    <div
      v-if="achievementsOpen && isOwnProfile && hasEarnedAchievements"
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
          <h3 class="org-confirm-title">Ачивки</h3>
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
            v-for="group in earnedSectionsForProfile"
            :key="group.section"
            class="profile-achievements-overlay__section"
            :aria-labelledby="`ach-section-${group.section}`"
          >
            <div class="profile-achievements-overlay__section-head">
              <h4 :id="`ach-section-${group.section}`" class="profile-achievements-overlay__section-title">
                {{ group.title }}
              </h4>
            </div>
            <ul class="list-reset profile-achievements-overlay__grid">
              <li
                v-for="item in group.items"
                :key="item.id"
                class="profile-achievements-overlay__card"
                :class="{ 'is-ack': isAchievementAcked(item.id) }"
              >
                <div class="profile-achievements-overlay__art">
                  <img
                    v-if="item.imageSrc"
                    :src="item.imageSrc"
                    :alt="item.title"
                    width="120"
                    height="120"
                    loading="lazy"
                  />
                  <span v-else class="profile-achievements-overlay__emoji" aria-hidden="true">
                    {{ item.emoji ?? '🏆' }}
                  </span>
                </div>
                <div class="profile-achievements-overlay__copy">
                  <strong class="profile-achievements-overlay__name">{{ item.title }}</strong>
                  <p v-if="item.subtitle" class="profile-achievements-overlay__desc">
                    {{ item.subtitle }}
                  </p>
                </div>
                <button
                  type="button"
                  class="profile-achievements-overlay__cta"
                  :class="{ 'is-done': isAchievementAcked(item.id) }"
                  @click="ackAchievement(item.id)"
                >
                  {{ isAchievementAcked(item.id) ? 'Получена' : 'Понятно!' }}
                </button>
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

  <ProfileSettingsDialog v-model:open="vibeCredsOpen" v-model:tab="settingsTab" />
</template>

<script setup lang="ts">
import type { AvatarCharacterId } from '~/composables/useAvatars';
import { calcEmployeeBalance } from '~/utils/vacationBalance';
import { profileTeamHeading } from '~/utils/profileTeamTitle';
import {
  findUpcomingVacationWithinDays,
  formatVacationStartDdMmYy
} from '~/utils/profileSpotlight';
import { bitrixEmployeeProfileUrl } from '~/utils/bitrixProfileUrl';
import { formatEmployeeShortName } from '~/utils/employeeName';
import { VACATION_SOON_ART, VACATION_TRAINING_ART } from '~/utils/profileTileArt';
import type { Employee } from '~/composables/useEmployees';
import {
  WISHLIST_REMINDER_ART_ENABLED,
  shouldShowWishlistReminder
} from '~/utils/profileWishlistReminder';

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
const { employeeRequests, hydrate: hydrateVacations, state: vacationsState } = useVacations();
const { profileBadges, earnedSectionsForProfile, catalogForProfilePreview } = useAchievements();
const { isEnabled: vacationTrainingEnabled, isCompletedForCurrentUser } = useVacationTraining();
const {
  hydrate: hydrateActivity,
  activityFor
} = useProfileActivity();

/**
 * Ачивки открыты и на бое (явное «ок» заказчика 2026-10-20): показываем только
 * полученные; нет ни одной — блока нет.
 */
const hasEarnedAchievements = computed(() => catalogForProfilePreview.value.length > 0);

const showPicker = ref(false);
const vibeCredsOpen = ref(false);
/** Раздел настроек профиля: вход, вишлист, аватар (?settings=wishlist открывает сразу). */
type SettingsTab = 'login' | 'wishlist' | 'avatar';
const settingsTab = ref<SettingsTab>('login');
const openSettings = (tab: SettingsTab) => {
  settingsTab.value = tab;
  vibeCredsOpen.value = true;
};
watch(
  () => route.query.settings,
  (raw) => {
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value !== 'login' && value !== 'wishlist' && value !== 'avatar') return;
    openSettings(value);
    const { settings: _drop, ...rest } = route.query;
    void navigateTo({ path: route.path, query: rest }, { replace: true });
  },
  { immediate: true }
);
/** Свой вишлист пуст → вместо «мои идеи» плитка «Хочешь подарок?» (клик = настройки → Вишлист). */
const ownWishlistCount = ref(0);
const ownWishlistLoaded = ref(false);
const loadOwnWishlistCount = async () => {
  try {
    const data = await $fetch<{ items?: unknown[] }>('/api/profile/wishlist');
    ownWishlistCount.value = Array.isArray(data.items) ? data.items.length : 0;
    ownWishlistLoaded.value = true;
  } catch {
    ownWishlistLoaded.value = false;
  }
};
const showWishlistReminder = computed(() =>
  shouldShowWishlistReminder({
    isOwnProfile: isOwnProfile.value,
    loaded: ownWishlistLoaded.value,
    itemsCount: ownWishlistCount.value
  })
);
/** После закрытия настроек (могли сохранить вишлист) — пересчитать плитку. */
watch(vibeCredsOpen, (open, wasOpen) => {
  if (!open && wasOpen && isOwnProfile.value) void loadOwnWishlistCount();
});
const achievementsOpen = ref(false);
const achievementsPreviewRef = ref<HTMLElement | null>(null);
const achievementsVisibleCount = ref(8);

const ACH_ACK_KEY = 'vbi-achievements-ack-v1';
const achievementAckIds = ref<string[]>([]);

const loadAchievementAcks = () => {
  if (!import.meta.client) return;
  try {
    const raw = localStorage.getItem(ACH_ACK_KEY);
    const parsed = raw ? (JSON.parse(raw) as { ids?: string[] }) : {};
    achievementAckIds.value = Array.isArray(parsed.ids) ? parsed.ids : [];
  } catch {
    achievementAckIds.value = [];
  }
};

const isAchievementAcked = (id: string) => achievementAckIds.value.includes(id);

const ackAchievement = (id: string) => {
  if (isAchievementAcked(id)) return;
  achievementAckIds.value = [...achievementAckIds.value, id];
  if (import.meta.client) {
    localStorage.setItem(ACH_ACK_KEY, JSON.stringify({ ids: achievementAckIds.value }));
  }
};
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

/* Блок ачивок появляется только когда есть полученные (данные могут прийти позже) */
watch(achievementsPreviewRef, (el) => {
  achievementsResizeObserver?.disconnect();
  achievementsResizeObserver = null;
  if (!el || typeof ResizeObserver === 'undefined') return;
  achievementsResizeObserver = new ResizeObserver(() => measureAchievementsPreview());
  achievementsResizeObserver.observe(el);
  measureAchievementsPreview();
});

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

const profileDisplayName = computed(() => {
  const raw =
    profileEmployee.value?.name?.trim() || (isOwnProfile.value ? user.value?.name : null) || '';
  return formatEmployeeShortName(raw) || 'Сотрудник';
});

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
      value: 'Скоро в отпуск',
      label: formatVacationStartDdMmYy(soon.start),
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
      value: 'График отпусков',
      label: 'Пройти обучение',
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
  // Один непрерывный остаток: все заявки всех лет, учётный год из данных (не календарный).
  const requests = Object.values(vacationsState.value.requestsByYear).flat();
  const result = calcEmployeeBalance(
    name,
    emp.hired_at,
    requests,
    new Date(),
    vacationsState.value.primaryYear,
    emp.vacation_opening_balance,
    emp.id
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
    void loadOwnWishlistCount();
    const emp = user.value ? findByUserId(user.value.id) : null;
    hydrateActivity({
      employeeId: emp?.id,
      platformUserId: user.value?.id
    }).catch(() => {});
  }
  void hydrateIdeasBank();
  hydrateVacations().catch(() => {});

  if (import.meta.client) {
    loadAchievementAcks();
    window.addEventListener('keydown', onAchievementsKeydown);
    nextTick(() => {
      measureAchievementsPreview();
      measureActivityScroll();
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
