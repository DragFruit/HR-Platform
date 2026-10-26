<template>
  <div class="nk-page">
    <div v-if="pending && !state" class="nk-page__loading">Открываем дело...</div>
    <p v-else-if="loadError" class="nk-page__error" role="alert">{{ loadError }}</p>

    <template v-else-if="state">

      <!--
        Полный экран — свой CSS-слой через Teleport в body, а не Fullscreen API:
        так доска гарантированно выходит из-под масштаба платформы (--platform-zoom),
        и координаты курсора совпадают с отрисовкой.
      -->
      <Teleport to="body" :disabled="!fullscreen">
        <div :class="fullscreen ? 'nk-fullscreen' : 'nk-inline'">
          <NokturnBoard
            :board="board"
            :stages="state.stages"
            :suspects="state.suspects"
            :fixtures="state.fixtures"
            :brief-stage="briefStage"
            :investigator="state.investigator"
            :art="state.art"
            :micro="micro"
            :thread-limit="state.threadLimit"
            :attempts-total="state.minigameAttempts"
            :fullscreen="fullscreen"
            :points="state.player.points"
            :can-vote="Boolean(votableStage)"
            :has-reveal="Boolean(state.reveal)"
            :minigame-countdown="minigameCountdown"
            :active-stage="activeStage"
            @update:board="onBoardChange"
            @open-brief="briefRequest += 1"
            @open-ballot="modal = 'ballot'"
            @open-reveal="modal = 'reveal'"
            @toggle-fullscreen="toggleFullscreen"
            @play="onPlay"
            @open-evidence="openEvidence"
          />
        </div>
      </Teleport>

      <Teleport to="body">
        <NokturnGuide
          :stage-id="briefStage?.id ?? null"
          :briefing="briefStage?.briefing ?? []"
          :deadline-line="deadlineLine"
          :investigator="state.investigator"
          :force="briefRequest"
        />
      </Teleport>

      <Teleport to="body">
        <div v-if="modal" class="nk-modal" @click.self="closeModal">
          <div class="nk-modal__inner" role="dialog" aria-modal="true">
            <button type="button" class="nk-modal__x" aria-label="Закрыть" @click="closeModal">
              ×
            </button>

            <NokturnBriefing
              v-if="modal === 'brief' && briefStage"
              :stage="briefStage"
              :investigator="state.investigator"
            />
            <p v-else-if="modal === 'brief'" class="nk-modal__note">
              Бриф появится, когда откроется первый этап.
            </p>

            <NokturnEvidenceCard
              v-else-if="modal === 'evidence' && openedEvidence"
              :evidence="openedEvidence"
              variant="full"
              :bag-src="state.art.evidenceBag"
            />

            <NokturnSearchGame
              v-else-if="modal === 'game' && gameStage"
              :key="`game-${gameStage.id}-${gameStage.minigame.attempts}`"
              :stage="gameStage"
              :attempts-total="state.minigameAttempts"
              @solved="onSolved"
              @failed="onFailed"
            />
            <p v-else-if="modal === 'game-stub' && gameStage" class="nk-modal__note">
              Мини-игра «{{ gameStage.minigame.title }}» ещё готовится.
              Улики этапа уже в сейфе: улика скиллом не блокируется.
            </p>

            <NokturnBallot
              v-else-if="modal === 'ballot' && votableStage"
              ref="ballotRef"
              :stage="votableStage"
              :suspects="state.suspects"
              :micro="micro"
              :closed="state.deadlinePassed"
              :late="isLate(votableStage)"
              :mechanics="state.mechanics"
              @vote="onVote"
              @mechanics="onMechanics"
            />
            <p v-else-if="modal === 'ballot'" class="nk-modal__note">
              {{ ballotBlockedNote }}
            </p>

            <NokturnReveal
              v-else-if="modal === 'reveal' && state.reveal"
              :reveal="state.reveal"
              :suspects="state.suspects"
            />
          </div>
        </div>
      </Teleport>
    </template>
  </div>
</template>

<script setup lang="ts">
import type {
  NokturnBoard as BoardShape,
  NokturnEvidence,
  NokturnFixture,
  NokturnStageId,
  NokturnStageView,
  NokturnSuspect,
  NokturnSuspectId
} from '~/events/nokturn/types';
import {
  formatNokturnCountdown,
  nokturnDeadlineParts,
  nokturnVoteIsLate
} from '~/events/nokturn/timeline';

