<template>
  <div class="pit-cp">
    <div class="pit-cp__top">
      <NuxtLink to="/event/pit-stop" class="pit-cp__back">← К трассе</NuxtLink>
      <span class="pit-cp__badge">Чек-поинт {{ String(id).padStart(2, '0') }}</span>
    </div>

    <p v-if="!unlocked" class="pit-cp__locked">
      <span class="pit-cp__lock-ico" aria-hidden="true">🔒</span>
      Бокс ещё закрыт — откроется в 09:00 МСК
    </p>
    <template v-else-if="copy">
      <header class="pit-cp__hero">
        <div class="pit-cp__chequer" aria-hidden="true" />
        <h1 class="pit-cp__title">{{ copy.title.replace(/^Чек-поинт\s+\d+:\s*/i, '') }}</h1>
        <p class="pit-cp__body">{{ copy.body }}</p>
      </header>

      <!-- 1 cipher -->
      <section v-if="id === 1" class="pit-cp__panel">
        <p class="pit-cp__code">
          Твой код: <strong>VIBE_{{ cipherHalf || '····' }}</strong>
        </p>
        <label class="pit-cp__label">
          Введите полный код
          <input v-model="codeInput" class="input" autocomplete="off" />
        </label>
        <button type="button" class="button primary pit-cp__btn" @click="openBox">
          ОТКРЫТЬ БОКС
        </button>
      </section>

      <!-- 2 assembly -->
      <section v-else-if="id === 2" class="pit-cp__panel">
        <p>Шаг {{ pair?.assemblyStep ?? 0 }}/6 · ход: {{ pair?.assemblyMyTurn ? 'твой' : 'напарника' }}</p>
        <button
          type="button"
          class="button primary pit-cp__btn"
          :disabled="!pair?.assemblyMyTurn || pair?.assemblyDone"
          @click="installPart"
        >
          {{ pair?.assemblyLabel || 'Готово' }}
        </button>
        <p v-if="pair?.assemblyDone" class="pit-cp__ok">Болид собран · ливрея «14 Years on Track»</p>
      </section>

      <!-- 3 ignition -->
      <section v-else-if="id === 3" class="pit-cp__panel">
        <p class="pit-cp__status">
          {{
            pair?.ignitionPartnerHolds
              ? 'Напарник держит тумблер…'
              : 'Ожидание напарника…'
          }}
        </p>
        <button
          type="button"
          class="button primary pit-cp__btn pit-cp__btn--ignition"
          @pointerdown.prevent="setIgnition(true)"
          @pointerup.prevent="setIgnition(false)"
          @pointerleave.prevent="setIgnition(false)"
          @pointercancel.prevent="setIgnition(false)"
        >
          ЗАЖИГАНИЕ
        </button>
      </section>

      <!-- 4 blind -->
      <section v-else-if="id === 4" class="pit-cp__panel">
        <p v-if="pair?.blindRole === 'navigator'" class="pit-cp__maze" aria-label="Лабиринт">
          <span
            v-for="cell in 49"
            :key="cell"
            class="pit-cp__cell"
            :class="{
              'is-car': carIndex === cell - 1,
              'is-finish': finishIndex === cell - 1
            }"
          />
        </p>
        <p v-else class="pit-cp__fog">ПОМЕХИ · слушай навигатора</p>
        <div class="pit-cp__arrows">
          <button type="button" class="pit-cp__arrow" :disabled="pair?.blindRole !== 'pilot'" @click="blindMove('left')">
            ⬅️
          </button>
          <button type="button" class="pit-cp__arrow" :disabled="pair?.blindRole !== 'pilot'" @click="blindMove('up')">
            ⬆️
          </button>
          <button type="button" class="pit-cp__arrow" :disabled="pair?.blindRole !== 'pilot'" @click="blindMove('right')">
            ➡️
          </button>
        </div>
        <button v-if="!pair?.blindStartedAt" type="button" class="button ghost pit-cp__btn" @click="blindStart">
          Старт 45 с
        </button>
      </section>

      <!-- 5 coffee -->
      <section v-else-if="id === 5" class="pit-cp__panel">
        <input ref="fileRef" type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" hidden @change="uploadCoffee" />
        <button type="button" class="button primary pit-cp__btn" @click="fileRef?.click()">
          ЗАГРУЗИТЬ СЕЛФИ
        </button>
      </section>

      <!-- 6 puzzle -->
      <section v-else-if="id === 6" class="pit-cp__panel">
        <p class="muted">Твои неоновые ячейки видны напарнику — кликай те, что диктует он.</p>
        <div class="pit-cp__grid">
          <button
            v-for="n in 16"
            :key="n"
            type="button"
            class="pit-cp__grid-cell"
            :class="{
              'is-glow': pair?.puzzleMyGlow?.includes(n - 1),
              'is-pressed': pair?.puzzleMyPressed?.includes(n - 1)
            }"
            @click="pressPuzzle(n - 1)"
          >
            {{ n }}
          </button>
        </div>
      </section>

      <!-- 7 easter -->
      <section v-else-if="id === 7" class="pit-cp__panel">
        <label class="pit-cp__label">
          Секретный код
          <input v-model="codeInput" class="input" autocomplete="off" />
        </label>
        <button type="button" class="button primary pit-cp__btn" @click="submitEaster">Проверить</button>
      </section>

      <!-- 8 finale -->
      <section v-else-if="id === 8" class="pit-cp__panel">
        <label class="pit-cp__remote">
          <input v-model="isRemote" type="checkbox" />
          Я на удалёнке
        </label>
        <p v-if="!isRemote">Сканируй QR на картодроме и введи код:</p>
        <p v-else>Смотри видео и введи кодовое слово из титров:</p>
        <input v-model="codeInput" class="input" autocomplete="off" />
        <button type="button" class="button primary pit-cp__btn" @click="finishFlag">Финиш</button>
        <div v-if="isRemote" class="pit-cp__video pit-cp__video--placeholder">
          Праздничное видео появится здесь к 9 октября
        </div>
      </section>
    </template>

    <p v-if="actionError" class="vac-emp-error">{{ actionError }}</p>
    <p v-if="actionOk" class="pit-cp__ok">{{ actionOk }}</p>
  </div>
