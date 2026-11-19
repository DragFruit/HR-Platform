<template>
  <div class="ogt3 og-theme">
    <header class="ogt3__head">
      <div>
        <p class="ogt3__kicker">ОГОНЁК 2027 · ОКНО 10</p>
        <h1 class="ogt3__title">Крестики-нолики</h1>
      </div>
      <NuxtLink class="og-btn og-btn--ghost ogt3__back" to="/event/ogonek">К адвенту</NuxtLink>
    </header>

    <p v-if="error" class="ogt3__error" role="alert">{{ error }}</p>

    <div class="ogt3__layout">
      <main class="ogt3__main">
        <!-- Меню: онлайн или бот -->
        <template v-if="mode === 'menu'">
          <!-- Вызовы: коллеги ждут соперника — первым делом и заметно -->
          <section v-if="lobby.length" class="ogt3__card ogt3__calls" role="status" aria-live="polite">
            <h2 class="ogt3__h"><span class="ogt3__pulse" aria-hidden="true" /> Вас ждут</h2>
            <ul>
              <li v-for="r in lobby" :key="r.code">
                <span><b>{{ r.name }}</b><i v-if="r.department"> · {{ r.department }}</i> ждёт соперника</span>
                <button type="button" class="og-btn" :disabled="busy" @click="joinRoom(r.code)">Принять вызов</button>
              </li>
            </ul>
          </section>

          <section class="ogt3__card">
            <h2 class="ogt3__h">Онлайн с коллегой</h2>
            <p class="ogt3__muted">Победы идут в таблицу лидеров адвента. На ход — {{ TURN }} секунд.</p>
            <div class="ogt3__row">
              <button type="button" class="og-btn" :disabled="busy" @click="createRoom">Создать комнату</button>
              <form class="ogt3__join" @submit.prevent="joinRoom(code)">
                <input v-model="code" class="ogt3__input" maxlength="6" placeholder="КОД" aria-label="Код комнаты" />
                <button type="submit" class="og-btn og-btn--ghost" :disabled="busy || code.trim().length !== 6">Войти</button>
              </form>
            </div>
          </section>

          <section class="ogt3__card">
            <h2 class="ogt3__h">С ботом</h2>
            <p class="ogt3__muted">Тренировка: вы — крестики и ходите первыми. В рейтинг не идёт.</p>
            <div class="ogt3__row">
              <button v-for="d in DIFFS" :key="d.id" type="button" class="og-btn og-btn--ghost" @click="startBot(d.id)">{{ d.label }}</button>
            </div>
          </section>

          <details class="ogt3__rules">
            <summary>Как играть</summary>
            <ol>
              <li>Доска — 9 маленьких полей. Выиграйте три маленьких в ряд, чтобы выиграть партию.</li>
              <li>Куда вы поставили знак в маленьком поле — в такое же по номеру поле обязан ходить соперник.</li>
              <li>Если это поле уже закрыто, соперник ходит в любое открытое. Подсвеченные поля — куда можно ходить сейчас.</li>
            </ol>
          </details>
        </template>

        <!-- Ожидание соперника -->
        <section v-else-if="mode === 'online' && room?.status === 'waiting'" class="ogt3__card ogt3__wait">
          <p class="ogt3__label">Код комнаты</p>
          <p class="ogt3__code">{{ room.code }}</p>
          <p class="ogt3__muted">Отправьте код коллеге или подождите: комната видна всем в списке «Ждут соперника». Закроется через {{ waitLeft }}.</p>
          <div class="ogt3__row">
            <button type="button" class="og-btn" @click="copyCode">{{ copied ? 'Скопировано' : 'Скопировать код' }}</button>
            <button type="button" class="og-btn og-btn--ghost" :disabled="busy" @click="surrender">Закрыть комнату</button>
          </div>
        </section>

        <!-- Партия -->
        <template v-else-if="game">
          <div class="ogt3__players">
            <span class="ogt3__p" :class="{ 'is-turn': game.myTurn }">
              <b :class="`is-${game.mySymbol.toLowerCase()}`">{{ game.mySymbol }}</b> Вы
            </span>
            <span class="ogt3__vs">vs</span>
            <span class="ogt3__p" :class="{ 'is-turn': !game.myTurn && !game.over }">
              <b :class="`is-${game.oppSymbol.toLowerCase()}`">{{ game.oppSymbol }}</b> {{ game.oppName }}
            </span>
          </div>

          <div v-if="!game.over" class="ogt3__turn">
            <span>{{ game.myTurn ? 'Ваш ход' : mode === 'bot' ? 'Бот думает…' : 'Ход соперника' }}</span>
            <span v-if="mode === 'online' && secondsLeft !== null" class="ogt3__timer" :class="{ 'is-low': secondsLeft <= 10 }">{{ secondsLeft }} с</span>
          </div>
          <div v-if="mode === 'online' && !game.over && secondsLeft !== null" class="ogt3__bar">
            <i :style="{ width: `${(secondsLeft / TURN) * 100}%` }" />
          </div>

          <OgonekTttBoard :state="game.state" :can-play="game.myTurn && !game.over && !busy" :last-move="game.lastMove" @move="onMove" />

          <!-- Предложение ничьей -->
          <div v-if="mode === 'online' && room?.drawOfferedBy && room.drawOfferedBy !== room.you && !game.over" class="ogt3__offer">
            <span>{{ game.oppName }} предлагает ничью</span>
            <button type="button" class="og-btn" :disabled="busy" @click="draw('accept')">Принять</button>
            <button type="button" class="og-btn og-btn--ghost" :disabled="busy" @click="draw('decline')">Отказаться</button>
          </div>

          <div v-if="!game.over" class="ogt3__row">
            <button
              v-if="mode === 'online'"
              type="button"
              class="og-btn og-btn--ghost"
              :disabled="busy || room?.drawOfferedBy === room?.you"
              @click="draw('offer')"
            >
              {{ room?.drawOfferedBy === room?.you ? 'Ничья предложена' : 'Предложить ничью' }}
            </button>
            <button type="button" class="og-btn og-btn--ghost" :disabled="busy" @click="surrender">Сдаться</button>
          </div>

          <!-- Итог -->
          <section v-else class="ogt3__result" :class="`is-${game.result}`">
            <p class="ogt3__result-t">{{ RESULT[game.result!] }}</p>
            <p v-if="mode === 'online' && game.result === 'win'" class="ogt3__muted">Победа записана в таблицу лидеров.</p>
            <div class="ogt3__row">
              <button v-if="mode === 'bot'" type="button" class="og-btn" @click="startBot(botLevel)">Ещё раз</button>
              <button type="button" class="og-btn og-btn--ghost" @click="toMenu">В меню</button>
            </div>
          </section>
        </template>
      </main>

      <!-- Лидеры онлайн-партий -->
      <aside class="ogt3__side">
        <h2 class="ogt3__h">Лидеры</h2>
        <p v-if="!leaders.length" class="ogt3__muted">Пока никто не сыграл онлайн. Станьте первым.</p>
        <ol v-else class="ogt3__leaders">
          <li v-for="r in leaders" :key="r.place" :class="{ 'is-mine': r.mine }">
            <span class="ogt3__n">{{ r.place }}</span>
            <span class="ogt3__name">{{ r.name }}</span>
            <span class="ogt3__wdl" :title="`побед ${r.wins} · ничьих ${r.draws} · поражений ${r.losses}`">{{ r.wins }} / {{ r.draws }} / {{ r.losses }}</span>
          </li>
        </ol>
        <p class="ogt3__muted ogt3__legend">победы / ничьи / поражения</p>
        <p v-if="myPlace && !leaders.some((r) => r.mine)" class="ogt3__muted">Вы: {{ myPlace.place }} место · {{ myPlace.wins }} побед</p>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Крестики-нолики «Огонька» (окно 10) — игра внутри платформы по механике
 * ultimate-tic-tac-toe.ru. Онлайн с коллегой: комнаты на сервере
 * (`/api/event/ogonek/ttt/*`), опрос раз в секунду, итог — в лидеров
 * адвента. С ботом: тот же движок в браузере, в рейтинг не идёт.
 */
