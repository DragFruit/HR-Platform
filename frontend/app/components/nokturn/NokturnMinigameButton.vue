<template>
  <div class="nk-game" :class="`nk-game--${stage.minigame.state}`">
    <img v-if="icon" class="nk-game__icon" :src="icon" alt="" aria-hidden="true" draggable="false" />
    <div class="nk-game__text">
      <p class="nk-game__title">{{ stage.weekday }} · {{ stage.minigame.title }}</p>
      <p class="nk-game__state">{{ label }}</p>
    </div>
    <button
      v-if="actionable"
      type="button"
      class="nk-btn nk-btn--primary"
      @click="emit('play')"
    >
      {{ buttonLabel }}
    </button>
  </div>
</template>

<script setup lang="ts">
import type { NokturnStageView } from '~/events/nokturn/types';

const props = withDefaults(
  defineProps<{
    stage: NokturnStageView;
    countdown: string;
    micro: Record<string, string>;
    attemptsTotal?: number;
    icon?: string;
  }>(),
  { attemptsTotal: 3, icon: '' }
);

/** Игры вторника-пятницы ещё не собраны — улики выдаются без них. */
const stubGame = computed(() => props.stage.minigame.kind !== 'search');

const buttonLabel = computed(() => {
  if (stubGame.value) return 'Открыть улики';
  return props.stage.minigame.state === 'catch-up' ? 'Открыть' : 'Играть';
});

const emit = defineEmits<{ play: [] }>();

const actionable = computed(
  () => props.stage.minigame.state === 'available' || props.stage.minigame.state === 'catch-up'
);

/** Состояния из раздела 7 спеки. */
const label = computed(() => {
  switch (props.stage.minigame.state) {
    case 'locked':
      return props.micro.beforeOpen.replace('{t}', props.countdown);
    case 'blocked-by-stage':
      return props.micro.stageBlocked.replace('{N}', String(props.stage.blockedByStage ?? ''));
    case 'done':
      return 'Улика получена';
    case 'catch-up':
      return stubGame.value
        ? 'Пропущенный этап — улики выдаются без мини-игры'
        : 'Пропущенный этап — откройте его по порядку';
    default:
      return stubGame.value
        ? 'Мини-игра готовится, улики выдаются без неё'
        : `Попыток осталось: ${Math.max(0, props.attemptsTotal - props.stage.minigame.attempts)}`;
  }
});
</script>
