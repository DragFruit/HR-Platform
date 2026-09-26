<template>
  <aside v-if="visible" class="ps-raccoon" :class="[`ps-raccoon--${size}`]" aria-label="Рассказчик">
    <img class="ps-raccoon__art" :src="artSrc" alt="" draggable="false" />
    <div class="ps-raccoon__panel">
      <p class="ps-raccoon__bubble">{{ line }}</p>
      <div v-if="showNav" class="ps-raccoon__nav">
        <button v-if="canSkip" type="button" class="ps-raccoon__btn ps-raccoon__btn--ghost" @click="emit('skip')">
          Пропустить
        </button>
        <button type="button" class="ps-raccoon__btn" @click="emit('next')">
          {{ nextLabel }}
        </button>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { RACCOON_BASE_WAIST_SRC } from '~/events/pit-stop-14/raccoonLines';

withDefaults(
  defineProps<{
    line: string;
    visible?: boolean;
    size?: 'hub' | 'cp';
    showNav?: boolean;
    canSkip?: boolean;
    nextLabel?: string;
    artSrc?: string;
  }>(),
  {
    visible: true,
    size: 'cp',
    showNav: false,
    canSkip: false,
    nextLabel: 'Дальше',
    artSrc: RACCOON_BASE_WAIST_SRC
  }
);

const emit = defineEmits<{ next: []; skip: [] }>();
</script>

<style scoped>
.ps-raccoon {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 12px;
  align-items: end;
  pointer-events: auto;
}
.ps-raccoon__art {
  display: block;
  width: auto;
  height: auto;
  object-fit: contain;
  object-position: bottom center;
  user-select: none;
  pointer-events: none;
  filter: drop-shadow(4px 4px 0 rgba(0, 0, 0, 0.55));
  background: transparent;
}
.ps-raccoon--hub .ps-raccoon__art {
  width: clamp(168px, 28vmin, 280px);
  max-height: clamp(200px, 42vmin, 340px);
}
.ps-raccoon--cp .ps-raccoon__art {
  width: clamp(140px, 22vmin, 220px);
  max-height: clamp(168px, 32vmin, 260px);
}
.ps-raccoon__panel {
  display: grid;
  gap: 8px;
  min-width: 0;
  padding-bottom: 6px;
}
.ps-raccoon__bubble {
  margin: 0;
  padding: 12px 14px;
  font-size: clamp(0.82rem, 2vw, 0.98rem);
  line-height: 1.4;
  font-weight: 600;
  color: #111;
  background: #eeeee8;
  border: 2px solid #111;
  border-radius: 16px 16px 16px 4px;
  box-shadow: 4px 4px 0 #ddf365;
}
.ps-raccoon__nav {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}
.ps-raccoon__btn {
  min-height: 44px;
  padding: 0 16px;
  border: 2px solid #111;
  border-radius: 12px;
  background: #ddf365;
  color: #111;
  font-weight: 800;
  font-size: 0.85rem;
  cursor: pointer;
  box-shadow: 2px 2px 0 #111;
  touch-action: manipulation;
}
.ps-raccoon__btn--ghost {
  background: transparent;
  color: #eeeee8;
  box-shadow: none;
  border-color: rgba(238, 238, 232, 0.45);
}
.ps-raccoon__btn--ghost:hover {
  border-color: #ddf365;
  color: #ddf365;
}

@media (max-width: 640px) {
  .ps-raccoon {
    grid-template-columns: 1fr;
    justify-items: center;
    text-align: left;
  }
  .ps-raccoon__art {
    justify-self: start;
  }
  .ps-raccoon__panel {
    width: 100%;
  }
}
</style>