type QuestState = {
  serverNow: string;
  deadlineAt: string;
  deadlinePassed: boolean;
  threadLimit: number;
  minigameAttempts: number;
  micro: Record<string, string>;
  suspects: NokturnSuspect[];
  fixtures: NokturnFixture[];
  art: Record<string, string>;
  investigator: { name: string; title: string; photo: string };
  mechanics: {
    question: string;
    options: { id: number; text: string }[];
    answered: { optionId: number; points: number; at: string } | null;
  };
  player: { userId: number; name: string; points: number; board: BoardShape };
  stages: NokturnStageView[];
  reveal: {
    text: string[];
    roles: Record<string, { role: string; hides: string }>;
    votesByStage: { stage: number; counts: Record<string, number> }[];
    leaderboard: { userId: number; name: string; points: number }[];
  } | null;
};

const FULLSCREEN_KEY = 'vbi-nokturn-fullscreen';

const state = ref<QuestState | null>(null);
const pending = ref(true);
const loadError = ref('');
const board = ref<BoardShape>({ items: [], threads: [] });
const fullscreen = ref(false);
const modal = ref<'' | 'brief' | 'evidence' | 'game' | 'game-stub' | 'ballot' | 'reveal'>('');
const openedEvidence = ref<NokturnEvidence | null>(null);
const gameStage = ref<NokturnStageView | null>(null);
const ballotRef = ref<{ setError: (m: string) => void } | null>(null);

/** Разница часов клиента и сервера — счётчики идут по серверному времени. */
const clockSkew = ref(0);
const nowMs = ref(Date.now());
let tick: ReturnType<typeof setInterval> | null = null;

const micro = computed(() => state.value?.micro ?? {});

async function load() {
  try {
    const res = await $fetch<QuestState>('/api/event/nokturn/state');
    state.value = res;
    board.value = {
      items: [...res.player.board.items],
      threads: [...res.player.board.threads]
    };
    clockSkew.value = Date.parse(res.serverNow) - Date.now();
    loadError.value = '';
  } catch (err) {
    loadError.value = 'Не удалось открыть дело. Обновите страницу.';
    console.warn('[nokturn] state load failed', err);
  } finally {
    pending.value = false;
  }
}

const serverNow = computed(() => new Date(nowMs.value + clockSkew.value));

/**
 * Этап на кнопке доски: сначала первый открытый без выданных улик,
 * затем — ближайший ещё закрытый («Новая улика через {чч:мм:сс}»).
 */
const activeStage = computed<NokturnStageView | null>(() => {
  const stages = state.value?.stages ?? [];
  const pendingStage = stages.find((s) => s.scheduleOpen && !s.minigame.released);
  if (pendingStage) return pendingStage;
  const next = stages.find((s) => !s.scheduleOpen);
  if (next) return next;
  return stages[stages.length - 1] ?? null;
});

/** Бриф показываем по последнему открытому этапу. */
const briefStage = computed<NokturnStageView | null>(() => {
  const open = (state.value?.stages ?? []).filter((s) => s.open);
  return open.length ? (open[open.length - 1] ?? null) : null;
});

/** Голосовать можно по первому открытому этапу без решения. */
const votableStage = computed<NokturnStageView | null>(
  () => (state.value?.stages ?? []).find((s) => s.open && !s.vote) ?? decidedStage.value
);

/** Если решения вынесены по всем открытым этапам — показываем последний с решением. */
const decidedStage = computed<NokturnStageView | null>(() => {
  const withVote = (state.value?.stages ?? []).filter((s) => s.open && s.vote);
  return withVote.length ? (withVote[withVote.length - 1] ?? null) : null;
});

const ballotBlockedNote = computed(() => {
  const stages = state.value?.stages ?? [];
  const blocked = stages.find((s) => s.scheduleOpen && s.blockedByStage);
  if (blocked?.blockedByStage) {
    return (micro.value.stageBlocked ?? '').replace('{N}', String(blocked.blockedByStage));
  }
  return 'Этап ещё не открыт.';
});

const briefRequest = ref(0);

/** Срок задержания Соловьёва проговаривает сама — в шапке счётчика нет. */
const deadlineLine = computed(() => {
  if (!state.value) return '';
  const leftMs = Date.parse(state.value.deadlineAt) - serverNow.value.getTime();
  if (leftMs <= 0) return 'Срок задержания истёк. Я обязана их отпустить.';
  const { days, hhmm } = nokturnDeadlineParts(leftMs);
  const tail = (micro.value.deadline ?? '')
    .replace('{N}', String(days))
    .replace('{t}', hhmm)
    .toLowerCase();
  return `И держите в голове: ${tail}.`;
});

const minigameCountdown = computed(() => {
  const s = activeStage.value;
  if (!s) return '00:00:00';
  return formatNokturnCountdown(Date.parse(s.opensAt) - serverNow.value.getTime());
});

