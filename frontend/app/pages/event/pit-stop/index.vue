<template>
  <div class="pit-stop-page">
    <header class="pit-stop-page__head">
      <p class="pit-stop-page__eyebrow">Корпоратив · 9 октября</p>
      <h1 class="pit-stop-page__title">{{ hubTitle }}</h1>
      <p class="pit-stop-page__lead">{{ hubLead }}</p>
      <p v-if="me?.partner" class="pit-stop-page__partner">
        Напарник: <strong>{{ me.partner.name }}</strong>
        · прогресс {{ me.player?.completed ?? 0 }}/8
      </p>
      <p v-else class="pit-stop-page__partner muted">
        Пара ещё не назначена — укажи ID напарника или попроси HR.
      </p>
    </header>

    <form v-if="!me?.partner" class="pit-stop-join" @submit.prevent="joinPair">
      <label class="pit-stop-join__label">
        ID напарника (Bitrix / Vibe)
        <input v-model="partnerIdInput" class="input" type="number" min="1" required />
      </label>
      <label class="pit-stop-join__remote">
        <input v-model="isRemote" type="checkbox" />
        Я на удалёнке (для финала 9.10)
      </label>
      <button type="submit" class="button primary" :disabled="joining">Создать пару</button>
      <p v-if="joinError" class="vac-emp-error">{{ joinError }}</p>
    </form>

    <ol v-if="hub.length" class="pit-stop-hub">
      <li v-for="item in hub" :key="item.id" class="pit-stop-hub__item">
        <NuxtLink
          v-if="item.unlocked && item.status !== 'locked' && item.status !== 'stopped'"
          :to="`/event/pit-stop/${item.id}`"
          class="pit-stop-hub__card"
          :class="`is-${item.status}`"
        >
          <span class="pit-stop-hub__num">{{ item.id }}</span>
          <span class="pit-stop-hub__meta">
            <strong>{{ item.title }}</strong>
            <span class="pit-stop-hub__status">{{ statusLabel(item.status) }}</span>
          </span>
        </NuxtLink>
        <div v-else class="pit-stop-hub__card is-locked" aria-disabled="true">
          <span class="pit-stop-hub__num" aria-hidden="true">🔒</span>
          <span class="pit-stop-hub__meta">
            <strong>{{ item.title }}</strong>
            <span class="pit-stop-hub__status">{{ item.lockedLabel || 'LOCKED' }}</span>
          </span>
        </div>
      </li>
    </ol>

    <p v-if="loadError" class="vac-emp-error">{{ loadError }}</p>
  </div>
</template>

<script setup lang="ts">
import {
  PIT_STOP_HUB_LEAD,
  PIT_STOP_HUB_TITLE
} from '~/events/pit-stop-14';

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

const statusLabel = (s: string) => {
  if (s === 'done') return 'Пройдено';
  if (s === 'pending_review') return 'На проверке HR';
  if (s === 'in_progress') return 'В процессе';
  if (s === 'stopped') return 'Игра остановлена';
  return 'Открыто';
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
.pit-stop-page {
  max-width: 720px;
  margin: 0 auto;
  padding: 16px 16px 48px;
  overscroll-behavior-y: contain;
  touch-action: manipulation;
}
.pit-stop-page__eyebrow {
  margin: 0 0 6px;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #7451f4;
}
.pit-stop-page__title {
  margin: 0 0 8px;
  font-size: 1.6rem;
  font-weight: 800;
}
.pit-stop-page__lead {
  margin: 0 0 12px;
  color: #4a4a4a;
  line-height: 1.45;
}
.pit-stop-page__partner {
  margin: 0 0 20px;
  font-size: 0.9rem;
}
.pit-stop-join {
  display: grid;
  gap: 12px;
  margin-bottom: 24px;
  padding: 16px;
  background: #eeeee8;
  border: 2px solid #111;
  border-radius: 16px;
}
.pit-stop-join__label {
  display: grid;
  gap: 6px;
  font-weight: 600;
  font-size: 0.85rem;
}
.pit-stop-join__remote {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
}
.pit-stop-hub {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 12px;
}
.pit-stop-hub__card {
  display: flex;
  gap: 14px;
  align-items: center;
  min-height: 64px;
  padding: 14px 16px;
  border: 2px solid #111;
  border-radius: 16px;
  background: #fff;
  text-decoration: none;
  color: inherit;
  box-shadow: 4px 4px 0 #ddf365;
}
.pit-stop-hub__card.is-locked {
  opacity: 0.55;
  box-shadow: none;
  background: #f3f3f0;
}
.pit-stop-hub__card.is-done {
  box-shadow: 4px 4px 0 #388073;
}
.pit-stop-hub__num {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  font-weight: 800;
  border-radius: 12px;
  background: #111;
  color: #ddf365;
}
.pit-stop-hub__meta {
  display: grid;
  gap: 4px;
  min-width: 0;
}
.pit-stop-hub__meta strong {
  font-size: 0.95rem;
  line-height: 1.25;
}
.pit-stop-hub__status {
  font-size: 0.75rem;
  color: #666;
}
</style>
