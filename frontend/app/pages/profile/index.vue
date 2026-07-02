<template>
  <section class="creative-hero profile-hero">
    <div>
      <p class="eyebrow">Профиль · рост и развитие</p>
      <h2>{{ user?.name ?? 'Сотрудник' }}</h2>
      <p class="muted">{{ user?.department ?? '—' }} · {{ assessment.roleTitle }}</p>
      <div class="profile-hero__grades">
        <span class="profile-grade-pill">{{ gradeById(assessment.currentGradeId)?.title }}</span>
        <span class="profile-grade-arrow" aria-hidden="true">→</span>
        <span class="profile-grade-pill profile-grade-pill--target">{{ gradeById(assessment.targetGradeId)?.title }}</span>
      </div>
    </div>
  </section>

  <section class="grid-two section-card">
    <NuxtLink to="/profile/assessment" class="card profile-hub-card profile-hub-card--matrix">
      <p class="eyebrow">Оценка</p>
      <h3 class="section-title">Матрица компетенций</h3>
      <p class="muted">Грейды Junior / Middle / Senior HR и пробелы по 8 компетенциям.</p>
      <p class="profile-hub-card__stat">
        <strong>{{ gapsForTarget.length }}</strong>
        <span class="soft">зон роста до целевого грейда</span>
      </p>
    </NuxtLink>

    <NuxtLink to="/profile/development" class="card profile-hub-card profile-hub-card--idp">
      <p class="eyebrow">Развитие</p>
      <h3 class="section-title">Индивидуальный план (ИПР)</h3>
      <p class="muted">Цели из матрицы, модель 70-20-10 и контрольные точки.</p>
      <p class="profile-hub-card__stat">
        <strong>{{ idpProgress }}%</strong>
        <span class="soft">активностей выполнено</span>
      </p>
    </NuxtLink>
  </section>

  <section class="card section-card">
    <h2 class="section-title">Профиль</h2>
    <p class="muted">Рост, цели и персональная статистика.</p>

    <div class="profile-avatar-block" style="margin-top: 20px">
      <UserAvatar v-if="user" :user-id="user.id" :name="user.name" :size="88" />
      <div>
        <p class="soft">Сотрудник</p>
        <p class="stat-value" style="margin: 4px 0 0">{{ user?.name ?? '—' }}</p>
        <p class="muted" style="margin-top: 4px">{{ user?.department ?? '—' }}</p>
        <button class="button ghost" type="button" style="margin-top: 12px" @click="showPicker = !showPicker">
          {{ showPicker ? 'Скрыть выбор' : 'Сменить аватар' }}
        </button>
      </div>
    </div>

    <div v-if="showPicker && user" class="profile-avatar-change" style="margin-top: 20px">
      <p class="soft">Выберите персонажа</p>
      <div class="avatar-picker-grid">
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
    </div>
  </section>

  <section class="card section-card">
    <h3 class="section-title">Команда</h3>
    <p v-if="teamSubtitle" class="muted">{{ teamSubtitle }}</p>

    <ul v-if="teamMembers.length" class="profile-team-list">
      <li v-for="member in teamMembers" :key="member.id" class="profile-team-member">
        <UserAvatar :user-id="member.platform_user_id" :name="member.name" :size="72" />
        <span class="profile-team-name">{{ member.name }}</span>
      </li>
    </ul>

    <p v-else class="muted profile-team-empty">
      {{ teamEmptyText }}
    </p>
  </section>

  <section v-if="adaptationMe?.employee" class="card section-card">
    <div class="section-head row">
      <h3 class="section-title">Адаптация</h3>
      <NuxtLink to="/adaptation" class="button ghost">Открыть трек</NuxtLink>
    </div>
    <p class="muted">{{ adaptationMe.track.title }}</p>
    <div class="progress" style="margin-top: 12px">
      <span :style="{ width: `${adaptationMe.progress_percent}%` }" />
    </div>
    <p class="soft" style="margin-top: 8px">
      Прогресс {{ adaptationMe.progress_percent }}% · день {{ adaptationMe.days_since_hire }}
    </p>
    <ul v-if="adaptationMe.attempts.length" class="list-reset" style="margin-top: 12px">
      <li v-for="a in adaptationMe.attempts.slice(0, 3)" :key="a.id" class="task-item">
        <strong>{{ a.quiz_title }}</strong>
        <span class="muted"> — {{ a.score_percent }}%, {{ a.passed ? 'пройден' : 'не пройден' }}</span>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import type { AvatarCharacterId } from '~/composables/useAvatars';

const { user } = useAuth();
const { profileTeamForUser } = useEmployees();
const { me: adaptationMe, loadMe } = useAdaptation();
const { AVATAR_CHARACTER_IDS, avatarImageUrl, getAvatarId, setAvatarId } = useAvatars();
const { assessment, gradeById, gapsForTarget, idpProgress } = useHrDevelopment();

const showPicker = ref(false);

const currentAvatarId = computed(() => (user.value ? getAvatarId(user.value.id) : null));

const profileTeam = computed(() => profileTeamForUser(user.value));

const teamMembers = computed(() => profileTeam.value.members);

const teamSubtitle = computed(() => {
  if (!user.value) return '';
  if (profileTeam.value.mode === 'reports') {
    return 'Подчинённые по справочнику сотрудников';
  }
  if (profileTeam.value.department) {
    return `Коллеги по отделу «${profileTeam.value.department}»`;
  }
  return '';
});

const teamEmptyText = computed(() => {
  if (!user.value) return 'Нет данных';
  if (profileTeam.value.mode === 'reports') {
    return 'Подчинённых пока нет — укажите руководителя в справочнике для сотрудников.';
  }
  if (profileTeam.value.department) {
    return `В отделе «${profileTeam.value.department}» пока никого, кроме вас.`;
  }
  return 'Добавьте себя в справочник сотрудников с отделом, чтобы увидеть команду.';
});

const pickAvatar = (characterId: AvatarCharacterId) => {
  if (!user.value) return;
  setAvatarId(user.value.id, characterId);
};

onMounted(() => {
  loadMe().catch(() => {});
});
</script>