import {
  tttApplyMove,
  tttBotMove,
  tttEmptyState,
  type TttDifficulty,
  type TttMove,
  type TttState,
  type TttSymbol
} from '~/events/ogonek/ttt/engine';

useHead({
  link: [
    {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Press+Start+2P&family=PT+Sans:wght@400;700&family=PT+Sans+Narrow:wght@700&display=swap'
    }
  ]
});

const route = useRoute();
const router = useRouter();

const TURN = 30;
const DIFFS: { id: TttDifficulty; label: string }[] = [
  { id: 'easy', label: 'Лёгкий' },
  { id: 'medium', label: 'Средний' },
  { id: 'hard', label: 'Сложный' }
];
const RESULT = { win: 'Победа!', loss: 'Поражение', draw: 'Ничья' } as const;

type RoomView = {
  id: number;
  code: string;
  status: 'waiting' | 'playing' | 'finished' | 'abandoned';
  you: 'p1' | 'p2' | null;
  symbol: TttSymbol | null;
  p1: { name: string; department: string; symbol: TttSymbol };
  p2: { name: string; department: string; symbol: TttSymbol } | null;
  state: TttState;
  turn: 'p1' | 'p2' | null;
  deadline: string | null;
  drawOfferedBy: 'p1' | 'p2' | null;
  winner: 'p1' | 'p2' | 'draw' | null;
  seq: number;
  lastMove: TttMove | null;
  expiresAt: string | null;
};

