<template>
  <div class="welcome-overlay">
    <article class="welcome-card">
      <p class="eyebrow">Добро пожаловать</p>
      <h2>Привет, {{ userName }}!</h2>
      <p class="muted">
        Рады видеть тебя в VBI HR Gamification. Удачного старта, крутых задач и приятных наград.
      </p>
      <button
        ref="startBtnRef"
        class="button primary"
        type="button"
        :disabled="isStarting"
        @click="startWork"
      >
        Начать работу
      </button>
    </article>
  </div>
</template>

<script setup lang="ts">
import confetti from '@hiseb/confetti';

defineProps<{
  userName: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

const startBtnRef = ref<HTMLButtonElement | null>(null);
const isStarting = ref(false);

const burstFromButton = () => {
  const btn = startBtnRef.value;
  const x = btn ? btn.getBoundingClientRect().left + btn.offsetWidth / 2 : window.innerWidth * 0.5;
  const y = btn ? btn.getBoundingClientRect().top + btn.offsetHeight / 2 : window.innerHeight * 0.5;

  confetti({ position: { x, y }, count: 120, velocity: 220 });
};

const startWork = () => {
  if (isStarting.value) return;
  isStarting.value = true;

  burstFromButton();
  window.setTimeout(() => {
    confetti({
      position: { x: window.innerWidth * 0.35, y: window.innerHeight * 0.45 },
      count: 80,
      velocity: 180
    });
  }, 200);
  window.setTimeout(() => {
    confetti({
      position: { x: window.innerWidth * 0.65, y: window.innerHeight * 0.45 },
      count: 80,
      velocity: 180
    });
  }, 400);

  window.setTimeout(() => emit('close'), 900);
};
</script>