const isLate = (s: NokturnStageView) => nokturnVoteIsLate(s.id, serverNow.value);

/* ------------------------------------------------------------- сохранение */

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function onBoardChange(next: BoardShape) {
  board.value = next;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveBoard, 500);
}

async function saveBoard() {
  try {
    await $fetch('/api/event/nokturn/board', {
      method: 'POST',
      body: { board: board.value }
    });
  } catch (err) {
    console.warn('[nokturn] board save failed', err);
  }
}

/* ------------------------------------------------------------------ модалки */

function closeModal() {
  modal.value = '';
  openedEvidence.value = null;
  gameStage.value = null;
}

function openEvidence(ev: NokturnEvidence) {
  openedEvidence.value = ev;
  modal.value = 'evidence';
}

async function onPlay(stageId: NokturnStageId) {
  const stage = (state.value?.stages ?? []).find((s) => s.id === stageId);
  if (!stage) return;
  if (stage.minigame.state === 'locked' || stage.minigame.state === 'blocked-by-stage') return;
  if (stage.minigame.state === 'done') {
    gameStage.value = stage;
    modal.value = 'game-stub';
    return;
  }
  // Мини-игры вторника-пятницы ещё не собраны: улики выдаём сразу,
  // скилл их никогда не блокирует (раздел 4 спеки).
  if (stage.minigame.kind !== 'search') {
    try {
      await $fetch('/api/event/nokturn/minigame/release', {
        method: 'POST',
        body: { stageId }
      });
    } catch (err) {
      console.warn('[nokturn] stub minigame release failed', err);
    }
    await load();
    gameStage.value = state.value?.stages.find((s) => s.id === stageId) ?? null;
    modal.value = 'game-stub';
    return;
  }
  try {
    await $fetch('/api/event/nokturn/minigame/start', { method: 'POST', body: { stageId } });
  } catch (err) {
    console.warn('[nokturn] minigame start failed', err);
    return;
  }
  await load();
  gameStage.value = state.value?.stages.find((s) => s.id === stageId) ?? null;
  modal.value = 'game';
}

async function onSolved(foundIds: string[]) {
  const stageId = gameStage.value?.id;
  if (!stageId) return;
  try {
    await $fetch('/api/event/nokturn/minigame/solve', {
      method: 'POST',
      body: { stageId, foundIds }
    });
  } catch (err) {
    console.warn('[nokturn] solve failed', err);
  }
  await load();
}

async function onFailed() {
  const stageId = gameStage.value?.id;
  if (!stageId) return;
  try {
    await $fetch('/api/event/nokturn/minigame/fail', { method: 'POST', body: { stageId } });
  } catch (err) {
    console.warn('[nokturn] fail failed', err);
  }
  await load();
}

async function onVote(suspectId: NokturnSuspectId) {
  const stageId = votableStage.value?.id;
  if (!stageId) return;
  try {
    await $fetch('/api/event/nokturn/vote', { method: 'POST', body: { stageId, suspectId } });
    await load();
  } catch (err) {
    const msg =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ||
      'Не удалось отправить решение';
    ballotRef.value?.setError(msg);
  }
}

async function onMechanics(optionId: number) {
  try {
    await $fetch('/api/event/nokturn/mechanics', { method: 'POST', body: { optionId } });
    await load();
  } catch (err) {
    const msg =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ||
      'Не удалось отправить ответ';
    ballotRef.value?.setError(msg);
  }
}

/* --------------------------------------------------------------- полный экран */

function toggleFullscreen() {
  fullscreen.value = !fullscreen.value;
}

watch(fullscreen, (on) => {
  if (!import.meta.client) return;
  try {
    localStorage.setItem(FULLSCREEN_KEY, on ? '1' : '0');
  } catch {
    /* приватный режим */
  }
  document.body.classList.toggle('nk-body-locked', on);
});

function onKey(e: KeyboardEvent) {
  if (e.key !== 'Escape') return;
  if (modal.value) {
    closeModal();
    return;
  }
  if (fullscreen.value) fullscreen.value = false;
}

onMounted(async () => {
  try {
    fullscreen.value = localStorage.getItem(FULLSCREEN_KEY) === '1';
  } catch {
    /* приватный режим */
  }
  window.addEventListener('keydown', onKey);
  tick = setInterval(() => {
    nowMs.value = Date.now();
  }, 1000);
  await load();
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey);
  if (tick) clearInterval(tick);
  if (saveTimer) clearTimeout(saveTimer);
  if (import.meta.client) document.body.classList.remove('nk-body-locked');
});
</script>
