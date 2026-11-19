<template>
  <div class="ogs-page og-theme">
    <section class="ogs-hero">
      <div class="ogs-hero__text">
        <p class="ogs-hero__kicker">ОГОНЁК 2027 · ОКНО 2</p>
        <h1 class="ogs-hero__title">Тайный Санта</h1>
        <p class="ogs-hero__lead">
          Два формата на выбор: классический, где вы дарите конкретному коллеге, и «Белый слон», где подарки
          лежат в общем котле и их можно красть.
        </p>
        <p class="ogs-hero__deadline">
          <template v-if="data?.open">Регистрация до 11 декабря включительно · осталось {{ daysLeft }} {{ daysWord }}</template>
          <template v-else>Регистрация закрыта 11 декабря</template>
        </p>
      </div>
      <NuxtLink class="og-btn og-btn--ghost ogs-hero__back" to="/event/ogonek">К адвенту</NuxtLink>
    </section>

    <p v-if="pending" class="ogs-state">Достаём шапку с номерками...</p>
    <p v-else-if="error" class="ogs-state" role="alert">{{ error }}</p>

    <template v-else-if="data">
      <section v-if="!data.windowOpened" class="ogs-panel">
        <p>Сначала откройте окно 2 в календаре адвента — там и запись.</p>
        <NuxtLink class="og-btn" to="/event/ogonek?day=2">Открыть окно 2</NuxtLink>
      </section>

      <template v-else>
        <OgonekSantaChoice
          :model-value="data.format"
          :counts="data.counts"
          :disabled="busy || !data.open"
          @pick="pick"
        />

        <!-- Моё: вишлист до жеребьёвки, получатель или номер хода после -->
        <section v-if="data.format" class="ogs-panel">
          <template v-if="data.format === 'classic'">
            <template v-if="data.draw">
              <h2 class="ogs-h">Вы дарите</h2>
              <p v-if="data.draw.classic" class="ogs-who">
                <b>{{ data.draw.classic.name }}</b><span v-if="data.draw.classic.department"> · {{ data.draw.classic.department }}</span>
              </p>
              <p v-if="data.draw.classic?.wish" class="ogs-wish">«{{ data.draw.classic.wish }}»</p>
              <p v-else-if="data.draw.classic" class="ogs-muted">Вишлист не оставили — значит, полная свобода.</p>
              <p v-else-if="data.draw.classicTooFew" class="ogs-muted">В классике записался один человек — пар не получилось.</p>
            </template>
            <template v-else>
              <h2 class="ogs-h">Ваш вишлист</h2>
              <p class="ogs-muted">Его увидит только ваш Санта после жеребьёвки.</p>
              <textarea v-model="wish" class="ogs-input" rows="3" maxlength="400" placeholder="Что любите, что собираете, чего точно не надо" />
              <div class="ogs-row">
                <button type="button" class="og-btn" :disabled="busy || wish === data.wish" @click="saveWish">Сохранить</button>
                <span v-if="saved" class="ogs-ok">Сохранено</span>
              </div>
            </template>
          </template>

          <template v-else>
            <template v-if="data.draw">
              <h2 class="ogs-h">Порядок ходов</h2>
              <p v-if="myTurn" class="ogs-who">Ваш ход: <b>№{{ myTurn }}</b></p>
              <ol class="ogs-order">
                <li v-for="(p, i) in data.draw.order" :key="i" :class="{ 'is-mine': p.mine }">
                  {{ p.name }}<span v-if="p.department" class="ogs-muted"> · {{ p.department }}</span>
                </li>
              </ol>
            </template>
            <template v-else>
              <h2 class="ogs-h">Вы в котле</h2>
              <p class="ogs-muted">
                Принесите один подарок в упаковке и без подписи. После 11 декабря здесь появится порядок ходов.
              </p>
            </template>
          </template>
        </section>
      </template>

      <!-- Правила выбранного (или первого) формата -->
      <section class="ogs-rules">
        <div class="ogs-tabs" role="tablist">
          <button
            v-for="f in OGONEK_SANTA_FORMATS"
            :key="f.id"
            type="button"
            role="tab"
            class="ogs-tab"
            :class="{ 'is-on': rulesTab === f.id }"
            :aria-selected="rulesTab === f.id"
            @click="rulesTab = f.id"
          >
            {{ f.title }}
          </button>
        </div>
        <ol class="ogs-steps">
          <li v-for="(step, i) in OGONEK_SANTA_RULES[rulesTab]" :key="i" class="ogs-step">
            <span class="ogs-step__n">{{ i + 1 }}</span>
            <span class="ogs-step__t">{{ step.title }}</span>
            <span class="ogs-step__d">{{ step.text }}</span>
          </li>
        </ol>
      </section>

      <section class="ogs-faq">
        <h2 class="ogs-h">Частые вопросы</h2>
        <details v-for="item in OGONEK_SANTA_FAQ" :key="item.q" class="ogs-q">
          <summary>{{ item.q }}</summary>
          <p>{{ item.a }}</p>
        </details>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * Страница Тайного Санты (окно 2 «Огонька»). Два формата: классический и
 * «Белый слон». Механика: запись до 11 декабря, затем жеребьёвка делается
 * сама на сервере (`santa.get`) — пары для классики и порядок ходов для слона.
 */
