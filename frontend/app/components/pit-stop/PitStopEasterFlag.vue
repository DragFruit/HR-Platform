<template>
  <button
    v-if="visible"
    type="button"
    class="pit-stop-easter-flag"
    title="Датчик телеметрии"
    aria-label="Гоночный флаг — датчик телеметрии"
    @click="reveal"
  >
    🏁
  </button>
  <p v-if="shown" class="pit-stop-easter-flag__code" role="status">
    Код: <strong>{{ code }}</strong> — введи в чек-поинте 7
  </p>
</template>

<script setup lang="ts">
import {
  isCheckpointUnlocked,
  isPitStopGameStopped,
  PIT_STOP_EASTER_CODE
} from '~/events/pit-stop-14';

const visible = ref(false);
const shown = ref(false);
const code = PIT_STOP_EASTER_CODE;

onMounted(() => {
  visible.value = isCheckpointUnlocked(7) && !isPitStopGameStopped();
});

const reveal = () => {
  shown.value = true;
};
</script>

<style scoped>
.pit-stop-easter-flag {
  position: fixed;
  left: 12px;
  bottom: 72px;
  z-index: 40;
  width: 48px;
  height: 48px;
  border: 2px solid #111;
  border-radius: 12px;
  background: #ddf365;
  font-size: 1.4rem;
  cursor: pointer;
  touch-action: manipulation;
  box-shadow: 3px 3px 0 #111;
}
.pit-stop-easter-flag__code {
  position: fixed;
  left: 68px;
  bottom: 78px;
  z-index: 40;
  margin: 0;
  padding: 8px 12px;
  background: #111;
  color: #ddf365;
  border-radius: 10px;
  font-size: 0.8rem;
  font-weight: 600;
}
</style>
