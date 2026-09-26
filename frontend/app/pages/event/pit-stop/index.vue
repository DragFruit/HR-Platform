<template>
  <div class="ps-hub">
    <div class="ps-hub__stage">
      <div class="ps-hub__map">
        <img
          class="ps-hub__track"
          src="/events/pit-stop-14/track.png"
          alt=""
          width="1280"
          height="720"
          draggable="false"
        />

        <template v-for="item in hub" :key="item.id">
          <NuxtLink
            v-if="canOpen(item)"
            :to="`/event/pit-stop/${item.id}`"
            class="ps-hub__pin"
            :class="[`is-${item.status}`, { 'is-current': isCurrent(item) }]"
            :style="pinStyle(item.id)"
            :title="shortTitle(item.title)"
            :aria-label="`${shortTitle(item.title)} — ${statusLabel(item.status)}`"
          >
            <span class="ps-hub__pin-ring" aria-hidden="true" />
            <span class="ps-hub__pin-core">{{ item.id }}</span>
          </NuxtLink>
          <button
            v-else
            type="button"
            class="ps-hub__pin is-locked"
            :style="pinStyle(item.id)"
            disabled
            :title="item.lockedLabel || 'Закрыто'"
            :aria-label="`${shortTitle(item.title)} — закрыто`"
          >
            <span class="ps-hub__pin-ring" aria-hidden="true" />
            <span class="ps-hub__pin-core" aria-hidden="true">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
                <path
                  d="M4.5 7V5a3.5 3.5 0 1 1 7 0v2"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                />
                <rect x="3.25" y="7" width="9.5" height="6.75" rx="1.5" stroke="currentColor" stroke-width="1.6" />
              </svg>
            </span>
          </button>
        </template>
      </div>
    </div>

    <aside class="ps-hub__dock">
      <div class="ps-hub__dock-main">
        <p class="ps-hub__eyebrow">Корпоратив · 9 октября · 14 Years on Track</p>
        <h1 class="ps-hub__title">{{ hubTitle }}</h1>
        <p class="ps-hub__lead">{{ hubLead }}</p>
        <p class="ps-hub__lap-label">
          Круг {{ me?.player?.completed ?? 0 }} / 8
          <template v-if="me?.partner">
            · пилот <strong>{{ me.partner.name }}</strong>
          </template>
          <template v-else> · пара ещё не собрана</template>
        </p>
      </div>

      <form v-if="!me?.partner" class="ps-hub__join" @submit.prevent="joinPair">
        <label class="ps-hub__field">
          <span>ID напарника</span>
          <input v-model="partnerIdInput" class="ps-hub__input" type="number" min="1" required />
        </label>
        <label class="ps-hub__check">
          <input v-model="isRemote" type="checkbox" />
          Удалёнка
        </label>
        <button type="submit" class="ps-hub__cta" :disabled="joining">Создать пару</button>
        <p v-if="joinError" class="ps-hub__err">{{ joinError }}</p>
      </form>
    </aside>

    <p v-if="loadError" class="ps-hub__err ps-hub__err--float">{{ loadError }}</p>
  </div>
</template>

<script setup lang="ts">
import { PIT_STOP_HUB_LEAD, PIT_STOP_HUB_TITLE } from '~/events/pit-stop-14';

definePageMeta({ layout: 'default' });

const hubTitle = PIT_STOP_HUB_TITLE;
const hubLead = PIT_STOP_HUB_LEAD;

/** % от PNG трассы — центры бывших красных пинов (v4) */
const PIN_POS: Record<number, { left: number; top: number }> = {
  1: { left: 15.6, top: 60.3 },
  2: { left: 23.7, top: 93.9 },
  3: { left: 56.6, top: 93.9 },
  4: { left: 84.7, top: 59.9 },
  5: { left: 84.8, top: 39.7 },
  6: { left: 63.9, top: 16.5 },
  7: { left: 32.0, top: 16.3 },
  8: { left: 34.3, top: 39.5 }
};