import {
  OGONEK_SANTA_FAQ,
  OGONEK_SANTA_FORMATS,
  OGONEK_SANTA_RULES,
  type OgonekSantaFormatId
} from '~/events/ogonek/santa';

useHead({
  link: [
    {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Press+Start+2P&family=PT+Sans:wght@400;700&family=PT+Sans+Narrow:wght@700&display=swap'
    }
  ]
});

type SantaData = {
  open: boolean;
  until: string;
  counts: Record<string, number>;
  format: '' | OgonekSantaFormatId;
  wish: string;
  windowOpened: boolean;
  draw: null | {
    classic: { name: string; department: string; wish: string } | null;
    classicTooFew: boolean;
    order: { name: string; department: string; mine: boolean }[];
  };
};

const data = ref<SantaData | null>(null);
const pending = ref(true);
const error = ref('');
const busy = ref(false);
const wish = ref('');
const saved = ref(false);
const rulesTab = ref<OgonekSantaFormatId>('classic');

const daysLeft = computed(() => {
  if (!data.value) return 0;
  return Math.max(0, Math.ceil((Date.parse(data.value.until) - Date.now()) / 86400000));
});
const daysWord = computed(() => {
  const n = daysLeft.value;
  const d = n % 10;
  const dd = n % 100;
  if (d === 1 && dd !== 11) return 'день';
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return 'дня';
  return 'дней';
});
const myTurn = computed(() => {
  const i = data.value?.draw?.order.findIndex((p) => p.mine) ?? -1;
  return i >= 0 ? i + 1 : 0;
});

function errText(e: unknown) {
  const err = e as { data?: { statusMessage?: string }; statusMessage?: string };
  return err?.data?.statusMessage || err?.statusMessage || 'Не получилось, попробуйте ещё раз';
}

async function load() {
  try {
    data.value = await $fetch<SantaData>('/api/event/ogonek/santa');
    wish.value = data.value.wish;
    if (data.value.format) rulesTab.value = data.value.format;
    error.value = '';
  } catch (e) {
    error.value = errText(e);
  } finally {
    pending.value = false;
  }
}

async function pick(format: string) {
  busy.value = true;
  try {
    await $fetch('/api/event/ogonek/submit', { method: 'POST', body: { kind: 'santa', format } });
    await load();
  } catch (e) {
    error.value = errText(e);
  } finally {
    busy.value = false;
  }
}