type Leader = { place: number; name: string; wins: number; draws: number; losses: number; mine: boolean };

const mode = ref<'menu' | 'online' | 'bot'>('menu');
const room = ref<RoomView | null>(null);
const lobby = ref<{ code: string; name: string; department: string }[]>([]);
const leaders = ref<Leader[]>([]);
const myPlace = ref<{ place: number; wins: number } | null>(null);
const code = ref('');
const error = ref('');
const busy = ref(false);
const copied = ref(false);
const now = ref(Date.now());

/* бот */
const botState = ref<TttState>(tttEmptyState());
const botLevel = ref<TttDifficulty>('medium');
const botLast = ref<TttMove | null>(null);
const botThinking = ref(false);

/** Партия в одном виде для доски и панели — и онлайн, и с ботом. */
const game = computed(() => {
  if (mode.value === 'bot') {
    const s = botState.value;
    const over = s.bigResult !== null;
    return {
      state: s,
      mySymbol: 'X' as TttSymbol,
      oppSymbol: 'O' as TttSymbol,
      oppName: `бот · ${DIFFS.find((d) => d.id === botLevel.value)?.label.toLowerCase()}`,
      myTurn: !over && s.currentPlayer === 'X' && !botThinking.value,
      over,
      result: over ? (s.bigResult === 'X' ? 'win' : s.bigResult === 'O' ? 'loss' : 'draw') : null,
      lastMove: botLast.value
    } as const;
  }
  const r = room.value;
  if (!r || r.status === 'waiting' || !r.you || !r.symbol) return null;
  const opp = r.you === 'p1' ? r.p2 : r.p1;
  const over = r.status !== 'playing';
  return {
    state: r.state,
    mySymbol: r.symbol,
    oppSymbol: (r.symbol === 'X' ? 'O' : 'X') as TttSymbol,
    oppName: opp?.name ?? 'Соперник',
    myTurn: !over && r.turn === r.you,
    over,
    result: over ? (r.winner === 'draw' ? 'draw' : r.winner === r.you ? 'win' : 'loss') : null,
    lastMove: r.lastMove
  } as const;
});

