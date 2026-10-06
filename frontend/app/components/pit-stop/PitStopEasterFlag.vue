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
    Код: <strong>{{ code }}</strong> — введи в чек-поинте 6
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
  visible.value = isCheckpointUnlocked(6) && !isPitStopGameStopped();
});

const reveal = () => {
  shown.value = true;
};
</script>

<style scoped>
.pit-stop-easter-flag {
  position: fixed;
  left: 12px;
  bottom: calc(var(--mobile-nav-clearance, 96px) + 12px);
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
  bottom: calc(var(--mobile-nav-clearance, 96px) + 18px);
  z-index: 40;
  margin: 0;
  padding: 8px 12px;
  background: #111;
  color: #ddf365;
  border-radius: 10px;
  font-size: 0.8rem;
  font-weight: 600;
}

/* На мобилке — под шапкой, не над доком и не на строке поиска */
@media (max-width: 900px) {
  .pit-stop-easter-flag {
    top: calc(56px + env(safe-area-inset-top, 0px) + 10px);
    bottom: auto;
    left: 10px;
    width: 40px;
    height: 40px;
    font-size: 1.15rem;
  }
  .pit-stop-easter-flag__code {
    top: calc(56px + env(safe-area-inset-top, 0px) + 14px);
    bottom: auto;
    left: 56px;
    max-width: min(220px, calc(100vw - 70px));
  }
}
</style>
