<template>
  <!-- Точка 1: арт гаража full-bleed + тонкий UI поверх -->
  <div v-if="id === 1" class="pit-cp pit-cp--onescreen pit-garage">
    <div class="pit-garage__scene" aria-live="polite">
      <img
        class="pit-garage__art"
        :src="boxOpened ? garageArtOpen : garageArtLocked"
        :alt="boxOpened ? 'Бокс открыт — болид на пит-лейне' : 'Закрытый гараж с болидом №14'"
        draggable="false"
      />

      <header class="pit-garage__bar">
        <NuxtLink to="/event/pit-stop" class="pit-garage__back">← Трасса</NuxtLink>
        <span class="pit-garage__badge">01</span>
      </header>

      <p v-if="!unlocked" class="pit-garage__locked">
        Бокс ещё закрыт — 28 сентября в 09:00 МСК
      </p>

      <div v-else class="pit-garage__hud" :class="{ 'is-done': boxOpened }">
        <aside class="pit-garage__guide">
          <PitStopRaccoonGuide
            size="cp"
            :line="raccoonLine"
            :show-nav="cp1ShowNav"
            :next-label="cp1NextLabel"
            @next="onCp1Next"
          />
        </aside>

        <template v-if="!boxOpened">
          <div class="pit-garage__tags" aria-label="Бирки шифра">
            <img
              class="pit-garage__tags-art"
              src="/events/pit-stop-14/cp1/key-tags.png"
              alt=""
              draggable="false"
            />
            <code class="pit-garage__tag-code pit-garage__tag-code--mine">
              {{ cipherHalf || '····' }}
            </code>
            <code class="pit-garage__tag-code pit-garage__tag-code--partner">????</code>
            <span class="pit-garage__tag-hint">спроси в чате</span>
          </div>

          <form class="pit-garage__lock" @submit.prevent="openBox">
            <input
              v-model="codeInput"
              class="pit-garage__input"
              autocomplete="off"
              placeholder="····_····"
              aria-label="Полный ключ"
            />
            <button
              type="submit"
              class="pit-garage__cta"
              :disabled="!codeInput.trim()"
            >
              Открыть гараж
            </button>
          </form>

          <p v-if="actionError" class="pit-garage__err">{{ actionError }}</p>
        </template>

        <div v-else class="pit-garage__next">
          <button type="button" class="pit-garage__next-btn" @click="goToNextCheckpoint">
            К следующему заданию
          </button>
        </div>
      </div>
    </div>
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
import { RACCOON_CP1_LINES } from '~/events/pit-stop-14/raccoonLines';

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
const cp1Step = ref(0);
const fileRef = ref<HTMLInputElement | null>(null);
const garageArtLocked = '/events/pit-stop-14/cp1/garage-locked.png';
const garageArtOpen = '/events/pit-stop-14/cp1/garage-open.png';
let pollTimer: ReturnType<typeof setInterval> | null = null;

/** Точка 1: строго 1 → 2 → 3, потом afterOpen после открытия. */
const cp1Lines = computed(() => {
  if (boxOpened.value) return [RACCOON_CP1_LINES.afterOpen];
  return [
    RACCOON_CP1_LINES.intro,
    RACCOON_CP1_LINES.rule,
    RACCOON_CP1_LINES.withPartner(partnerName.value)
  ];
});

const raccoonLine = computed(() => {
  const lines = cp1Lines.value;
  const i = Math.min(cp1Step.value, lines.length - 1);
  return lines[i] || lines[0];
});

const cp1ShowNav = computed(() => !boxOpened.value && cp1Step.value < cp1Lines.value.length - 1);

const cp1NextLabel = computed(() => 'Дальше');

const onCp1Next = () => {
  if (cp1Step.value < cp1Lines.value.length - 1) cp1Step.value += 1;
};

const goToNextCheckpoint = () => {
  const nextId = Math.min(8, id.value + 1);
  navigateTo({ path: '/event/pit-stop', query: { pulse: String(nextId) } });
};

watch(boxOpened, (opened) => {
  if (opened) cp1Step.value = 0;
});

watch(id, () => {
  cp1Step.value = 0;
});

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
    player: { isRemote?: boolean; role?: 'A' | 'B' | null } | null;
  }>('/api/event/pit-stop/me');
  const cp = data.checkpoints.find((c) => c.id === id.value);
  unlocked.value = Boolean(cp?.unlocked);
  copy.value = cp?.copy ?? null;
  cipherHalf.value = data.cipherHalf;
  partnerName.value = data.partner?.name || '';
  if (data.player?.isRemote != null) isRemote.value = data.player.isRemote;
  const hubItem = data.hub.find((h) => h.id === id.value);
  if (id.value === 1 && hubItem?.status === 'done') boxOpened.value = true;
  // Точка 1: в поле уже своя половина кода (4 буквы), без VIBE_
  if (id.value === 1 && data.cipherHalf && !boxOpened.value && !codeInput.value) {
    const half = data.cipherHalf.toUpperCase();
    codeInput.value = data.player?.role === 'B' ? `____${half}` : `${half}____`;
  }
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
    actionOk.value = 'Гараж открыт, болид на месте.';
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