const secondsLeft = computed(() => {
  const d = room.value?.deadline;
  if (!d) return null;
  return Math.max(0, Math.ceil((Date.parse(d) - now.value) / 1000));
});
const waitLeft = computed(() => {
  const e = room.value?.expiresAt;
  if (!e) return '';
  const m = Math.max(0, Math.ceil((Date.parse(e) - now.value) / 60000));
  return `${m} мин`;
});

function errText(e: unknown) {
  const err = e as { data?: { statusMessage?: string }; statusMessage?: string };
  return err?.data?.statusMessage || err?.statusMessage || 'Не получилось, попробуйте ещё раз';
}

async function call<T>(fn: () => Promise<T>): Promise<T | null> {
  busy.value = true;
  error.value = '';
  try {
    return await fn();
  } catch (e) {
    error.value = errText(e);
    return null;
  } finally {
    busy.value = false;
  }
}

async function loadHome() {
  try {
    const d = await $fetch<{ active: RoomView | null; lobby: typeof lobby.value; leaders: Leader[]; myPlace: { place: number; wins: number } | null }>('/api/event/ogonek/ttt');
    lobby.value = d.lobby;
    leaders.value = d.leaders;
    myPlace.value = d.myPlace;
    if (d.active && mode.value !== 'bot') {
      room.value = d.active;
      mode.value = 'online';
    }
  } catch (e) {
    error.value = errText(e);
  }
}

async function createRoom() {
  const r = await call(() => $fetch<RoomView>('/api/event/ogonek/ttt/create', { method: 'POST' }));
  if (r) { room.value = r; mode.value = 'online'; }
}
async function joinRoom(c: string) {
  const r = await call(() => $fetch<RoomView>('/api/event/ogonek/ttt/join', { method: 'POST', body: { code: c } }));
  if (r) { room.value = r; mode.value = 'online'; code.value = ''; }
}

async function onMove(m: TttMove) {
  if (mode.value === 'bot') return botPlay(m);
  const id = room.value?.id;
  if (!id) return;
  const r = await call(() => $fetch<RoomView>('/api/event/ogonek/ttt/move', { method: 'POST', body: { id, ...m } }));
  if (r) room.value = r;
}

async function surrender() {
  if (mode.value === 'bot') {
    botState.value = { ...botState.value, bigResult: 'O' };
    return;
  }
  const id = room.value?.id;
  if (!id) return;
  const r = await call(() => $fetch<RoomView>('/api/event/ogonek/ttt/surrender', { method: 'POST', body: { id } }));
  if (r) {
    room.value = r;
    if (r.status === 'abandoned') toMenu();
  }
}

async function draw(action: 'offer' | 'accept' | 'decline') {
  const id = room.value?.id;
  if (!id) return;
  const r = await call(() => $fetch<RoomView>('/api/event/ogonek/ttt/draw', { method: 'POST', body: { id, action } }));
  if (r) room.value = r;
}

async function copyCode() {
  try {
    await navigator.clipboard.writeText(room.value?.code ?? '');
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 1500);
  } catch {
    /* буфер недоступен — код и так на экране */
  }
}

function toMenu() {
  mode.value = 'menu';
  room.value = null;
  void loadHome();
}

/* ---------- бот: тот же движок в браузере, бот играет ноликами ---------- */
function startBot(level: TttDifficulty) {
  botLevel.value = level;
  botState.value = tttEmptyState('X');
  botLast.value = null;
  botThinking.value = false;
  mode.value = 'bot';
}

