<template>
  <div class="og-win">
    <header class="og-win__head">
      <OgonekSprite class="og-win__icon" :rows="objectRows" :width="64" />
      <div>
        <p class="og-win__day">Окно {{ day.id }} · {{ dateLabel }}, {{ day.weekday }}</p>
        <h2 class="og-win__title">{{ day.title }}</h2>
        <p v-if="day.produces" class="og-win__produces">{{ day.produces }}</p>
      </div>
    </header>

    <div class="og-win__lead">
      <p v-for="(line, i) in day.lead" :key="i">{{ line }}</p>
    </div>

    <p v-if="day.draft" class="og-win__draft">{{ micro.draftNote }}</p>

    <!-- 1. Песня года -->
    <section v-if="day.kind === 'song'" class="og-win__body">
      <label class="og-field">
        <span>Ваша песня года</span>
        <input v-model="song" type="text" maxlength="160" placeholder="Исполнитель — название" />
      </label>
      <button type="button" class="og-btn" :disabled="!song.trim() || busy" @click="send('song', { text: song })">
        {{ player.song ? 'Поменять песню' : 'Записать в плейлист' }}
      </button>
      <p v-if="player.song" class="og-win__done">
        Записано: «{{ player.song }}». Плейлист не покажем никому до вечера.
      </p>
    </section>

    <!-- 2. Колпак на аватарку -->
    <section v-else-if="day.kind === 'avatar'" class="og-win__body og-win__body--row">
      <OgonekSprite :rows="OGONEK_OBJECTS.hat" :width="96" alt="Новогодний колпак" />
      <div class="og-win__col">
        <button type="button" class="og-btn" :disabled="busy" @click="send('hat', { on: !player.hat })">
          {{ player.hat ? 'Снять колпак' : 'Надеть колпак' }}
        </button>
        <p class="og-win__note">
          Шарф и свитер рисуются отдельно: их надо посадить на разные головы и ракурсы.
          <strong>{{ awaitingLabel }}</strong>
        </p>
      </div>
    </section>

    <!-- 4. Вилка в розетку -->
    <section v-else-if="day.kind === 'plug'" class="og-win__body">
      <OgonekPlugSocket :plugged="player.plugged" @change="(on) => send('plug', { on })" />
    </section>

    <!-- 5. Каток -->
    <section v-else-if="day.kind === 'skating'" class="og-win__body">
      <button type="button" class="og-btn" :disabled="busy" @click="send('skating', { on: !player.skating })">
        {{ player.skating ? 'Я передумал кататься' : 'Я катаюсь' }}
      </button>
      <p v-if="player.skating" class="og-win__done">Записали. Коньки берут на месте.</p>
    </section>

    <!-- 6. Нарисуй игрушку -->
    <section v-else-if="day.kind === 'toy'" class="og-win__body">
      <div class="og-win__editor">
        <OgonekPixelGrid v-model="toyPixels" :size="toySize" :cell="20" :brush="brush" />
        <div class="og-win__col">
          <OgonekPalettePicker v-model="brush" />
          <label class="og-field">
            <span>Пожелание на будущий год</span>
            <input v-model="wish" type="text" maxlength="120" placeholder="Чего хотите от 2027-го" />
          </label>
          <div class="og-win__row">
            <button type="button" class="og-btn og-btn--ghost" @click="resetToy">Начать заново</button>
            <button
              type="button"
              class="og-btn"
              :disabled="busy || !wish.trim() || !toyHasPixels"
              @click="hangToy"
            >
              {{ player.toy ? 'Обновить игрушку' : 'Повесить на ёлку' }}
            </button>
          </div>
          <NuxtLink class="og-link" to="/event/ogonek/tree">Посмотреть ёлку целиком →</NuxtLink>
        </div>
      </div>
    </section>

    <!-- 12. Вырежи снежинку -->
    <section v-else-if="day.kind === 'snowflake'" class="og-win__body">
      <div class="og-win__editor">
        <OgonekPixelGrid
          v-model="flakePixels"
          :size="snowflakeSize"
          :cell="20"
          :brush="cutting ? '.' : '7'"
          symmetry="octal"
        />
        <div class="og-win__col">
          <div class="og-win__row">
            <button
              type="button"
              class="og-btn"
              :class="{ 'og-btn--ghost': !cutting }"
              @click="cutting = true"
            >
              Вырезать
            </button>
            <button
              type="button"
              class="og-btn"
              :class="{ 'og-btn--ghost': cutting }"
              @click="cutting = false"
            >
              Вернуть бумагу
            </button>
          </div>
          <p class="og-win__note">
            Лист сложен в восемь раз: вырез повторяется по всем сторонам сразу.
          </p>
          <div class="og-win__row">
            <button type="button" class="og-btn og-btn--ghost" @click="resetFlake">Новый лист</button>
            <button type="button" class="og-btn" :disabled="busy || !flakeHasPixels" @click="sendFlake">
              {{ player.snowflake ? 'Переделать' : 'Отпустить в снегопад' }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- 13. Спасибо коллеге -->
    <section v-else-if="day.kind === 'thanks'" class="og-win__body">
      <label class="og-field">
        <span>Кому</span>
        <select v-model.number="thanksTo">
          <option :value="0" disabled>Выберите коллегу</option>
          <option v-for="e in colleagues" :key="e.id" :value="e.id">
            {{ e.name }}<template v-if="e.department"> · {{ e.department }}</template>
          </option>
        </select>
      </label>
      <label class="og-field">
        <span>За что спасибо</span>
        <textarea v-model="thanksText" rows="4" maxlength="400" placeholder="Коротко и честно" />
      </label>
      <p class="og-win__note">Имя отправителя не увидит ни адресат, ни мы. Открытка анонимна.</p>
      <button
        type="button"
        class="og-btn"
        :disabled="busy || !thanksTo || !thanksText.trim()"
        @click="sendThanks"
      >
        Отправить открытку
      </button>
      <p v-if="player.thanksSent" class="og-win__done">
        Отправлено открыток: {{ player.thanksSent }}.
      </p>
      <div v-if="thanks.length" class="og-win__inbox">
        <h3>Вам за этот год</h3>
        <blockquote v-for="t in thanks" :key="t.id">{{ t.text }}</blockquote>
      </div>
    </section>

    <!-- 16. Письмо себе -->
    <section v-else-if="day.kind === 'letter'" class="og-win__body">
      <template v-if="player.letter">
        <p class="og-win__done">
          Письмо запечатано {{ formatDateTime(player.letter.sealedAt) }}.
          Придёт обратно 30 июня 2027 года. Прочитать раньше нельзя — ни вам, ни нам.
        </p>
      </template>
      <template v-else>
        <label class="og-field">
          <span>Письмо себе</span>
          <textarea v-model="letter" rows="8" maxlength="4000" placeholder="Что хотите сказать себе через полгода" />
        </label>
        <p class="og-win__note">После отправки письмо не редактируется и не читается до 30 июня.</p>
        <button type="button" class="og-btn" :disabled="busy || !letter.trim()" @click="sendLetter">
          Запечатать конверт
        </button>
      </template>
    </section>

    <!-- 17. Оливье -->
    <section v-else-if="day.kind === 'olivier'" class="og-win__body">
      <label class="og-field">
        <span>Название рецепта</span>
        <input v-model="recipeTitle" type="text" maxlength="120" placeholder="Бабушкин, без изменений" />
      </label>
      <label class="og-field">
        <span>Рецепт</span>
        <textarea v-model="recipeText" rows="5" maxlength="1200" placeholder="Что и в каком порядке" />
      </label>
      <button
        type="button"
        class="og-btn"
        :disabled="busy || !recipeTitle.trim() || !recipeText.trim()"
        @click="send('recipe', { title: recipeTitle, text: recipeText })"
      >
        {{ player.recipeId ? 'Обновить рецепт' : 'Выложить рецепт' }}
      </button>

      <h3 class="og-win__sub">Рецепты коллег</h3>
      <ul class="og-recipes">
        <li v-for="r in recipes" :key="r.id" :class="{ 'is-mine': r.mine }">
          <div class="og-recipes__head">
            <strong>{{ r.title }}</strong>
            <span class="og-recipes__who">{{ r.name }}<template v-if="r.department"> · {{ r.department }}</template></span>
          </div>
          <p class="og-recipes__text">{{ r.text }}</p>
          <div class="og-recipes__foot">
            <span>Голосов: {{ r.votes }}</span>
            <button
              v-if="!r.mine"
              type="button"
              class="og-btn og-btn--small"
              :class="{ 'og-btn--ghost': !r.myVote }"
              :disabled="busy"
              @click="send('recipeVote', { recipeId: r.id })"
            >
              {{ r.myVote ? 'Ваш голос' : 'Голосовать' }}
            </button>
          </div>
        </li>
      </ul>
    </section>

    <!-- 8. Дресс-код -->
    <section v-else-if="day.kind === 'dresscode'" class="og-win__body">
      <div class="og-chips">
        <button
          v-for="c in DRESSCODE_OPTIONS"
          :key="c"
          type="button"
          class="og-chip"
          :class="{ 'is-active': player.dresscode === c }"
          :disabled="busy"
          @click="send('dresscode', { choice: player.dresscode === c ? '' : c })"
        >
          {{ c }}
        </button>
      </div>
      <OgonekAwaiting :label="awaitingLabel" :text="day.awaiting" />
    </section>

    <!-- 19. Финал -->
    <section v-else-if="day.kind === 'final'" class="og-win__body">
      <ul class="og-final">
        <li>Игрушек на ёлке: <strong>{{ treeCount }}</strong></li>
        <li>Снежинок в метели: <strong>{{ snowflakeCount }}</strong></li>
        <li>Открыток у вас: <strong>{{ thanks.length }}</strong></li>
        <li>Ваше звание: <strong>{{ player.rank }}</strong></li>
      </ul>
      <NuxtLink class="og-link" to="/event/ogonek/tree">Открыть ёлку целиком →</NuxtLink>
    </section>

    <!-- Окна, которые ждут материалы -->
    <section v-else class="og-win__body">
      <OgonekAwaiting :label="awaitingLabel" :text="day.awaiting" />
    </section>

    <p v-if="error" class="og-win__error" role="alert">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
/**
 * Содержимое открытого окна. Один компонент с ветками по `kind`: окна
 * устроены по-разному, но живут в одной модалке и в одном ритме.
 *
 * Окна, где нужны материалы заказчика, не выдумывают содержимое, а честно
 * пишут, чего ждут (спека, раздел 6).
 */
import { OGONEK_OBJECTS } from '~/events/ogonek/sprites';
import { formatOgonekDate } from '~/events/ogonek/timeline';
import { ogonekTreeSpot } from '~/events/ogonek/treePlacement';
import type { OgonekDayView } from '~/events/ogonek/types';

type PlayerView = {
  rank: string;
  plugged: boolean;
  hat: boolean;
  song: string;
  skating: boolean;
  dresscode: string;
  toy: { pixels: string[]; wish: string; x: number; y: number } | null;
  snowflake: { pixels: string[] } | null;
  letter: { sealedAt: string; deliverAt: string } | null;
  recipeId: string;
  recipeVote: string;
  thanksSent: number;
};

const props = defineProps<{
  day: OgonekDayView;
  player: PlayerView;
  micro: Record<string, string>;
  awaitingLabel: string;
  toySize: number;
  snowflakeSize: number;
  colleagues: { id: number; name: string; department: string }[];
  recipes: {
    id: string; name: string; department: string; title: string; text: string;
    votes: number; mine: boolean; myVote: boolean;
  }[];
  thanks: { id: string; text: string; createdAt: string }[];
  treeCount: number;
  snowflakeCount: number;
  busy?: boolean;
}>();

const emit = defineEmits<{ submit: [kind: string, payload: Record<string, unknown>] }>();

const error = ref('');

/** Черновик: в спеке конкретных вариантов дресс-кода нет. */
const DRESSCODE_OPTIONS = [
  'Советский Новый год',
  'Голубой огонёк',
  'Свитер с оленями',
  'Блеск и мишура',
  'Ещё думаю'
];

const objectRows = computed(() => OGONEK_OBJECTS[props.day.object] ?? OGONEK_OBJECTS.ogonek);
const dateLabel = computed(() => formatOgonekDate(props.day.dateIso));

const song = ref(props.player.song);
const wish = ref(props.player.toy?.wish ?? '');
const brush = ref('0');
const cutting = ref(true);
const thanksTo = ref(0);
const thanksText = ref('');
const letter = ref('');
const recipeTitle = ref('');
const recipeText = ref('');

const blankToy = () => Array.from({ length: props.toySize }, () => '.'.repeat(props.toySize));
/** Лист бумаги: снежинку не рисуют, её вырезают из целого. */
const blankSheet = () =>
  Array.from({ length: props.snowflakeSize }, () => '7'.repeat(props.snowflakeSize));

const toyPixels = ref<string[]>(props.player.toy?.pixels ?? blankToy());
const flakePixels = ref<string[]>(props.player.snowflake?.pixels ?? blankSheet());

const toyHasPixels = computed(() => toyPixels.value.some((r) => /[0-7]/.test(r)));
const flakeHasPixels = computed(() => flakePixels.value.some((r) => /[0-7]/.test(r)));

const resetToy = () => { toyPixels.value = blankToy(); };
const resetFlake = () => { flakePixels.value = blankSheet(); };

function send(kind: string, payload: Record<string, unknown>) {
  error.value = '';
  emit('submit', kind, payload);
}

function hangToy() {
  // Игрушка садится на свободное место сама: расставлять вручную семьдесят
  // человек не станут, а пустых веток быть не должно.
  const spot = ogonekTreeSpot(Math.random);
  const x = props.player.toy?.x ?? spot.x;
  const y = props.player.toy?.y ?? spot.y;
  send('toy', { pixels: toyPixels.value, wish: wish.value, x, y });
}

function sendFlake() {
  send('snowflake', { pixels: flakePixels.value });
}

function sendThanks() {
  send('thanks', { toEmployeeId: thanksTo.value, text: thanksText.value });
  thanksText.value = '';
  thanksTo.value = 0;
}

function sendLetter() {
  send('letter', { text: letter.value });
  letter.value = '';
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

defineExpose({ setError: (m: string) => { error.value = m; } });

watch(
  () => props.player,
  (p) => {
    song.value = p.song;
    if (p.toy) {
      toyPixels.value = p.toy.pixels;
      wish.value = p.toy.wish;
    }
    if (p.snowflake) flakePixels.value = p.snowflake.pixels;
  },
  { deep: true }
);

watch(
  () => props.recipes,
  (list) => {
    const mine = list.find((r) => r.mine);
    if (mine && !recipeTitle.value) {
      recipeTitle.value = mine.title;
      recipeText.value = mine.text;
    }
  },
  { immediate: true }
);
</script>

<style scoped>
.og-win {
  display: flex;
  flex-direction: column;
  gap: 16px;
  color: #e8d7b4;
}

.og-win__head {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.og-win__icon { flex: none; }

.og-win__day {
  margin: 0;
  font-size: 12px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  opacity: 0.7;
}

.og-win__title {
  margin: 2px 0 0;
  font-family: 'Unbounded', system-ui, sans-serif;
  font-size: 24px;
  color: #f5efe3;
}

.og-win__produces {
  margin: 6px 0 0;
  font-size: 13px;
  color: #d99a2b;
}

.og-win__lead p {
  margin: 0 0 8px;
  line-height: 1.55;
}

.og-win__draft {
  margin: 0;
  font-size: 12px;
  opacity: 0.55;
  font-style: italic;
}

.og-win__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.og-win__body--row {
  flex-direction: row;
  align-items: center;
  gap: 20px;
}

.og-win__col {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.og-win__row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.og-win__editor {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}

.og-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
}

.og-field input,
.og-field textarea,
.og-field select {
  background: rgba(26, 20, 18, 0.55);
  border: 1px solid rgba(232, 215, 180, 0.3);
  border-radius: 6px;
  color: #f5efe3;
  padding: 9px 11px;
  font: inherit;
  width: 100%;
  max-width: 460px;
}

.og-field textarea { resize: vertical; }

.og-btn {
  align-self: flex-start;
  background: #d99a2b;
  color: #1a1412;
  border: 2px solid #1a1412;
  border-radius: 6px;
  padding: 9px 16px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.15s ease, background 0.15s ease;
}

.og-btn:hover:not(:disabled) { transform: translateY(-2px); background: #e8a87c; }
.og-btn:disabled { opacity: 0.45; cursor: not-allowed; }

.og-btn--ghost {
  background: transparent;
  color: #e8d7b4;
  border-color: rgba(232, 215, 180, 0.4);
}

.og-btn--small { padding: 5px 11px; font-size: 13px; }

.og-win__note { margin: 0; font-size: 13px; opacity: 0.78; }
.og-win__done { margin: 0; color: #2f7f7a; font-weight: 600; }
.og-win__error { margin: 0; color: #e8a87c; }

.og-win__sub {
  margin: 10px 0 0;
  font-family: 'Unbounded', system-ui, sans-serif;
  font-size: 16px;
  color: #f5efe3;
}

.og-win__inbox { margin-top: 10px; }
.og-win__inbox h3 { font-size: 15px; margin: 0 0 6px; }
.og-win__inbox blockquote {
  margin: 0 0 8px;
  padding: 8px 12px;
  border-left: 3px solid #d99a2b;
  background: rgba(26, 20, 18, 0.35);
}

.og-recipes { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.og-recipes li {
  padding: 10px 12px;
  border: 1px solid rgba(232, 215, 180, 0.22);
  border-radius: 8px;
  background: rgba(26, 20, 18, 0.3);
}
.og-recipes li.is-mine { border-color: rgba(217, 154, 43, 0.6); }
.og-recipes__head { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.og-recipes__who { font-size: 12px; opacity: 0.7; }
.og-recipes__text { margin: 6px 0; font-size: 14px; line-height: 1.5; }
.og-recipes__foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 13px; }

.og-chips { display: flex; gap: 8px; flex-wrap: wrap; }
.og-chip {
  background: rgba(26, 20, 18, 0.4);
  border: 1px solid rgba(232, 215, 180, 0.3);
  color: #e8d7b4;
  border-radius: 999px;
  padding: 7px 14px;
  cursor: pointer;
}
.og-chip.is-active { background: #2f7f7a; border-color: #2f7f7a; color: #f5efe3; }

.og-final { margin: 0; padding-left: 18px; line-height: 1.7; }

.og-link { color: #d99a2b; text-decoration: none; font-weight: 600; }
.og-link:hover { text-decoration: underline; }

@media (prefers-reduced-motion: reduce) {
  .og-btn { transition: none; }
  .og-btn:hover:not(:disabled) { transform: none; }
}

@media (max-width: 760px) {
  .og-win__editor { flex-direction: column; }
  .og-win__body--row { flex-direction: column; align-items: flex-start; }
}
</style>