async function saveWish() {
  busy.value = true;
  try {
    await $fetch('/api/event/ogonek/submit', { method: 'POST', body: { kind: 'santaWish', text: wish.value } });
    if (data.value) data.value.wish = wish.value;
    saved.value = true;
    setTimeout(() => { saved.value = false; }, 2000);
  } catch (e) {
    error.value = errText(e);
  } finally {
    busy.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
/* Токены .og-theme — в main.css. Страница в тоне адвента: бордо, бумага, золото. */
.ogs-page {
  display: flex;
  flex-direction: column;
  gap: 22px;
  padding: clamp(16px, 3vw, 32px);
  background: radial-gradient(120% 70% at 50% 0%, #64101d 0%, var(--og-bg) 60%), var(--og-bg);
  border: 2px solid var(--og-line);
  box-shadow: 6px 6px 0 var(--og-shade);
  color: #f6d9d6;
}

.ogs-hero { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
.ogs-hero__text { max-width: 62ch; display: flex; flex-direction: column; gap: 10px; }
.ogs-hero__kicker { margin: 0; font-family: var(--og-pixel); font-size: 9px; color: var(--og-gold-soft); letter-spacing: 0.08em; }
.ogs-hero__title {
  margin: 0;
  font-family: var(--og-pixel);
  font-size: clamp(20px, 3vw, 30px);
  font-weight: 400;
  color: var(--og-gold);
  text-shadow: 0 0 18px rgba(255, 207, 74, 0.45), 3px 3px 0 #6b2a00;
}
.ogs-hero__lead { margin: 0; font-size: 17px; line-height: 1.5; }
.ogs-hero__deadline {
  margin: 0;
  align-self: flex-start;
  font-family: var(--og-pixel);
  font-size: 9px;
  line-height: 1.6;
  padding: 8px 10px;
  border: 2px solid var(--og-line);
  color: var(--og-gold-soft);
}
.ogs-hero__back { text-decoration: none; }

.ogs-state { margin: 0; color: var(--og-muted); }

.ogs-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 18px;
  background: rgba(30, 12, 14, 0.45);
  border: 2px dashed rgba(255, 207, 74, 0.3);
}
.ogs-panel p { margin: 0; }
.ogs-h { margin: 0; font-family: var(--og-pixel); font-size: 12px; font-weight: 400; color: var(--og-gold); line-height: 1.5; }
.ogs-muted { color: var(--og-muted); }
.ogs-who { font-size: 18px; }
.ogs-wish { font-size: 16px; font-style: italic; color: #fff3e6; }
.ogs-input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  font: inherit;
  font-size: 15px;
  background: var(--og-paper, #f3efe9);
  color: #2a1216;
  border: 0;
  box-shadow: inset 2px 2px 0 rgba(0, 0, 0, 0.12);
  resize: vertical;
}
.ogs-row { display: flex; align-items: center; gap: 12px; }
.ogs-ok { color: #8fd3a0; font-weight: 700; }

.ogs-order { margin: 0; padding-left: 24px; columns: 2; column-gap: 28px; font-size: 15px; line-height: 1.6; }
.ogs-order li.is-mine { color: var(--og-gold); font-weight: 700; }

.ogs-rules { display: flex; flex-direction: column; gap: 14px; }
.ogs-tabs { display: flex; gap: 8px; flex-wrap: wrap; }
.ogs-tab {
  font-family: var(--og-pixel);
  font-size: 9px;
  line-height: 1.5;
  padding: 9px 12px;
  border: 2px solid var(--og-line);
  background: transparent;
  color: #ffd9d6;
  cursor: pointer;
}
.ogs-tab.is-on { background: var(--og-gold); color: #3a2600; border-color: var(--og-gold); }

.ogs-steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.ogs-step {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: auto 1fr;
  column-gap: 10px;
  row-gap: 4px;
  padding: 12px 14px;
  background: var(--og-paper, #f3efe9);
  color: #2a1216;
  box-shadow: 4px 4px 0 var(--og-shade);
}
.ogs-step__n {
  grid-row: span 2;
  font-family: var(--og-pixel);
  font-size: 16px;
  color: #b3262a;
}
.ogs-step__t { font-weight: 700; font-size: 15px; }
.ogs-step__d { font-size: 14px; line-height: 1.4; color: #5a3a3e; }

.ogs-faq { display: flex; flex-direction: column; gap: 8px; }
.ogs-q { border-top: 1px solid var(--og-line); padding: 10px 0 2px; }
.ogs-q summary { cursor: pointer; font-weight: 700; font-size: 16px; }
.ogs-q p { margin: 8px 0 4px; line-height: 1.5; color: #f6d9d6; }

@media (max-width: 900px) {
  .ogs-steps { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .ogs-order { columns: 1; }
}
</style>

<style>
/* Кнопки ивента: на отдельной странице стиль календаря не действует */
.og-theme .og-btn {
  display: inline-block;
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
  text-decoration: none;
  text-align: center;
}
.og-theme .og-btn:active:not(:disabled) { transform: translate(2px, 2px); box-shadow: 1px 1px 0 #6b2a00; }
.og-theme .og-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.og-theme .og-btn--ghost { background: transparent; color: #ffd9d6; box-shadow: none; border: 2px solid var(--og-line); }
</style>