/* ——— Гараж (точка 1): арт full-bleed + HUD ——— */
.pit-garage {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  padding: 0;
  background: #121214;
  color: #f4f4f0;
  overflow: hidden;
}
.pit-garage__scene {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  overflow: hidden;
}
.pit-garage__art {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 35%;
  user-select: none;
  pointer-events: none;
}
.pit-garage__bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.55) 0%, transparent 100%);
}
.pit-garage__back {
  font-weight: 700;
  font-size: 0.82rem;
  color: #ddf365;
  text-decoration: none;
  text-shadow: 0 1px 2px #000;
}
.pit-garage__badge {
  padding: 3px 10px;
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  background: #ddf365;
  color: #111;
  border: 1.5px solid #111;
  border-radius: 999px;
}
.pit-garage__locked {
  position: absolute;
  z-index: 3;
  left: 16px;
  right: 16px;
  bottom: 28%;
  margin: 0;
  padding: 16px 14px;
  text-align: center;
  font-weight: 700;
  background: rgba(18, 18, 20, 0.82);
  border: 2px solid rgba(221, 243, 101, 0.45);
  border-radius: 14px;
  backdrop-filter: blur(6px);
}
.pit-garage__hud {
  position: absolute;
  z-index: 3;
  left: 0;
  right: 0;
  bottom: 0;
  display: grid;
  gap: 8px;
  padding: 48px 14px 14px;
  background: linear-gradient(
    180deg,
    transparent 0%,
    rgba(10, 10, 12, 0.55) 18%,
    rgba(10, 10, 12, 0.92) 55%,
    #0a0a0c 100%
  );
}
.pit-garage__guide {
  width: min(640px, 100%);
  margin: 0 auto;
}
.pit-garage__guide :deep(.ps-raccoon__btn--ghost) {
  color: #eeeee8;
  border-color: rgba(238, 238, 232, 0.45);
}
.pit-garage__hud.is-done {
  padding-top: 20px;
}
.pit-garage__hud.is-done .pit-garage__guide {
  width: min(720px, 100%);
}
.pit-garage__hud.is-done :deep(.ps-raccoon--cp .ps-raccoon__art) {
  width: clamp(180px, 30vmin, 280px);
  max-height: clamp(220px, 40vmin, 320px);
}
.pit-garage__next {
  width: min(420px, 100%);
  margin: 8px auto 0;
  display: grid;
}
.pit-garage__next-btn {
  min-height: 52px;
  border: 2px solid #111;
  border-radius: 14px;
  background: #ddf365;
  color: #111;
  font-weight: 800;
  font-size: 0.95rem;
  cursor: pointer;
  box-shadow: 3px 3px 0 #111;
  touch-action: manipulation;
}
.pit-garage__tags {
  position: relative;
  width: min(360px, 92vw);
  margin: 0 auto;
  aspect-ratio: 16 / 9;
}
.pit-garage__tags-art {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  user-select: none;
  pointer-events: none;
}
.pit-garage__tag-code {
  position: absolute;
  top: 52%;
  width: 38%;
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: clamp(0.62rem, 2.4vw, 0.78rem);
  font-weight: 800;
  letter-spacing: 0.02em;
  text-align: center;
  line-height: 1.1;
  pointer-events: none;
}
.pit-garage__tag-code--mine {
  left: 6%;
  color: #fff;
  text-shadow: 0 1px 2px #000;
}
.pit-garage__tag-code--partner {
  right: 6%;
  color: #222;
}
.pit-garage__tag-hint {
  position: absolute;
  right: 8%;
  bottom: 6%;
  font-size: 0.62rem;
  font-weight: 700;
  color: rgba(244, 244, 240, 0.65);
}
.pit-garage__lock {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  width: min(420px, 100%);
  margin: 0 auto;
}
.pit-garage__input {
  min-height: 48px;
  padding: 0 14px;
  border: 2px solid #111;
  border-radius: 12px;
  background: #eeeee8;
  color: #111;
  font-size: 0.95rem;
  font-weight: 700;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.03em;
  box-shadow: 3px 3px 0 #7451f4;
}
.pit-garage__input:disabled {
  opacity: 0.65;
}
.pit-garage__cta {
  min-height: 48px;
  padding: 0 16px;
  border: 2px solid #111;
  border-radius: 12px;
  background: #ddf365;
  color: #111;
  font-weight: 800;
  font-size: 0.85rem;
  cursor: pointer;
  box-shadow: 3px 3px 0 #111;
  white-space: nowrap;
  touch-action: manipulation;
}
.pit-garage__cta:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  box-shadow: none;
}
.pit-garage__err,
.pit-garage__ok {
  margin: 0 auto;
  max-width: 420px;
  width: 100%;
  padding: 8px 12px;
  border-radius: 10px;
  font-weight: 700;
  font-size: 0.82rem;
  text-align: center;
}
.pit-garage__err {
  background: color-mix(in srgb, #c0392b 28%, transparent);
  border: 2px solid #c0392b;
  color: #ffb4a8;
}
.pit-garage__ok {
  background: color-mix(in srgb, #388073 28%, transparent);
  border: 2px solid #388073;
  color: #b8f0e0;
}

@media (max-height: 720px) {
  .pit-garage__hud {
    gap: 6px;
    padding-top: 36px;
    padding-bottom: 10px;
  }
  .pit-garage__tags {
    width: min(280px, 78vw);
  }
}

@media (min-width: 900px) {
  .pit-garage__art {
    object-position: center 42%;
  }
  .pit-garage__hud {
    padding-left: 24px;
    padding-right: 24px;
  }
  .pit-garage__tags {
    width: min(400px, 40vw);
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
