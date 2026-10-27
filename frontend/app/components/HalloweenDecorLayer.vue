<template>
  <div v-if="enabled" class="hw-layer" aria-hidden="true">
    <!--
      Слой чисто декоративный: вся подложка не ловит курсор, кликабельны
      только сами тыквы. Иначе украшения начали бы перехватывать клики по
      интерфейсу.
    -->
    <div class="hw-pumpkins">
      <button
        v-for="p in visiblePumpkins"
        :key="p.id"
        type="button"
        class="hw-pumpkin"
        :class="{ 'is-broken': p.broken }"
        :style="{ left: `${p.x}%`, '--hw-scale': String(p.scale) }"
        :tabindex="-1"
        @click="breakPumpkin(p.id)"
      >
        <img
          v-if="!p.broken"
          class="hw-pumpkin__whole"
          :src="ART.pumpkin"
          alt=""
          draggable="false"
        />
        <template v-else>
          <img class="hw-pumpkin__half hw-pumpkin__half--l" :src="ART.halfL" alt="" draggable="false" />
          <img class="hw-pumpkin__half hw-pumpkin__half--r" :src="ART.halfR" alt="" draggable="false" />
        </template>
      </button>
    </div>

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
  pumpkin: '/decor/halloween/pumpkin.png',
  halfL: '/decor/halloween/pumpkin-half-left.png',
  halfR: '/decor/halloween/pumpkin-half-right.png',
  ghost: '/decor/halloween/ghost.png'
} as const;

const PUMPKIN_REGROW_MS = 2 * 24 * 60 * 60 * 1000;
const PUMPKINS_KEY = 'vbi-halloween-pumpkins';

/** Правый край оставлен коту оценки и мобильному меню — туда не сажаем. */
const PUMPKINS = [
  { id: 'p1', x: 4, scale: 1 },
  { id: 'p2', x: 17, scale: 0.78 },
  { id: 'p3', x: 33, scale: 0.92 },
  { id: 'p4', x: 48, scale: 0.7 }
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
    gone: Boolean(brokenAt.value[p.id]) && !brokenNow.value.has(p.id)
  })).filter((p) => !p.gone)
);

function breakPumpkin(id: string) {
  if (brokenNow.value.has(id)) return;
  brokenAt.value = { ...brokenAt.value, [id]: new Date().toISOString() };
  brokenNow.value = new Set([...brokenNow.value, id]);
  persist();
}

onMounted(() => {
  brokenAt.value = readBroken();
  persist();
});
</script>
