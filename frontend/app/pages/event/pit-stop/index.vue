<template>
  <div class="ps-hub">
    <header class="ps-hub__hero">
      <div class="ps-hub__chequer" aria-hidden="true" />
      <div class="ps-hub__hero-inner">
        <p class="ps-hub__eyebrow">Корпоратив · 9 октября · 14 Years on Track</p>
        <h1 class="ps-hub__title">
          <span class="ps-hub__flag" aria-hidden="true">
            <svg viewBox="0 0 16 16" width="28" height="28">
              <rect width="16" height="16" fill="#111" />
              <rect x="0" y="0" width="4" height="4" fill="#ddf365" />
              <rect x="8" y="0" width="4" height="4" fill="#ddf365" />
              <rect x="4" y="4" width="4" height="4" fill="#ddf365" />
              <rect x="12" y="4" width="4" height="4" fill="#ddf365" />
              <rect x="0" y="8" width="4" height="4" fill="#ddf365" />
              <rect x="8" y="8" width="4" height="4" fill="#ddf365" />
              <rect x="4" y="12" width="4" height="4" fill="#ddf365" />
              <rect x="12" y="12" width="4" height="4" fill="#ddf365" />
            </svg>
          </span>
          {{ hubTitle }}
        </h1>
        <p class="ps-hub__lead">{{ hubLead }}</p>

        <div class="ps-hub__lap" aria-label="Прогресс круга">
          <span
            v-for="n in 8"
            :key="n"
            class="ps-hub__lap-seg"
            :class="{ 'is-done': (me?.player?.completed ?? 0) >= n }"
          />
        </div>
        <p class="ps-hub__lap-label">
          Круг {{ me?.player?.completed ?? 0 }} / 8
          <template v-if="me?.partner">
            · пилот <strong>{{ me.partner.name }}</strong>
          </template>
        </p>
      </div>
    </header>

    <form v-if="!me?.partner" class="ps-hub__join" @submit.prevent="joinPair">
      <div class="ps-hub__join-head">
        <span class="ps-hub__join-badge">Парный заезд</span>
        <h2 class="ps-hub__join-title">Найди напарника</h2>
        <p class="ps-hub__join-hint">Введи его ID в Vibe / Bitrix — откроете бокс вместе.</p>
      </div>
      <label class="ps-hub__field">
        <span>ID напарника</span>
        <input v-model="partnerIdInput" class="ps-hub__input" type="number" min="1" required />
      </label>
      <label class="ps-hub__check">
        <input v-model="isRemote" type="checkbox" />
        Я на удалёнке (финиш 9.10 — видео)
      </label>
      <button type="submit" class="ps-hub__cta" :disabled="joining">Создать пару</button>
      <p v-if="joinError" class="ps-hub__err">{{ joinError }}</p>
    </form>

    <ol class="ps-hub__lane">
      <li v-for="item in hub" :key="item.id" class="ps-hub__stall">
        <NuxtLink
          v-if="item.unlocked && item.status !== 'locked' && item.status !== 'stopped'"
          :to="`/event/pit-stop/${item.id}`"
          class="ps-hub__card"
          :class="[`is-${item.status}`]"
        >
          <span class="ps-hub__num">{{ String(item.id).padStart(2, '0') }}</span>
          <span class="ps-hub__meta">
            <strong>{{ shortTitle(item.title) }}</strong>
            <span class="ps-hub__status">{{ statusLabel(item.status) }}</span>
          </span>
          <span class="ps-hub__go" aria-hidden="true">→</span>
        </NuxtLink>
        <div v-else class="ps-hub__card is-locked" aria-disabled="true">
          <span class="ps-hub__num ps-hub__num--lock" aria-hidden="true">
            <svg viewBox="0 0 16 16" width="18" height="18" fill="none">
              <path
                d="M4.5 7V5a3.5 3.5 0 1 1 7 0v2"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
              />
              <rect x="3.25" y="7" width="9.5" height="6.75" rx="1.5" stroke="currentColor" stroke-width="1.5" />
            </svg>
          </span>
          <span class="ps-hub__meta">
            <strong>{{ shortTitle(item.title) }}</strong>
            <span class="ps-hub__status">{{ item.lockedLabel || 'LOCKED · 09:00 МСК' }}</span>
          </span>
        </div>
      </li>
    </ol>

    <p v-if="loadError" class="ps-hub__err">{{ loadError }}</p>
  </div>
</template>

<script setup lang="ts">
import { PIT_STOP_HUB_LEAD, PIT_STOP_HUB_TITLE } from '~/events/pit-stop-14';

definePageMeta({ layout: 'default' });

const hubTitle = PIT_STOP_HUB_TITLE;
const hubLead = PIT_STOP_HUB_LEAD;

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
  if (s === 'done') return 'Финиш точки';
  if (s === 'pending_review') return 'На пит-стопе HR';
  if (s === 'in_progress') return 'В боксе';
  if (s === 'stopped') return 'Красный флаг';
  return 'Бокс открыт';
};

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
  --ps-asphalt: #1a1a1a;
  --ps-lime: #ddf365;
  --ps-violet: #7451f4;
  --ps-cream: #eeeee8;
  max-width: 720px;
  margin: 0 auto;
  padding: 0 0 56px;
  overscroll-behavior-y: contain;
  touch-action: manipulation;
}

