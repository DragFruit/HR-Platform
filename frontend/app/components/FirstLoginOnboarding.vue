<template>
  <div class="welcome-overlay onboarding-overlay">
    <article v-if="step === 'welcome'" class="welcome-card">
      <p class="eyebrow">Добро пожаловать</p>
      <h2>Привет, {{ userName }}!</h2>
      <p class="muted">
        Рады видеть тебя в {{ platformName }}. Удачного старта, крутых задач и приятных наград.
      </p>
      <button class="button primary" type="button" @click="goToAvatarStep">Далее</button>
    </article>

    <article v-else class="welcome-card onboarding-avatar-card">
      <p class="eyebrow">Твой персонаж</p>
      <h2>Выбери аватар</h2>
      <p class="muted">Позже аватар можно изменить в настройках профиля.</p>

      <div class="avatar-picker-grid" role="listbox" aria-label="Выбор аватара">
        <button
          v-for="characterId in AVATAR_CHARACTER_IDS"
          :key="characterId"
          type="button"
          class="avatar-picker-item"
          :class="{ selected: selectedId === characterId }"
          :aria-selected="selectedId === characterId"
          role="option"
          @click="selectedId = characterId"
        >
          <img :src="avatarImageUrl(characterId)" :alt="`Персонаж ${characterId}`" width="181" height="250" decoding="async" />
        </button>
      </div>

      <button
        ref="startBtnRef"
        class="button primary"
        type="button"
        :disabled="!selectedId || isStarting"
        @click="finishOnboarding"
      >
        Начать работу
      </button>
    </article>
  </div>
</template>

<script setup lang="ts">
import { PLATFORM_NAME } from '~/data/platformBrand';
import type { AvatarCharacterId } from '~/composables/useAvatars';

const platformName = PLATFORM_NAME;

type ConfettiFn = (options: {
  position: { x: number; y: number };
  count: number;
  velocity: number;
}) => void;

let confettiFn: ConfettiFn | null = null;

const loadConfetti = async (): Promise<ConfettiFn | null> => {
  if (!import.meta.client) return null;
  if (!confettiFn) {
    confettiFn = await importConfetti();
  }
  return confettiFn;
};

const props = withDefaults(
  defineProps<{
    userName: string;
    userId: number;
    /** welcome — приветствие; avatar — только выбор аватара */
    initialStep?: 'welcome' | 'avatar';
  }>(),
  {
    initialStep: 'welcome'
  }
);

const emit = defineEmits<{
  complete: [characterId: AvatarCharacterId];
}>();

const { AVATAR_CHARACTER_IDS, avatarImageUrl, getAvatarId } = useAvatars();

const step = ref<'welcome' | 'avatar'>(props.initialStep);
const selectedId = ref<AvatarCharacterId | null>(getAvatarId(props.userId));
const startBtnRef = ref<HTMLButtonElement | null>(null);
const isStarting = ref(false);

const goToAvatarStep = () => {
  step.value = 'avatar';
};

const burstAt = async (x: number, y: number, count: number, velocity: number) => {
  const confetti = await loadConfetti();
  if (!confetti) return;
  confetti({ position: { x, y }, count, velocity });
};

const burstFromButton = async () => {
  const btn = startBtnRef.value;
  const x = btn ? btn.getBoundingClientRect().left + btn.offsetWidth / 2 : window.innerWidth * 0.5;
  const y = btn ? btn.getBoundingClientRect().top + btn.offsetHeight / 2 : window.innerHeight * 0.5;

  await burstAt(x, y, 120, 220);
};

const finishOnboarding = async () => {
  if (!selectedId.value || isStarting.value) return;
  isStarting.value = true;

  await burstFromButton();
  window.setTimeout(() => {
    void burstAt(window.innerWidth * 0.35, window.innerHeight * 0.45, 80, 180);
  }, 200);
  window.setTimeout(() => {
    void burstAt(window.innerWidth * 0.65, window.innerHeight * 0.45, 80, 180);
  }, 400);

  window.setTimeout(() => emit('complete', selectedId.value!), 900);
};
</script>