</template>

<script setup lang="ts">
const route = useRoute();
const id = computed(() => Number(route.params.id));

type PairState = {
  assemblyStep: number;
  assemblyMyTurn: boolean;
  assemblyDone: boolean;
  assemblyLabel: string | null;
  ignitionPartnerHolds: boolean;
  blindRole: 'navigator' | 'pilot';
  blindX: number;
  blindY: number;
  blindStartedAt: string | null;
  puzzleMyGlow: number[];
  puzzleMyPressed: number[];
};

const copy = ref<{ title: string; body: string } | null>(null);
const unlocked = ref(false);
const cipherHalf = ref<string | null>(null);
const pair = ref<PairState | null>(null);
const codeInput = ref('');
const isRemote = ref(false);
const actionError = ref('');
const actionOk = ref('');
const fileRef = ref<HTMLInputElement | null>(null);
let pollTimer: ReturnType<typeof setInterval> | null = null;

const carIndex = computed(() => {
  if (!pair.value) return -1;
  return pair.value.blindY * 7 + pair.value.blindX;
});
const finishIndex = 4 * 7 + 4;

const loadMe = async () => {
  const data = await $fetch<{
    cipherHalf: string | null;
    checkpoints: { id: number; unlocked: boolean; copy: { title: string; body: string } }[];
    player: { isRemote?: boolean } | null;
  }>('/api/event/pit-stop/me');
  const cp = data.checkpoints.find((c) => c.id === id.value);
  unlocked.value = Boolean(cp?.unlocked);
  copy.value = cp?.copy ?? null;
  cipherHalf.value = data.cipherHalf;
  if (data.player?.isRemote != null) isRemote.value = data.player.isRemote;
};

const loadPair = async () => {
  if (![2, 3, 4, 6].includes(id.value)) return;
  const data = await $fetch<{ pair: PairState | null }>('/api/event/pit-stop/pair-state');
  pair.value = data.pair;
};

const withAction = async (fn: () => Promise<void>) => {
  actionError.value = '';
  actionOk.value = '';
  try {
    await fn();
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; message?: string };
    actionError.value = err?.data?.statusMessage || err?.message || 'Ошибка';
  }
};

