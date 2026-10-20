<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="org-confirm-overlay wish-panel-overlay"
      role="presentation"
      @click.self="emit('close')"
    >
      <section
        class="wish-panel"
        role="dialog"
        aria-modal="true"
        :aria-label="`Вишлист: ${firstLast}`"
      >
        <span class="wish-panel__confetti wish-panel__confetti--a" aria-hidden="true" />
        <span class="wish-panel__confetti wish-panel__confetti--b" aria-hidden="true" />
        <span class="wish-panel__confetti wish-panel__confetti--c" aria-hidden="true" />
        <span class="wish-panel__confetti wish-panel__confetti--d" aria-hidden="true" />

        <WishlistGarland class="wish-panel__garland" />

        <button type="button" class="wish-panel__close" aria-label="Закрыть" @click="emit('close')">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
            <path d="M4 4l8 8M12 4 4 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          </svg>
        </button>

        <header class="wish-panel__head">
          <span class="wish-panel__gift" aria-hidden="true">🎁</span>
          <h3 class="wish-panel__title">{{ own ? 'Мои желания' : `${firstLast} точно обрадуется` }}</h3>
        </header>
        <p v-if="own" class="wish-panel__hint">
          Так твой вишлист видят коллеги. Можно дополнить в настройках профиля.
        </p>
        <div v-else class="wish-panel__gap" aria-hidden="true" />

        <div class="wish-panel__scroll">
          <p v-if="loading" class="wish-panel__empty">Разворачиваем подарки…</p>
          <WishlistItemsList v-else-if="items.length" :items="items" :aria-label="`Вишлист: ${firstLast}`" />
          <div v-else class="wish-panel__empty">
            <span aria-hidden="true">🎈</span>
            <p>Вишлист пока пустой. Добавь пару идей — коллегам будет проще порадовать тебя.</p>
          </div>
        </div>

        <footer v-if="own" class="wish-panel__foot">
          <NuxtLink to="/profile?settings=wishlist" class="wish-panel__edit" @click="emit('close', true)">
            ✏️ {{ items.length ? 'Редактировать вишлист' : 'Заполнить вишлист' }}
          </NuxtLink>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { WishlistItem } from '~/utils/wishlist';
import { formatEmployeeFirstLastName } from '~/utils/employeeName';

const props = defineProps<{
  open: boolean;
  /** ФИО как в справочнике («Фамилия Имя Отчество»). */
  name: string;
  items: WishlistItem[];
  own?: boolean;
  loading?: boolean;
}>();

/** «Имя Фамилия» без отчества. */
const firstLast = computed(() => formatEmployeeFirstLastName(props.name) || 'Коллега');

/** closeAll=true — закрыть и визитку (переход в настройки). */
const emit = defineEmits<{ close: [closeAll?: boolean] }>();

/** Esc закрывает только панель, визитка под ней остаётся. */
const onKey = (e: KeyboardEvent) => {
  if (!props.open || e.key !== 'Escape') return;
  e.stopPropagation();
  emit('close');
};

onMounted(() => window.addEventListener('keydown', onKey, true));
onUnmounted(() => window.removeEventListener('keydown', onKey, true));
</script>

<style scoped>
.wish-panel-overlay {
  z-index: 1200;
}

.wish-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  width: min(460px, calc(100vw - 32px));
  max-height: min(640px, calc(100vh - 48px));
  padding: 34px 22px 20px;
  overflow: hidden;
  color: #202020;
  background:
    radial-gradient(circle at 12% 18%, rgba(253, 129, 255, 0.16) 0 60px, transparent 61px),
    radial-gradient(circle at 92% 8%, rgba(221, 243, 101, 0.4) 0 70px, transparent 71px),
    #fff6e8;
  border: 2px solid #202020;
  border-radius: 22px;
  box-shadow: 6px 6px 0 #f3b33e;
  animation: wish-pop 0.28s cubic-bezier(0.2, 0.9, 0.3, 1.25);
}

@keyframes wish-pop {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.97);
  }
}

.wish-panel__garland {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  pointer-events: none;
}

.wish-panel__confetti {
  position: absolute;
  width: 8px;
  height: 8px;
  border: 1.5px solid #202020;
  pointer-events: none;
}

.wish-panel__confetti--a {
  top: 64px;
  right: 28px;
  background: #7451f4;
  transform: rotate(18deg);
}

.wish-panel__confetti--b {
  top: 92px;
  right: 64px;
  border-radius: 50%;
  background: #ddf365;
}

.wish-panel__confetti--c {
  bottom: 24px;
  left: 14px;
  background: #fd81ff;
  transform: rotate(-24deg);
}

.wish-panel__confetti--d {
  bottom: 54px;
  right: 12px;
  border-radius: 50%;
  background: #ee815a;
}

.wish-panel__close {
  position: absolute;
  top: 40px;
  right: 14px;
  z-index: 1;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  padding: 0;
  color: #202020;
  background: #fff;
  border: 1.5px solid #202020;
  border-radius: 50%;
  cursor: pointer;
}

.wish-panel__close:hover {
  background: #ddf365;
}

.wish-panel__head {
  display: flex;
  gap: 12px;
  align-items: center;
  padding-right: 36px;
  margin-top: 6px;
}

.wish-panel__gift {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 48px;
  height: 48px;
  font-size: 26px;
  background: #ddf365;
  border: 2px solid #202020;
  border-radius: 14px;
  transform: rotate(-6deg);
  animation: wish-wiggle 2.8s ease-in-out infinite;
}

@keyframes wish-wiggle {
  0%,
  86%,
  100% {
    transform: rotate(-6deg);
  }
  90% {
    transform: rotate(6deg) scale(1.05);
  }
  94% {
    transform: rotate(-10deg);
  }
}

.wish-panel__gap {
  height: 14px;
}

.wish-panel__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.05rem;
  line-height: 1.25;
}

.wish-panel__hint {
  margin: 10px 0 14px;
  font-size: 0.86rem;
  line-height: 1.45;
  color: #565656;
}

.wish-panel__scroll {
  min-height: 0;
  margin: 0 -6px;
  padding: 2px 8px 8px 6px;
  overflow-y: auto;
}

.wish-panel__empty {
  display: grid;
  justify-items: center;
  gap: 6px;
  margin: 0;
  padding: 18px 12px;
  text-align: center;
  font-size: 0.9rem;
  color: #565656;
  background: rgba(255, 255, 255, 0.7);
  border: 1.5px dashed #202020;
  border-radius: 16px;
}

.wish-panel__empty span {
  font-size: 28px;
}

.wish-panel__empty p {
  margin: 0;
}

.wish-panel__foot {
  display: flex;
  justify-content: flex-end;
  padding-top: 12px;
}

.wish-panel__edit {
  padding: 8px 14px;
  font-size: 0.86rem;
  font-weight: 700;
  color: #202020;
  text-decoration: none;
  background: #ddf365;
  border: 2px solid #202020;
  border-radius: 999px;
  box-shadow: 2px 2px 0 #202020;
}

.wish-panel__edit:hover {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 #202020;
}

@media (prefers-reduced-motion: reduce) {
  .wish-panel,
  .wish-panel__gift {
    animation: none;
  }
}
</style>
