<template>
  <div class="og-win">

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
    <section v-else-if="day.kind === 'avatar'" class="og-win__body">
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
      <OgonekPlugSocket :key="plugKey" :plugged="player.plugged" @change="(on) => send('plug', { on })" />
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

    <!-- 12. Своя снежинка: рисуется четверть, остальное отражается само -->
    <section v-else-if="day.kind === 'snowflake'" class="og-win__body">
      <div class="og-fl">
        <div>
          <div class="og-fl__grid" role="group" aria-label="Четверть снежинки">
            <button
              v-for="(on, i) in flakeCells"
              :key="i"
              type="button"
              class="og-fl__cell"
              :class="{ 'is-on': on }"
              :aria-pressed="on"
              :aria-label="`Клетка ${Math.floor(i / 5) + 1}-${(i % 5) + 1}`"
              @click="toggleFlake(i)"
            />
          </div>
          <p class="og-fl__cap">Четверть</p>
        </div>
        <div>
          <div class="og-fl__prev">
            <OgonekSprite :rows="flakePreview" width-css="90px" by-value />
          </div>
          <p class="og-fl__cap">Так она полетит</p>
        </div>
      </div>
      <button type="button" class="og-btn" :disabled="busy || !flakeHasCells" @click="sendFlake">
        {{ player.snowflake ? 'Обновить снежинку' : 'Запустить снежинку' }}
      </button>
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
      <div class="og-win__row og-win__row--center">
        <button
          type="button"
          class="og-btn"
          :disabled="busy || !recipeTitle.trim() || !recipeText.trim()"
          @click="send('recipe', { title: recipeTitle, text: recipeText })"
        >
          {{ player.recipeId ? 'Обновить рецепт' : 'Выложить рецепт' }}
        </button>
        <div v-if="day.done" class="og-stamp">ЗАСЧИТАНО · ОГОНЁК №{{ day.id }}</div>
      </div>

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
      <figure class="og-look-cover">
        <img :src="OGONEK_DRESSCODE_COVER" alt="Коллеги в костюмах на новогоднем утреннике" loading="lazy" />
        <figcaption>
          <p v-for="rule in OGONEK_DRESSCODE_RULES" :key="rule">{{ rule }}</p>
        </figcaption>
      </figure>
      <div class="og-looks">
        <button
          v-for="look in OGONEK_LOOKS"
          :key="look.id"
          type="button"
          class="og-look"
          :class="{ 'is-active': player.dresscode === look.title }"
          :aria-pressed="player.dresscode === look.title"
          :disabled="busy"
          @click="send('dresscode', { choice: player.dresscode === look.title ? '' : look.title })"
        >
          <span v-if="look.images.length" class="og-look__imgs">
            <img v-for="src in look.images" :key="src" :src="src" alt="" loading="lazy" />
          </span>
          <!-- Фото снежинки в таблице заказчика нет: показываем нашу, пиксельную -->
          <span v-else class="og-look__imgs og-look__imgs--sprite">
            <OgonekSprite :rows="OGONEK_OBJECTS.snowflake" :width="96" />
          </span>
          <span class="og-look__title">{{ look.title }}</span>
          <span v-if="look.text" class="og-look__text">{{ look.text }}</span>
          <span class="og-look__count">
            {{ player.dresscode === look.title ? 'Ваш выбор · ' : '' }}выбрали: {{ dresscodeCounts[look.title] ?? 0 }}
          </span>
        </button>
      </div>
      <p class="og-win__note">Условия конкурса костюмов ждём от заказчика.</p>
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

      <h3 class="og-win__sub">Ещё спасибо</h3>
      <p class="og-win__note">В последний день открыток можно отправить сколько угодно. Они тоже анонимны.</p>
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
        <textarea v-model="thanksText" rows="3" maxlength="400" placeholder="Коротко и честно" />
      </label>
      <button
        type="button"
        class="og-btn og-btn--ghost"
        :disabled="busy || !thanksTo || !thanksText.trim()"
        @click="sendThanks"
      >
        Отправить открытку
      </button>
      <p v-if="player.thanksSent" class="og-win__done">Отправлено открыток: {{ player.thanksSent }}.</p>
    </section>

    <!-- 3. Мерч: ковёр ткётся из нитей и оказывается на футболке -->
    <section v-else-if="day.kind === 'merch'" class="og-win__body">
      <OgonekMerchReveal />
      <OgonekAwaiting :label="awaitingLabel" :text="day.awaiting" />
    </section>

    <!-- Окна, которые ждут материалы -->
    <section v-else class="og-win__body">
      <OgonekAwaiting :label="awaitingLabel" :text="day.awaiting" />
    </section>

    <!--
      Где своего действия нет (ждём материалы) — окно засчитывается
      прочтением. Финал засчитывается кнопкой «Зажечь огонёк».
    -->
    <button
      v-if="readable && day.kind !== 'final'"
      type="button"
      class="og-btn"
      :disabled="busy || day.done"
      @click="send('complete', { dayId: day.id })"
    >
      {{ day.done ? 'Прочитано' : 'Прочитал, засчитать' }}
    </button>
    <button
      v-if="day.kind === 'final'"
      type="button"
      class="og-btn"
      :disabled="busy"
      @click="$emit('fireworks'); send('complete', { dayId: day.id })"
    >
      Зажечь огонёк
    </button>

    <div v-if="day.done && day.kind !== 'olivier'" class="og-stamp">ЗАСЧИТАНО · ОГОНЁК №{{ day.id }}</div>

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
import { ogonekTreeSpot } from '~/events/ogonek/treePlacement';
import { OGONEK_BASE_FLAKE, ogonekFlakeSprite } from '~/events/ogonek/snowflake';
import { OGONEK_DRESSCODE_COVER, OGONEK_DRESSCODE_RULES, OGONEK_LOOKS } from '~/events/ogonek/dresscode';
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
  colleagues: { id: number; name: string; department: string }[];
  recipes: {
    id: string; name: string; department: string; title: string; text: string;
    votes: number; mine: boolean; myVote: boolean;
  }[];
  thanks: { id: string; text: string; createdAt: string }[];
  dresscodeCounts: Record<string, number>;
  treeCount: number;
  snowflakeCount: number;
  busy?: boolean;
}>();