const openBox = () =>
  withAction(async () => {
    await $fetch('/api/event/pit-stop/checkpoint/1/open', {
      method: 'POST',
      body: { code: codeInput.value }
    });
    actionOk.value = 'Бокс открыт!';
  });

const installPart = () =>
  withAction(async () => {
    const res = await $fetch<{ done?: boolean }>('/api/event/pit-stop/checkpoint/2/install', {
      method: 'POST'
    });
    await loadPair();
    if (res.done) actionOk.value = 'Сборка завершена!';
  });

const setIgnition = (held: boolean) =>
  withAction(async () => {
    const res = await $fetch<{ started?: boolean }>('/api/event/pit-stop/checkpoint/3/ignition', {
      method: 'POST',
      body: { held }
    });
    await loadPair();
    if (res.started) actionOk.value = 'Двигатель заведён!';
  });

const blindStart = () =>
  withAction(async () => {
    await $fetch('/api/event/pit-stop/checkpoint/4/move', {
      method: 'POST',
      body: { start: true }
    });
    await loadPair();
  });

const blindMove = (dir: 'left' | 'up' | 'right') =>
  withAction(async () => {
    const res = await $fetch<{ finished?: boolean }>('/api/event/pit-stop/checkpoint/4/move', {
      method: 'POST',
      body: { dir }
    });
    await loadPair();
    if (res.finished) actionOk.value = 'Финишный торт достигнут!';
  });

const uploadCoffee = async (ev: Event) => {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  await withAction(async () => {
    const fd = new FormData();
    fd.append('photo', file);
    await $fetch('/api/event/pit-stop/checkpoint/5/coffee', { method: 'POST', body: fd });
    actionOk.value = 'Фото ушло на проверку HR';
  });
};

const pressPuzzle = (cell: number) =>
  withAction(async () => {
    const res = await $fetch<{ done?: boolean }>('/api/event/pit-stop/checkpoint/6/puzzle', {
      method: 'POST',
      body: { cell }
    });
    await loadPair();
    if (res.done) actionOk.value = 'Радар восстановлен!';
  });

const submitEaster = () =>
  withAction(async () => {
    await $fetch('/api/event/pit-stop/checkpoint/7/easter', {
      method: 'POST',
      body: { code: codeInput.value }
    });
    actionOk.value = 'Датчик найден!';
  });

const finishFlag = () =>
  withAction(async () => {
    await $fetch('/api/event/pit-stop/checkpoint/8/finish', {
      method: 'POST',
      body: { code: codeInput.value, isRemote: isRemote.value }
    });
    actionOk.value = 'Клетчатый флаг!';
  });

onMounted(async () => {
  await $fetch('/api/event/pit-stop/join', { method: 'POST', body: {} });
  await loadMe();
  await loadPair();
  pollTimer = setInterval(loadPair, 1200);
});

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
});
</script>