type HubItem = {
  id: number;
  title: string;
  unlockDate: string;
  unlocked: boolean;
  lockedLabel: string;
  status: string;
};

const me = ref<{
  player: { completed: number } | null;
  partner: { name: string } | null;
} | null>(null);
const hub = ref<HubItem[]>([]);
const loadError = ref('');
const joinError = ref('');
const joining = ref(false);
const partnerIdInput = ref('');
const isRemote = ref(false);

const shortTitle = (t: string) => t.replace(/^Чек-поинт\s+\d+:\s*/i, '');

const statusLabel = (s: string) => {
  if (s === 'done') return 'Пройдено';
  if (s === 'pending_review') return 'На проверке HR';
  if (s === 'in_progress') return 'В процессе';
  if (s === 'stopped') return 'Стоп';
  return 'Открыто';
};

const pinStyle = (id: number) => {
  const p = PIN_POS[id] ?? { left: 50, top: 50 };
  return { left: `${p.left}%`, top: `${p.top}%` };
};

const canOpen = (item: HubItem) =>
  item.unlocked && item.status !== 'locked' && item.status !== 'stopped';

const isCurrent = (item: HubItem) =>
  canOpen(item) && item.status !== 'done' && item.status !== 'pending_review';

const load = async () => {
  loadError.value = '';
  try {
    await $fetch('/api/event/pit-stop/join', {
      method: 'POST',
      body: { isRemote: isRemote.value }
    });
    const data = await $fetch<{
      player: { completed: number } | null;
      partner: { name: string } | null;
      hub: HubItem[];
    }>('/api/event/pit-stop/me');
    me.value = { player: data.player, partner: data.partner };
    hub.value = data.hub;
  } catch (e: unknown) {
    loadError.value = e instanceof Error ? e.message : 'Не удалось загрузить ивент';
  }
};

const joinPair = async () => {
  joining.value = true;
  joinError.value = '';
  try {
    await $fetch('/api/event/pit-stop/join', {
      method: 'POST',
      body: {
        partnerUserId: Number(partnerIdInput.value),
        isRemote: isRemote.value
      }
    });
    await load();
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; message?: string };
    joinError.value = err?.data?.statusMessage || err?.message || 'Ошибка пары';
  } finally {
    joining.value = false;
  }
};

onMounted(load);
</script>

<style scoped>
.ps-hub {
  --ps-bg: #1a1a1a;
  --ps-lime: #ddf365;
  --ps-violet: #7451f4;
  --ps-dock-h: 88px;
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  margin: 0;
  padding: 0;
  background: var(--ps-bg);
  color: #fff;
  overscroll-behavior-y: contain;
  touch-action: manipulation;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ps-hub__stage {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  /* низ под док — трасса целиком над панелью */
  padding: 4px 10px calc(var(--ps-dock-h) + 4px);
  display: grid;
  place-items: center;
  container-type: size;
}

.ps-hub__map {
  position: relative;
  /* вписать 16:9 в stage без скролла и обрезки */
  width: min(100cqw, calc(100cqh * 1280 / 720));
  height: min(100cqh, calc(100cqw * 720 / 1280));
  max-width: 100%;
  max-height: 100%;
  line-height: 0;
}

.ps-hub__track {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
  user-select: none;
  pointer-events: none;
}

.ps-hub__pin {
  position: absolute;
  z-index: 2;
  width: clamp(36px, 5.5cqmin, 52px);
  height: clamp(36px, 5.5cqmin, 52px);
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  display: grid;
  place-items: center;
  text-decoration: none;
  color: #111;
  cursor: pointer;
  background: transparent;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.ps-hub__pin-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: var(--ps-lime);
  border: 2px solid #111;
  box-shadow: 0 0 0 3px rgba(221, 243, 101, 0.25), 3px 3px 0 #111;
}

.ps-hub__pin-core {
  position: relative;
  z-index: 1;
  font-size: 0.95rem;
  font-weight: 800;
  line-height: 1;
}

.ps-hub__pin.is-current .ps-hub__pin-ring {
  animation: ps-pin-pulse 1.6s ease-in-out infinite;
  background: #fff;
  box-shadow: 0 0 0 4px rgba(116, 81, 244, 0.45), 3px 3px 0 var(--ps-violet);
}

.ps-hub__pin.is-done .ps-hub__pin-ring {
  background: #388073;
  box-shadow: 3px 3px 0 #111;
}

.ps-hub__pin.is-done .ps-hub__pin-core {
  color: #fff;
}

.ps-hub__pin.is-locked {
  cursor: not-allowed;
  opacity: 0.72;
}

.ps-hub__pin.is-locked .ps-hub__pin-ring {
  background: #5a5a5a;
  box-shadow: none;
  border-color: #333;
}

.ps-hub__pin.is-locked .ps-hub__pin-core {
  color: #c8c8c0;
  display: grid;
  place-items: center;
}

.ps-hub__pin:not(.is-locked):hover {
  transform: translate(-50%, -50%) scale(1.08);
}

.ps-hub__pin:not(.is-locked):focus-visible {
  outline: 2px solid var(--ps-violet);
  outline-offset: 4px;
}

@keyframes ps-pin-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 4px rgba(116, 81, 244, 0.35), 3px 3px 0 var(--ps-violet);
  }
  50% {
    box-shadow: 0 0 0 10px rgba(116, 81, 244, 0.12), 3px 3px 0 var(--ps-violet);
  }
}

