<template>
  <!-- Точка 1: свой экран-гараж, без общего hero/panel -->
  <div v-if="id === 1" class="pit-cp pit-cp--onescreen pit-garage">
    <header class="pit-garage__bar">
      <NuxtLink to="/event/pit-stop" class="pit-garage__back">← К трассе</NuxtLink>
      <span class="pit-garage__badge">01 · Ключ</span>
    </header>

    <p v-if="!unlocked" class="pit-garage__locked">
      Бокс ещё закрыт — откроется 28 сентября в 09:00 МСК
    </p>

    <template v-else>
      <div class="pit-garage__stage" aria-live="polite">
        <div class="pit-garage__door" :class="{ 'is-open': boxOpened }">
          <div class="pit-garage__door-panel" aria-hidden="true">
            <span class="pit-garage__chequer" />
            <span class="pit-garage__handle" />
          </div>
          <p class="pit-garage__sign">{{ boxOpened ? 'БОКС ОТКРЫТ' : 'ЗАПЕРТО' }}</p>
        </div>

        <div class="pit-garage__story">
          <h1 class="pit-garage__title">Ключ от гаража</h1>
          <p class="pit-garage__lead">
            Болид внутри. Замок ждёт полный шифр —
            <template v-if="partnerName">
              вторая половина у <strong>{{ partnerName }}</strong>.
            </template>
            <template v-else>вторая половина у напарника.</template>
          </p>
        </div>

        <div class="pit-garage__tags">
          <div class="pit-garage__tag pit-garage__tag--mine">
            <span class="pit-garage__tag-label">Твоя бирка</span>
            <code class="pit-garage__tag-code">VIBE_{{ cipherHalf || '····' }}</code>
          </div>
          <div class="pit-garage__tag pit-garage__tag--partner">
            <span class="pit-garage__tag-label">Бирка напарника</span>
            <code class="pit-garage__tag-code">VIBE_????</code>
            <span class="pit-garage__tag-hint">спроси в чате</span>
          </div>
        </div>

        <form class="pit-garage__lock" @submit.prevent="openBox">
          <label class="pit-garage__lock-label">
            Полный ключ
            <input
              v-model="codeInput"
              class="pit-garage__input"
              autocomplete="off"
              placeholder="VIBE_····_····"
              :disabled="boxOpened"
            />
          </label>
          <button
            type="submit"
            class="pit-garage__cta"
            :disabled="boxOpened || !codeInput.trim()"
          >
            {{ boxOpened ? 'Гараж открыт' : 'Открыть бокс' }}
          </button>
        </form>
      </div>
    </template>

    <p v-if="actionError" class="pit-garage__err">{{ actionError }}</p>
    <p v-if="actionOk" class="pit-garage__ok">{{ actionOk }}</p>
  </div>

  <!-- Остальные точки — временно общий каркас, у каждой свой интерактив позже -->
  <div v-else class="pit-cp">
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

      <section v-if="id === 2" class="pit-cp__panel">
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

      <section v-else-if="id === 5" class="pit-cp__panel">
        <input ref="fileRef" type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" hidden @change="uploadCoffee" />
        <button type="button" class="button primary pit-cp__btn" @click="fileRef?.click()">
          ЗАГРУЗИТЬ СЕЛФИ
        </button>
      </section>

      <!-- 6 пасхалка (после дозаправки) -->
      <section v-else-if="id === 6" class="pit-cp__panel">
        <label class="pit-cp__label">
          Секретный код
          <input v-model="codeInput" class="input" autocomplete="off" />
        </label>
        <button type="button" class="button primary pit-cp__btn" @click="submitEaster">Проверить</button>
      </section>

      <!-- 7 пазл (перед финишем) -->
      <section v-else-if="id === 7" class="pit-cp__panel">
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
const partnerName = ref('');
const pair = ref<PairState | null>(null);
const codeInput = ref('');
const isRemote = ref(false);
const actionError = ref('');
const actionOk = ref('');
const boxOpened = ref(false);
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
    partner: { name: string } | null;
    hub: { id: number; status: string }[];
    checkpoints: { id: number; unlocked: boolean; copy: { title: string; body: string } }[];
    player: { isRemote?: boolean } | null;
  }>('/api/event/pit-stop/me');
  const cp = data.checkpoints.find((c) => c.id === id.value);
  unlocked.value = Boolean(cp?.unlocked);
  copy.value = cp?.copy ?? null;
  cipherHalf.value = data.cipherHalf;
  partnerName.value = data.partner?.name || '';
  if (data.player?.isRemote != null) isRemote.value = data.player.isRemote;
  const hubItem = data.hub.find((h) => h.id === id.value);
  if (id.value === 1 && hubItem?.status === 'done') boxOpened.value = true;
};