<style scoped>
.pit-cp {
  --ps-asphalt: #1a1a1a;
  --ps-lime: #ddf365;
  --ps-violet: #7451f4;
  --ps-cream: #eeeee8;
  width: 100%;
  max-width: none;
  margin: 0;
  padding: 0 0 64px;
  overscroll-behavior-y: contain;
  touch-action: manipulation;
}
.pit-cp__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 24px 10px;
}
.pit-cp__back {
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--ps-violet);
  text-decoration: none;
}
.pit-cp__badge {
  padding: 4px 10px;
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  background: var(--ps-lime);
  border: 1.5px solid #111;
  border-radius: 999px;
}
.pit-cp__hero {
  position: relative;
  margin: 0 0 20px;
  padding: 28px 28px 28px 44px;
  background: var(--ps-asphalt);
  color: #fff;
  border-bottom: 4px solid var(--ps-lime);
  overflow: hidden;
}
.pit-cp__chequer {
  position: absolute;
  inset: 0 auto 0 0;
  width: 18px;
  background: repeating-conic-gradient(#111 0% 25%, #fff 0% 50%) 0 0 / 12px 12px;
}
.pit-cp__title {
  margin: 0 0 10px;
  max-width: 28em;
  font-size: clamp(1.35rem, 3vw, 1.75rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.2;
}
.pit-cp__body {
  margin: 0;
  max-width: 42em;
  line-height: 1.45;
  font-size: 0.95rem;
  color: rgba(255, 255, 255, 0.82);
}
.pit-cp__panel {
  display: grid;
  gap: 14px;
  margin: 0 24px;
  padding: 22px 20px;
  max-width: 640px;
  background: var(--ps-cream);
  border: 2px solid #111;
  border-radius: 18px;
  box-shadow: 5px 5px 0 var(--ps-violet);
}
.pit-cp__label {
  display: grid;
  gap: 6px;
  font-weight: 700;
  font-size: 0.8rem;
}
.pit-cp__btn {
  min-height: 52px;
  min-width: 48px;
  border: 2px solid #111;
  border-radius: 14px;
  background: var(--ps-lime);
  font-weight: 800;
  font-size: 0.9rem;
  cursor: pointer;
  box-shadow: 3px 3px 0 #111;
}
.pit-cp__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.pit-cp__btn--ignition {
  min-height: 80px;
  font-size: 1.15rem;
  background: #fff;
  color: #111;
}
.pit-cp__btn--ignition:active {
  background: var(--ps-lime);
}
.pit-cp__code {
  font-size: 1.05rem;
  font-weight: 700;
}
.pit-cp__code strong {
  font-family: ui-monospace, monospace;
  letter-spacing: 0.06em;
  color: var(--ps-violet);
}
.pit-cp__ok {
  margin: 12px 24px 0;
  padding: 10px 12px;
  max-width: 640px;
  background: color-mix(in srgb, #388073 18%, white);
  border: 2px solid #388073;
  border-radius: 12px;
  color: #1f4a42;
  font-weight: 700;
}
.pit-cp__locked {
  margin: 24px 24px;
  padding: 28px 18px;
  text-align: center;
  font-size: 1rem;
  font-weight: 700;
  background: #f2f2ee;
  border: 2px dashed #111;
  border-radius: 16px;
}
.pit-cp__lock-ico {
  display: block;
  margin-bottom: 8px;
  font-size: 1.6rem;
}
.pit-cp__arrows {
  display: flex;
  gap: 12px;
  justify-content: center;
}
.pit-cp__arrow {
  width: 56px;
  height: 56px;
  border: 2px solid #111;
  border-radius: 14px;
  background: var(--ps-lime);
  font-size: 1.4rem;
  touch-action: manipulation;
  box-shadow: 2px 2px 0 #111;
}
.pit-cp__arrow:disabled {
  opacity: 0.4;
}
.pit-cp__maze {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  aspect-ratio: 1;
  padding: 8px;
  background: #111;
  border-radius: 12px;
}
.pit-cp__cell {
  background: #3a3a3a;
  border-radius: 4px;
}
.pit-cp__cell.is-car {
  background: var(--ps-violet);
}
.pit-cp__cell.is-finish {
  background: var(--ps-lime);
}
.pit-cp__fog {
  padding: 48px 16px;
  text-align: center;
  font-weight: 800;
  letter-spacing: 0.08em;
  background: #111;
  color: var(--ps-lime);
  border-radius: 12px;
  border: 2px solid var(--ps-lime);
}
.pit-cp__grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.pit-cp__grid-cell {
  min-width: 48px;
  min-height: 48px;
  border: 2px solid #111;
  border-radius: 12px;
  background: #fff;
  font-weight: 800;
  touch-action: manipulation;
}
.pit-cp__grid-cell.is-glow {
  box-shadow: inset 0 0 0 3px var(--ps-violet);
}
.pit-cp__grid-cell.is-pressed {
  background: var(--ps-lime);
}
.pit-cp__video {
  width: 100%;
  border-radius: 12px;
  background: #111;
  min-height: 160px;
}
.pit-cp__video--placeholder {
  display: grid;
  place-items: center;
  padding: 24px 16px;
  color: var(--ps-lime);
  font-weight: 700;
  font-size: 0.9rem;
  text-align: center;
  border: 2px dashed rgba(221, 243, 101, 0.5);
}
.pit-cp__remote {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
}
.pit-cp :deep(.input),
.pit-cp input.input {
  min-height: 48px;
  border: 2px solid #111;
  border-radius: 12px;
}
.vac-emp-error {
  margin: 12px 24px 0;
}
</style>