const emit = defineEmits<{
  submit: [kind: string, payload: Record<string, unknown>];
  fireworks: [];
}>();

const error = ref('');

/** Сервер отказал — вилка возвращается туда, где она на самом деле. */
const plugKey = ref(0);

/** Засчитывается прочтением: окно ждёт материалы или само по себе финал. */
const readable = computed(() => Boolean(props.day.awaiting) || props.day.kind === 'final');

const song = ref(props.player.song);
const wish = ref(props.player.toy?.wish ?? '');
const brush = ref('2');
const thanksTo = ref(0);
const thanksText = ref('');
const letter = ref('');
const recipeTitle = ref('');
const recipeText = ref('');

const blankToy = () => Array.from({ length: props.toySize }, () => '.'.repeat(props.toySize));

const toyPixels = ref<string[]>(props.player.toy?.pixels ?? blankToy());
/** Четверть снежинки 5×5: true — закрашено. */
const flakeCells = ref<boolean[]>(
  [...(props.player.snowflake?.pixels ?? OGONEK_BASE_FLAKE).join('')].map((c) => c === '1')
);
const flakeQuarter = computed(() =>
  Array.from({ length: 5 }, (_, y) =>
    flakeCells.value.slice(y * 5, y * 5 + 5).map((on) => (on ? '1' : '.')).join('')
  )
);
const flakePreview = computed(() => ogonekFlakeSprite(flakeQuarter.value));
const flakeHasCells = computed(() => flakeCells.value.some(Boolean));
const toggleFlake = (i: number) => {
  flakeCells.value[i] = !flakeCells.value[i];
};

const toyHasPixels = computed(() => toyPixels.value.some((r) => /[^.]/.test(r)));