const loadPair = async () => {
  if (![2, 3, 4, 7].includes(id.value)) return;
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
    boxOpened.value = true;
    actionOk.value = 'Бокс открыт — болид на пит-лейне.';
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
    const res = await $fetch<{ done?: boolean }>('/api/event/pit-stop/checkpoint/7/puzzle', {
      method: 'POST',
      body: { cell }
    });
    await loadPair();
    if (res.done) actionOk.value = 'Радар восстановлен!';
  });

const submitEaster = () =>
  withAction(async () => {
    await $fetch('/api/event/pit-stop/checkpoint/6/easter', {
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

/* ——— Гараж (точка 1), один экран ——— */
.pit-garage {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  padding: 0;
  background:
    radial-gradient(ellipse 80% 50% at 50% 0%, rgba(116, 81, 244, 0.22), transparent 55%),
    linear-gradient(180deg, #252528 0%, #1a1a1c 45%, #141416 100%);
  color: #f4f4f0;
  overflow: hidden;
}
.pit-garage__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 0 0 auto;
  gap: 12px;
  padding: 10px 16px 6px;
}
.pit-garage__back {
  font-weight: 700;
  font-size: 0.82rem;
  color: var(--ps-lime);
  text-decoration: none;
}
.pit-garage__badge {
  padding: 3px 10px;
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: var(--ps-lime);
  color: #111;
  border: 1.5px solid #111;
  border-radius: 999px;
}
.pit-garage__locked {
  margin: auto 20px;
  padding: 20px 16px;
  text-align: center;
  font-weight: 700;
  background: rgba(238, 238, 232, 0.08);
  border: 2px dashed rgba(238, 238, 232, 0.35);
  border-radius: 14px;
}
.pit-garage__stage {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-rows: minmax(0, 1.1fr) auto auto auto;
  gap: 10px;
  padding: 4px 16px 14px;
  align-content: stretch;
}
.pit-garage__door {
  position: relative;
  min-height: 0;
  display: grid;
  place-items: center;
  border: 2px solid #111;
  border-radius: 12px;
  background: #0e0e10;
  box-shadow: 4px 4px 0 #111;
  overflow: hidden;
}
.pit-garage__door-panel {
  position: absolute;
  inset: 8% 12% 18%;
  background: linear-gradient(180deg, #3a3a40 0%, #2a2a2e 55%, #1f1f22 100%);
  border: 2px solid #111;
  border-radius: 8px;
  transition: transform 0.55s cubic-bezier(0.22, 1, 0.36, 1);
  transform-origin: top center;
}
.pit-garage__door.is-open .pit-garage__door-panel {
  transform: translateY(-88%);
}
.pit-garage__chequer {
  position: absolute;
  inset: 0;
  opacity: 0.35;
  background: repeating-conic-gradient(#111 0% 25%, #fff 0% 50%) 0 0 / 18px 18px;
}
.pit-garage__handle {
  position: absolute;
  right: 10%;
  top: 50%;
  width: 14px;
  height: 36px;
  margin-top: -18px;
  border-radius: 6px;
  background: var(--ps-lime);
  border: 2px solid #111;
  box-shadow: 2px 2px 0 #111;
}
.pit-garage__sign {
  position: relative;
  z-index: 1;
  margin: 0;
  padding: 6px 14px;
  font-size: clamp(0.75rem, 2.2vw, 0.95rem);
  font-weight: 800;
  letter-spacing: 0.14em;
  background: var(--ps-violet);
  color: #fff;
  border: 2px solid #111;
  border-radius: 8px;
  box-shadow: 3px 3px 0 #111;
}
.pit-garage__door.is-open .pit-garage__sign {
  background: var(--ps-lime);
  color: #111;
}
.pit-garage__story {
  text-align: center;
  max-width: 36em;
  margin: 0 auto;
}
.pit-garage__title {
  margin: 0 0 4px;
  font-size: clamp(1.15rem, 3.2vw, 1.55rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.15;
}
.pit-garage__lead {
  margin: 0;
  font-size: clamp(0.78rem, 1.8vw, 0.9rem);
  line-height: 1.35;
  color: rgba(244, 244, 240, 0.78);
}
.pit-garage__lead strong {
  color: var(--ps-lime);
  font-weight: 800;
}
.pit-garage__tags {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  max-width: 520px;
  width: 100%;
  margin: 0 auto;
}
.pit-garage__tag {
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  border: 2px solid #111;
  border-radius: 12px;
  background: var(--ps-cream);
  color: #111;
  box-shadow: 3px 3px 0 var(--ps-violet);
}
.pit-garage__tag--partner {
  box-shadow: 3px 3px 0 var(--ps-lime);
  opacity: 0.92;
}
.pit-garage__tag-label {
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #555;
}
.pit-garage__tag-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: clamp(0.85rem, 2.4vw, 1.05rem);
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--ps-violet);
}
.pit-garage__tag--partner .pit-garage__tag-code {
  color: #666;
  letter-spacing: 0.08em;
}
.pit-garage__tag-hint {
  font-size: 0.68rem;
  font-weight: 700;
  color: #666;
}
.pit-garage__lock {
  display: grid;
  gap: 8px;
  max-width: 420px;
  width: 100%;
  margin: 0 auto;
}
.pit-garage__lock-label {
  display: grid;
  gap: 4px;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(244, 244, 240, 0.7);
}
.pit-garage__input {
  min-height: 48px;
  padding: 0 14px;
  border: 2px solid #111;
  border-radius: 12px;
  background: #fff;
  color: #111;
  font-size: 1rem;
  font-weight: 700;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.04em;
}
.pit-garage__input:disabled {
  opacity: 0.65;
}
.pit-garage__cta {
  min-height: 52px;
  border: 2px solid #111;
  border-radius: 14px;
  background: var(--ps-lime);
  color: #111;
  font-weight: 800;
  font-size: 0.95rem;
  cursor: pointer;
  box-shadow: 3px 3px 0 #111;
  touch-action: manipulation;
}
.pit-garage__cta:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  box-shadow: none;
}
.pit-garage__err,
.pit-garage__ok {
  flex: 0 0 auto;
  margin: 0 16px 10px;
  padding: 8px 12px;
  border-radius: 10px;
  font-weight: 700;
  font-size: 0.85rem;
}
.pit-garage__err {
  background: color-mix(in srgb, #c0392b 18%, transparent);
  border: 2px solid #c0392b;
  color: #ffb4a8;
}
.pit-garage__ok {
  background: color-mix(in srgb, #388073 22%, transparent);
  border: 2px solid #388073;
  color: #b8f0e0;
}

@media (max-height: 680px) {
  .pit-garage__stage {
    gap: 6px;
    padding-bottom: 8px;
  }
  .pit-garage__tag {
    padding: 8px 10px;
  }
  .pit-garage__lead {
    font-size: 0.78rem;
  }
}

/* ——— Общий каркас (точки 2–8, временно) ——— */
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