function botPlay(m: TttMove) {
  try {
    botState.value = tttApplyMove(botState.value, m);
    botLast.value = m;
  } catch {
    return;
  }
  if (botState.value.bigResult !== null) return;
  botThinking.value = true;
  setTimeout(() => {
    if (mode.value !== 'bot' || botState.value.bigResult !== null) {
      botThinking.value = false;
      return;
    }
    const bm = tttBotMove(botState.value, botLevel.value);
    botState.value = tttApplyMove(botState.value, bm);
    botLast.value = bm;
    botThinking.value = false;
  }, 600);
}

/* ---------- опрос онлайн-комнаты ---------- */
let poll: ReturnType<typeof setInterval> | null = null;
let tick: ReturnType<typeof setInterval> | null = null;
let polling = false;
async function pollRoom() {
  if (mode.value !== 'online' || !room.value || polling) return;
  if (room.value.status === 'finished' || room.value.status === 'abandoned') return;
  polling = true;
  try {
    const r = await $fetch<RoomView>('/api/event/ogonek/ttt/room', { query: { id: room.value.id } });
    if (r.seq !== room.value.seq || r.deadline !== room.value.deadline) room.value = r;
    if (r.status === 'finished') void loadHome();
  } catch {
    /* сеть мигнула — следующий опрос */
  } finally {
    polling = false;
  }
}

onMounted(async () => {
  // Пришли по «Принять вызов» с адвента — сразу садимся в комнату
  const join = String(route.query.join ?? '').trim();
  if (join.length === 6) {
    await joinRoom(join);
    void router.replace({ query: {} });
  }
  void loadHome();
  poll = setInterval(() => {
    if (mode.value === 'online') void pollRoom();
    else if (mode.value === 'menu') void loadHome();
  }, 1000);
  tick = setInterval(() => { now.value = Date.now(); }, 250);
});
onBeforeUnmount(() => {
  if (poll) clearInterval(poll);
  if (tick) clearInterval(tick);
});
</script>