const resetToy = () => { toyPixels.value = blankToy(); };

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
  send('snowflake', { pixels: flakeQuarter.value });
}

function sendThanks() {
  // Поля чистит watch по props.player.thanksSent — только после ответа
  // сервера. Иначе на любой ошибке написанное пропадало бы вместе с формой.
  send('thanks', { toEmployeeId: thanksTo.value, text: thanksText.value, dayId: props.day.id });
}

function sendLetter() {
  // Письмо не чистим: при успехе форму заменяет блок «запечатано», при
  // ошибке текст должен остаться на месте.
  send('letter', { text: letter.value });
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

defineExpose({
  setError: (m: string) => {
    error.value = m;
    plugKey.value += 1;
  }
});

/** Открытка ушла — очищаем форму. Признак успеха приходит с сервера. */
watch(
  () => props.player.thanksSent,
  (now, before) => {
    if (now > (before ?? 0)) {
      thanksText.value = '';
      thanksTo.value = 0;
    }
  }
);

watch(
  () => props.player,
  (p) => {
    song.value = p.song;
    if (p.toy) {
      toyPixels.value = p.toy.pixels;
      wish.value = p.toy.wish;
    }
    if (p.snowflake) flakeCells.value = [...p.snowflake.pixels.join('')].map((c) => c === '1');
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
/* Токены задаёт страница (.og-theme): окно живёт внутри раскрытого дня. */
.og-win {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 6px;
  color: #f6d9d6;
}

.og-win__body { display: flex; flex-direction: column; gap: 12px; }
.og-win__body--row { flex-direction: row; align-items: center; gap: 20px; }
.og-win__col { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.og-win__row { display: flex; gap: 10px; flex-wrap: wrap; }
.og-win__row--center { align-items: center; gap: 16px; }
.og-win__editor { display: flex; gap: 20px; flex-wrap: wrap; }

.og-field { display: flex; flex-direction: column; gap: 6px; font-size: 15px; color: var(--og-muted); }

.og-field input,
.og-field textarea,
.og-field select {
  width: 100%;
  background: var(--og-bg);
  color: var(--og-snow);
  border: 2px solid var(--og-line);
  border-radius: 0;
  padding: 10px 12px;
  font: inherit;
  font-size: 16px;
}

.og-field textarea { min-height: 110px; resize: vertical; }

/* Пиксельная кнопка с жёсткой тенью — как в прототипе */
.og-btn {
  align-self: flex-start;
  font-family: var(--og-pixel);
  font-size: 10px;
  line-height: 1.4;
  padding: 10px 14px;
  border: 0;
  border-radius: 0;
  cursor: pointer;
  background: var(--og-gold);
  color: #3a2600;
  box-shadow: 3px 3px 0 #6b2a00;
}

.og-btn:active:not(:disabled) { transform: translate(2px, 2px); box-shadow: 1px 1px 0 #6b2a00; }
.og-btn:disabled { opacity: 0.45; cursor: not-allowed; }

.og-btn--ghost {
  background: transparent;
  color: #ffd9d6;
  box-shadow: none;
  border: 2px solid var(--og-line);
}

.og-btn--small { padding: 7px 10px; font-size: 8px; }

.og-win__note { margin: 0; font-size: 15px; color: var(--og-muted); }
.og-win__done { margin: 0; color: var(--og-green); font-weight: 700; }
.og-win__error { margin: 0; color: var(--og-gold-soft); }

.og-win__sub {
  margin: 10px 0 0;
  font-family: var(--og-pixel);
  font-size: 11px;
  line-height: 1.6;
  color: var(--og-snow);
}

.og-win__inbox { margin-top: 10px; }
.og-win__inbox h3 { font-family: var(--og-pixel); font-size: 10px; margin: 0 0 8px; color: var(--og-gold-soft); }
.og-win__inbox blockquote {
  margin: 0 0 8px;
  padding: 6px 12px;
  border-left: 3px solid var(--og-gold);
  color: var(--og-snow);
}

.og-recipes { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.og-recipes li { padding: 12px 14px; background: var(--og-bg-3); border: 2px solid var(--og-line); }
.og-recipes li.is-mine { border-color: var(--og-gold); }
.og-recipes__head { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; color: var(--og-snow); }
.og-recipes__who { font-size: 13px; color: var(--og-muted); }
.og-recipes__text { margin: 6px 0; font-size: 15px; line-height: 1.5; }
.og-recipes__foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 14px; }

/* Дресс-код: обложка с правилами и карточки образов */
.og-look-cover { margin: 0; position: relative; border: 2px solid var(--og-line); box-shadow: 4px 4px 0 var(--og-shade); }
.og-look-cover img { display: block; width: 100%; max-height: 190px; object-fit: cover; object-position: center 12%; }
.og-look-cover figcaption { padding: 10px 12px; background: var(--og-bg-3); }
.og-look-cover p { margin: 0; font-family: var(--og-pixel); font-size: 10px; line-height: 1.8; color: var(--og-gold-soft); }

.og-looks { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; }
.og-look {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 8px 10px;
  text-align: left;
  background: var(--og-bg-3);
  border: 2px solid var(--og-line);
  box-shadow: 3px 3px 0 var(--og-shade);
  color: var(--og-snow);
  cursor: pointer;
  font: inherit;
}
.og-look:hover:not(:disabled) { border-color: #d0505c; }
.og-look.is-active { border-color: var(--og-gold); }
.og-look__imgs { display: flex; gap: 4px; }
.og-look__imgs img { flex: 1; min-width: 0; height: 150px; object-fit: cover; object-position: center top; display: block; }
.og-look__imgs--sprite { height: 150px; align-items: center; justify-content: center; background: var(--og-bg); }
.og-look__title { font-family: var(--og-pixel); font-size: 10px; line-height: 1.6; color: var(--og-gold-soft); }
.og-look__text { font-size: 14px; line-height: 1.35; color: #f6d9d6; }
.og-look__count { margin-top: auto; font-size: 13px; color: var(--og-muted); }
.og-look.is-active .og-look__count { color: var(--og-gold); }

.og-final { margin: 0; padding-left: 18px; line-height: 1.8; color: var(--og-snow); }

.og-link { color: var(--og-gold); text-decoration: none; font-weight: 700; }
.og-link:hover { text-decoration: underline; }

/* Редактор снежинки: четверть и превью */
.og-fl { display: flex; flex-wrap: wrap; gap: 18px; align-items: flex-start; }
.og-fl__grid {
  display: grid;
  grid-template-columns: repeat(5, 30px);
  gap: 3px;
  padding: 6px;
  background: var(--og-bg);
  border: 2px solid var(--og-line);
}
.og-fl__cell { width: 30px; height: 30px; border: 0; padding: 0; background: #6a1e29; cursor: pointer; }
.og-fl__cell.is-on { background: var(--og-snow); }
.og-fl__prev {
  width: 120px;
  height: 120px;
  background: var(--og-bg);
  border: 2px solid var(--og-line);
  display: grid;
  place-items: center;
}
.og-fl__cap { margin: 4px 0 0; font-size: 13px; color: var(--og-muted); }

/* Штамп «засчитано» — как печать на листке */
.og-stamp {
  align-self: flex-start;
  font-family: var(--og-pixel);
  font-size: 11px;
  color: var(--og-gold);
  border: 3px solid var(--og-gold);
  padding: 8px 10px;
  transform: rotate(-4deg);
  background: rgba(255, 207, 74, 0.08);
  animation: og-stamp 0.35s cubic-bezier(0.2, 1.6, 0.4, 1);
}

@keyframes og-stamp {
  from { transform: rotate(-4deg) scale(2.2); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .og-stamp { animation: none; }
}

@media (max-width: 760px) {
  .og-win__editor { flex-direction: column; }
  .og-win__body--row { flex-direction: column; align-items: flex-start; }
}
</style>
