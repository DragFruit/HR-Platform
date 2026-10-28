<template>
  <div v-if="enabled" class="hw-layer" aria-hidden="true">
    <!--
      Тыквы живут на полосе подвала, а не на вьюпорте: полоса во всю ширину
      экрана накрывала сайдбар и садилась прямо на кнопку «Выйти». В подвале
      им место между логотипом и соцсетями, там только декоративная линейка.
    -->
    <Teleport to=".app-site-footer" :disabled="!footerReady">
    <div class="hw-pumpkins">
      <button
        v-for="p in visiblePumpkins"
        :key="p.id"
        type="button"
        class="hw-pumpkin"
        :class="{ 'is-broken': p.broken }"
        :style="{ left: `${p.x}%`, '--hw-scale': String(p.scale), '--hw-ratio': String(p.ratio) }"
        :tabindex="-1"
        @click="breakPumpkin(p.id)"
      >
        <img
          v-if="!p.broken"
          class="hw-pumpkin__whole"
          :src="p.whole"
          alt=""
          draggable="false"
        />
        <template v-else>
          <img class="hw-pumpkin__half hw-pumpkin__half--l" :src="p.left" alt="" draggable="false" />
          <img class="hw-pumpkin__half hw-pumpkin__half--r" :src="p.right" alt="" draggable="false" />
        </template>
      </button>
    </div>
    </Teleport>

    <div v-if="motionAllowed" class="hw-ghosts">
      <img
        v-for="g in GHOSTS"
        :key="g.id"
        class="hw-ghost"
        :src="ART.ghost"
        alt=""
        draggable="false"
        :style="{
          top: `${g.top}%`,
          animationDuration: `${g.duration}s`,
          animationDelay: `${g.delay}s`,
          '--hw-ghost-scale': String(g.scale)
        }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Тыквы и призраки. Тыкву можно разломать кликом: половинки остаются лежать
 * до конца захода, при следующем открытии сломанной тыквы нет совсем, а через
 * двое суток она вырастает заново.
 *
 * Состояние держим в браузере: это косметика, ради неё не стоит нагружать
 * сервер. Плата честная — на другом устройстве тыквы снова целые.
 */
const ART = {
  ghost: '/decor/halloween/ghost.png'
} as const;

/**
 * Тыквы разные: одиночные, стопкой, парой, с призраками, с котом. У каждой
 * свои пропорции, поэтому ширину считаем от высоты, а не задаём наугад.
 */
type PumpkinArt = { src: string; ratio: number };

const PUMPKIN_ART: Record<string, PumpkinArt> = {
  ghosts: { src: 'pumpkin-ghosts', ratio: 1.13 },
  classic: { src: 'pumpkin-classic', ratio: 1.49 },
  skull: { src: 'pumpkin-skull', ratio: 1.3 },
  stack: { src: 'pumpkin-stack', ratio: 0.92 },
  pair: { src: 'pumpkin-pair', ratio: 1.21 },
  witch: { src: 'pumpkin-witch', ratio: 0.93 }
};

const art = (kind: string, part: '' | '-left' | '-right' = '') =>
  `/decor/halloween/${PUMPKIN_ART[kind]?.src ?? 'pumpkin-classic'}${part}.png`;

const PUMPKIN_REGROW_MS = 2 * 24 * 60 * 60 * 1000;
const PUMPKINS_KEY = 'vbi-halloween-pumpkins';

/**
 * Координаты внутри подвала, а не вьюпорта: слева логотип VBI, справа
 * соцсети, между ними декоративная линейка — туда и сажаем.
 */
const PUMPKINS = [
  { id: 'p1', x: 20, scale: 1, kind: 'classic' },
  { id: 'p2', x: 34, scale: 1.15, kind: 'stack' },
  { id: 'p3', x: 47, scale: 0.95, kind: 'pair' },
  { id: 'p4', x: 60, scale: 1.05, kind: 'witch' },
  { id: 'p5', x: 71, scale: 0.9, kind: 'skull' }
] as const;

const GHOSTS = [
  { id: 'g1', top: 24, duration: 54, delay: 0, scale: 1 },
  { id: 'g2', top: 58, duration: 73, delay: 18, scale: 0.72 }
] as const;

const { enabled, motionAllowed } = useHalloweenDecor();

/** id → когда сломали (ISO). */
const brokenAt = ref<Record<string, string>>({});
/** Сломанные прямо сейчас — только им показываем половинки. */
const brokenNow = ref<Set<string>>(new Set());

function readBroken(): Record<string, string> {
  if (!import.meta.client) return {};
  try {
    const raw = JSON.parse(localStorage.getItem(PUMPKINS_KEY) || '{}');
    if (!raw || typeof raw !== 'object') return {};
    const now = Date.now();
    const kept: Record<string, string> = {};
    for (const [id, at] of Object.entries(raw as Record<string, string>)) {
      const ms = Date.parse(String(at));
      // Выросла заново — запись больше не нужна.
      if (Number.isFinite(ms) && now - ms < PUMPKIN_REGROW_MS) kept[id] = String(at);
    }
    return kept;
  } catch {
    return {};
  }
}

function persist() {
  if (!import.meta.client) return;
  try {
    localStorage.setItem(PUMPKINS_KEY, JSON.stringify(brokenAt.value));
  } catch {
    /* приватный режим — тыквы просто восстановятся при перезагрузке */
  }
}

const visiblePumpkins = computed(() =>
  PUMPKINS.map((p) => ({
    ...p,
    broken: brokenNow.value.has(p.id),
    whole: art(p.kind),
    left: art(p.kind, '-left'),
    right: art(p.kind, '-right'),
    ratio: PUMPKIN_ART[p.kind]?.ratio ?? 1,
    gone: Boolean(brokenAt.value[p.id]) && !brokenNow.value.has(p.id)
  })).filter((p) => !p.gone)
);

function breakPumpkin(id: string) {
  if (brokenNow.value.has(id)) return;
  brokenAt.value = { ...brokenAt.value, [id]: new Date().toISOString() };
  brokenNow.value = new Set([...brokenNow.value, id]);
  persist();
}

/** Подвал рисуется в app.vue; пока его нет в DOM, Teleport держим выключенным. */
const footerReady = ref(false);

onMounted(() => {
  brokenAt.value = readBroken();
  persist();
  nextTick(() => {
    footerReady.value = Boolean(document.querySelector('.app-site-footer'));
  });
});
</script>