.ps-hub__dock {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 5;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 8px 16px;
  min-height: var(--ps-dock-h);
  max-height: 42%;
  overflow: auto;
  padding: 10px 16px 12px;
  background: linear-gradient(180deg, transparent, rgba(0, 0, 0, 0.72) 36%, #0d0d0d 100%);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  pointer-events: none;
}

.ps-hub__dock > * {
  pointer-events: auto;
}

.ps-hub__dock-main {
  flex: 1 1 240px;
  min-width: 0;
}

.ps-hub__eyebrow {
  margin: 0 0 2px;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ps-lime);
}

.ps-hub__title {
  margin: 0 0 2px;
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.ps-hub__lead {
  margin: 0 0 2px;
  font-size: 0.75rem;
  line-height: 1.3;
  color: rgba(255, 255, 255, 0.72);
  max-width: 42em;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.ps-hub__lap-label {
  margin: 0;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.65);
}

.ps-hub__lap-label strong {
  color: var(--ps-lime);
}

.ps-hub__join {
  flex: 0 1 320px;
  display: grid;
  gap: 8px;
  padding: 12px;
  background: #eeeee8;
  color: #111;
  border: 2px solid #111;
  border-radius: 14px;
  box-shadow: 3px 3px 0 var(--ps-violet);
}

.ps-hub__field {
  display: grid;
  gap: 4px;
  font-size: 0.75rem;
  font-weight: 700;
}

.ps-hub__input {
  min-height: 44px;
  padding: 8px 12px;
  border: 2px solid #111;
  border-radius: 10px;
  font-size: 1rem;
}

.ps-hub__check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  min-height: 40px;
}

.ps-hub__cta {
  min-height: 44px;
  border: 2px solid #111;
  border-radius: 12px;
  background: var(--ps-lime);
  font-weight: 800;
  cursor: pointer;
}

.ps-hub__cta:disabled {
  opacity: 0.55;
}

.ps-hub__err {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 600;
  color: #a11;
}

.ps-hub__err--float {
  position: absolute;
  left: 16px;
  bottom: 120px;
  z-index: 5;
  padding: 10px 12px;
  background: #ffe0e0;
  border: 2px solid #111;
  border-radius: 10px;
  color: #111;
  line-height: 1.3;
}

@media (max-width: 720px) {
  .ps-hub__pin {
    width: 44px;
    height: 44px;
  }
  .ps-hub__pin-core {
    font-size: 0.85rem;
  }
}
</style>