<style scoped>
.ogt3 {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: clamp(16px, 3vw, 32px);
  background: radial-gradient(120% 70% at 50% 0%, #64101d 0%, var(--og-bg) 60%), var(--og-bg);
  border: 2px solid var(--og-line);
  box-shadow: 6px 6px 0 var(--og-shade);
  color: #f6d9d6;
}
.ogt3__head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
.ogt3__kicker { margin: 0 0 8px; font-family: var(--og-pixel); font-size: 9px; color: var(--og-gold-soft); letter-spacing: 0.08em; }
.ogt3__title { margin: 0; font-family: var(--og-pixel); font-size: clamp(18px, 2.6vw, 26px); font-weight: 400; color: var(--og-gold); text-shadow: 3px 3px 0 #6b2a00; }
.ogt3__back { text-decoration: none; }
.ogt3__error { margin: 0; padding: 8px 12px; background: rgba(224, 70, 79, 0.18); color: #ffd0d0; }

.ogt3__layout { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 28px; align-items: start; }
.ogt3__main { display: flex; flex-direction: column; gap: 16px; align-items: flex-start; min-width: 0; }

.ogt3__card {
  width: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 18px;
  background: rgba(30, 12, 14, 0.45);
  border: 2px dashed rgba(255, 207, 74, 0.28);
}
.ogt3__h { margin: 0; font-family: var(--og-pixel); font-size: 11px; font-weight: 400; color: var(--og-gold); line-height: 1.5; }
.ogt3__muted { margin: 0; color: var(--og-muted); font-size: 14px; }
.ogt3__label { margin: 0; font-family: var(--og-pixel); font-size: 8px; color: var(--og-gold-soft); letter-spacing: 0.06em; }
.ogt3__row { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.ogt3__join { display: flex; gap: 8px; }
.ogt3__input {
  width: 110px;
  padding: 9px 10px;
  font-family: var(--og-pixel);
  font-size: 12px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  border: 0;
  background: var(--og-paper, #f3efe9);
  color: #2a1216;
}
.ogt3__calls { border: 2px solid var(--og-gold); background: linear-gradient(90deg, rgba(255, 207, 74, 0.2), rgba(255, 207, 74, 0.06)); box-shadow: 4px 4px 0 #6b2a00; }
.ogt3__calls ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.ogt3__calls li { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; font-size: 16px; }
.ogt3__calls b { color: var(--og-gold); }
.ogt3__calls i { font-style: normal; color: var(--og-muted); }
.ogt3__pulse { display: inline-block; width: 9px; height: 9px; margin-right: 6px; border-radius: 50%; background: var(--og-gold); animation: ogt3-pulse 1.4s ease-out infinite; vertical-align: 1px; }
@keyframes ogt3-pulse { 0% { box-shadow: 0 0 0 0 rgba(255, 207, 74, 0.7); } 100% { box-shadow: 0 0 0 10px rgba(255, 207, 74, 0); } }
@media (prefers-reduced-motion: reduce) { .ogt3__pulse { animation: none; } }

.ogt3__rules { width: 100%; font-size: 14px; color: var(--og-muted); }
.ogt3__rules summary { cursor: pointer; color: #f6d9d6; font-weight: 700; }
.ogt3__rules ol { margin: 8px 0 0; padding-left: 20px; line-height: 1.5; }

.ogt3__wait { align-items: flex-start; }
.ogt3__code { margin: 0; font-family: var(--og-pixel); font-size: clamp(26px, 4vw, 38px); letter-spacing: 0.2em; color: var(--og-gold); }

.ogt3__players { display: flex; align-items: center; gap: 14px; font-size: 16px; }
.ogt3__p { display: inline-flex; align-items: center; gap: 8px; padding: 6px 10px; border: 2px solid transparent; }
.ogt3__p.is-turn { border-color: var(--og-gold); }
.ogt3__p b { font-family: var(--og-pixel); font-size: 14px; }
.ogt3__p b.is-x { color: #ff6b6b; }
.ogt3__p b.is-o { color: #7ad8cf; }
.ogt3__vs { font-family: var(--og-pixel); font-size: 9px; color: var(--og-muted); }

.ogt3__turn { display: flex; align-items: center; gap: 12px; font-family: var(--og-pixel); font-size: 10px; color: var(--og-gold-soft); }
.ogt3__timer { color: #f6d9d6; }
.ogt3__timer.is-low { color: #ff6b6b; }
.ogt3__bar { width: min(100%, 540px); height: 6px; background: rgba(255, 255, 255, 0.1); }
.ogt3__bar i { display: block; height: 100%; background: var(--og-gold); transition: width 0.25s linear; }

.ogt3__offer { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 10px 12px; background: rgba(255, 207, 74, 0.12); }

.ogt3__result { display: flex; flex-direction: column; gap: 10px; }
.ogt3__result-t { margin: 0; font-family: var(--og-pixel); font-size: 18px; }
.ogt3__result.is-win .ogt3__result-t { color: var(--og-gold); }
.ogt3__result.is-loss .ogt3__result-t { color: #ff8f8f; }
.ogt3__result.is-draw .ogt3__result-t { color: #d8c39b; }

.ogt3__side { display: flex; flex-direction: column; gap: 10px; padding: 16px; background: rgba(30, 12, 14, 0.45); }
.ogt3__leaders { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; font-size: 14px; }
.ogt3__leaders li { display: grid; grid-template-columns: 22px minmax(0, 1fr) auto; gap: 8px; align-items: baseline; }
.ogt3__leaders li.is-mine { color: var(--og-gold); }
.ogt3__n { font-family: var(--og-pixel); font-size: 9px; color: var(--og-gold-soft); }
.ogt3__name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ogt3__wdl { font-variant-numeric: tabular-nums; color: var(--og-muted); }
.ogt3__leaders li.is-mine .ogt3__wdl { color: inherit; }
.ogt3__legend { font-size: 12px; }

@media (max-width: 900px) {
  .ogt3__layout { grid-template-columns: 1fr; }
}
</style>