.ps-hub__hero {
  position: relative;
  margin: 0 0 20px;
  padding: 28px 20px 24px;
  background: var(--ps-asphalt);
  color: #fff;
  overflow: hidden;
  border-bottom: 4px solid var(--ps-lime);
}

.ps-hub__chequer {
  position: absolute;
  inset: 0 auto 0 0;
  width: 28px;
  background: repeating-conic-gradient(#111 0% 25%, #fff 0% 50%) 0 0 / 14px 14px;
  opacity: 0.9;
}

.ps-hub__hero-inner {
  position: relative;
  padding-left: 20px;
}

.ps-hub__eyebrow {
  margin: 0 0 10px;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ps-lime);
}

.ps-hub__title {
  margin: 0 0 10px;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: clamp(1.6rem, 5vw, 2.1rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.1;
}

.ps-hub__flag {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border: 2px solid #fff;
  border-radius: 10px;
  background: #111;
}

.ps-hub__lead {
  margin: 0 0 18px;
  max-width: 36em;
  font-size: 0.95rem;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.82);
}

.ps-hub__lap {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 6px;
  margin-bottom: 8px;
}

.ps-hub__lap-seg {
  height: 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.ps-hub__lap-seg.is-done {
  background: var(--ps-lime);
  border-color: var(--ps-lime);
}

.ps-hub__lap-label {
  margin: 0;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.7);
}

.ps-hub__lap-label strong {
  color: var(--ps-lime);
  font-weight: 700;
}

.ps-hub__join {
  margin: 0 16px 20px;
  padding: 18px 16px;
  background: var(--ps-cream);
  border: 2px solid #111;
  border-radius: 18px;
  box-shadow: 5px 5px 0 var(--ps-violet);
  display: grid;
  gap: 12px;
}

.ps-hub__join-badge {
  display: inline-block;
  padding: 4px 10px;
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  background: var(--ps-lime);
  border: 1.5px solid #111;
  border-radius: 999px;
}

.ps-hub__join-title {
  margin: 8px 0 4px;
  font-size: 1.15rem;
  font-weight: 800;
}

.ps-hub__join-hint {
  margin: 0 0 4px;
  font-size: 0.85rem;
  color: #555;
  line-height: 1.4;
}

.ps-hub__field {
  display: grid;
  gap: 6px;
  font-size: 0.8rem;
  font-weight: 700;
}

.ps-hub__input {
  min-height: 48px;
  padding: 10px 14px;
  border: 2px solid #111;
  border-radius: 12px;
  font-size: 1rem;
  background: #fff;
}

.ps-hub__check {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.85rem;
  min-height: 44px;
}

.ps-hub__cta {
  min-height: 52px;
  margin-top: 4px;
  border: 2px solid #111;
  border-radius: 14px;
  background: var(--ps-lime);
  font-weight: 800;
  font-size: 0.95rem;
  cursor: pointer;
  box-shadow: 3px 3px 0 #111;
}

.ps-hub__cta:disabled {
  opacity: 0.55;
  cursor: wait;
}

.ps-hub__cta:hover:not(:disabled) {
  transform: translate(-1px, -1px);
  box-shadow: 4px 4px 0 #111;
}

.ps-hub__lane {
  list-style: none;
  margin: 0;
  padding: 0 16px;
  display: grid;
  gap: 10px;
}

.ps-hub__card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  min-height: 72px;
  padding: 14px 16px;
  border: 2px solid #111;
  border-radius: 16px;
  background: #fff;
  text-decoration: none;
  color: inherit;
  box-shadow: 4px 4px 0 var(--ps-lime);
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}

.ps-hub__card:hover:not(.is-locked) {
  transform: translate(-2px, -2px);
  box-shadow: 6px 6px 0 var(--ps-lime);
}

.ps-hub__card.is-done {
  box-shadow: 4px 4px 0 #388073;
  background: color-mix(in srgb, #388073 8%, white);
}

.ps-hub__card.is-locked {
  opacity: 0.62;
  box-shadow: none;
  background: #f2f2ee;
  cursor: not-allowed;
}

.ps-hub__num {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  font-size: 0.85rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  border-radius: 12px;
  background: #111;
  color: var(--ps-lime);
  border: 2px solid #111;
}

.ps-hub__num--lock {
  background: #c8c8c0;
  color: #333;
}

.ps-hub__meta {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.ps-hub__meta strong {
  font-size: 0.95rem;
  line-height: 1.25;
  font-weight: 800;
}

.ps-hub__status {
  font-size: 0.72rem;
  font-weight: 600;
  color: #666;
  letter-spacing: 0.02em;
}

.ps-hub__go {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: var(--ps-violet);
  color: #fff;
  font-weight: 800;
  border: 2px solid #111;
}

.ps-hub__err {
  margin: 12px 16px 0;
  padding: 10px 12px;
  background: #ffe0e0;
  border: 2px solid #111;
  border-radius: 10px;
  font-weight: 600;
  font-size: 0.85rem;
}
</style>
