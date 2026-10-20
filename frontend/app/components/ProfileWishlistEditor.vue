<template>
  <section class="wish-editor" aria-labelledby="wish-editor-title">
    <div class="wish-editor__hero">
      <WishlistGarland class="wish-editor__garland" />
      <span class="wish-editor__gift" aria-hidden="true">🎁</span>
      <div class="wish-editor__hero-copy">
        <h3 id="wish-editor-title" class="wish-editor__title">Мой вишлист</h3>
        <p class="wish-editor__lead">
          Что тебя порадует? Напиши словами или вставь ссылку — коллеги увидят вишлист
          в твоей визитке и не будут гадать с подарком.
        </p>
      </div>
    </div>

    <p v-if="loading" class="wish-editor__status">Достаём коробки с подарками…</p>

    <template v-else>
      <ol v-if="rows.length" class="wish-editor__list">
        <li
          v-for="(row, index) in rows"
          :key="row.id"
          class="wish-editor__row"
          :style="{ '--wish-tone': tones[index % tones.length] }"
        >
          <span class="wish-editor__num" aria-hidden="true">{{ index + 1 }}</span>
          <div class="wish-editor__fields">
            <label class="wish-editor__field">
              <span class="wish-editor__label">Что хочется</span>
              <textarea
                v-model="row.text"
                class="table-input wish-editor__text"
                rows="2"
                :maxlength="WISHLIST_MAX_TEXT"
                placeholder="Например: книга «Дюна», сертификат в кофейню, плед в клетку"
              />
              <span
                class="wish-editor__count"
                :class="{ 'is-near': row.text.length > WISHLIST_MAX_TEXT - 30 }"
              >{{ row.text.length }}/{{ WISHLIST_MAX_TEXT }}</span>
            </label>
            <label class="wish-editor__field">
              <span class="wish-editor__label">Ссылка <span class="muted">(необязательно)</span></span>
              <input
                v-model="row.url"
                class="table-input wish-editor__url"
                :class="{ 'is-invalid': rowUrlError(row) }"
                type="url"
                inputmode="url"
                placeholder="https://…"
                :maxlength="WISHLIST_MAX_URL"
                @blur="normalizeRowUrl(row)"
              />
              <span v-if="rowUrlError(row)" class="wish-editor__field-error">
                Нужна ссылка вида https://сайт.ru/…
              </span>
              <span v-else-if="rowDomain(row)" class="wish-editor__domain">↗ {{ rowDomain(row) }}</span>
            </label>
          </div>
          <div class="wish-editor__tools">
            <button
              type="button"
              class="wish-editor__tool"
              aria-label="Выше"
              title="Выше"
              :disabled="index === 0"
              @click="move(index, -1)"
            >
              ↑
            </button>
            <button
              type="button"
              class="wish-editor__tool"
              aria-label="Ниже"
              title="Ниже"
              :disabled="index === rows.length - 1"
              @click="move(index, 1)"
            >
              ↓
            </button>
            <button
              type="button"
              class="wish-editor__tool wish-editor__tool--remove"
              aria-label="Убрать пункт"
              title="Убрать"
              @click="remove(index)"
            >
              ×
            </button>
          </div>
        </li>
      </ol>

      <div v-else class="wish-editor__empty">
        <span aria-hidden="true">🎈</span>
        <p>Пока пусто. Начни с одной мечты — большой или совсем маленькой.</p>
      </div>

      <div class="wish-editor__add-row">
        <button
          type="button"
          class="wish-editor__add"
          :disabled="rows.length >= WISHLIST_MAX_ITEMS"
          @click="addRow()"
        >
          + Добавить желание
        </button>
        <span class="wish-editor__limit muted">{{ rows.length }} из {{ WISHLIST_MAX_ITEMS }}</span>
      </div>

      <div v-if="rows.length < WISHLIST_MAX_ITEMS" class="wish-editor__ideas">
        <span class="wish-editor__ideas-label muted">Идеи:</span>
        <button
          v-for="idea in ideas"
          :key="idea"
          type="button"
          class="wish-editor__idea"
          @click="addRow(idea)"
        >
          {{ idea }}
        </button>
      </div>

      <p v-if="formError" class="wish-editor__error" role="alert">{{ formError }}</p>
      <p v-if="formOk" class="wish-editor__ok" role="status">{{ formOk }}</p>

      <div class="wish-editor__actions">
        <button
          type="button"
          class="button ghost"
          :disabled="saving || !dirty"
          @click="reset"
        >
          Отменить правки
        </button>
        <button
          type="button"
          class="button primary wish-editor__save"
          :disabled="saving || !dirty"
          @click="save"
        >
          {{ saving ? 'Сохраняем…' : 'Сохранить вишлист' }}
        </button>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import {
  WISHLIST_MAX_ITEMS,
  WISHLIST_MAX_TEXT,
  WISHLIST_MAX_URL,
  newWishId,
  normalizeWishUrl,
  validateWishlistInput,
  wishUrlDomain,
  type WishlistItem
} from '~/utils/wishlist';

const emit = defineEmits<{ busy: [value: boolean]; dirty: [value: boolean] }>();

type Row = { id: string; text: string; url: string };

const tones = ['#ddf365', '#fd81ff', '#f3b33e', '#b9a6ff', '#ee815a', '#9fd6c9'];
const ideas = ['📚 Книга', '☕ Сертификат в кофейню', '🌿 Растение в горшке', '🎧 Наушники', '🍫 Что-нибудь сладкое'];

const rows = ref<Row[]>([]);
const savedSnapshot = ref('[]');
const loading = ref(true);
const saving = ref(false);
const formError = ref('');
const formOk = ref('');

const snapshot = (list: Row[]) =>
  JSON.stringify(list.map((r) => ({ id: r.id, text: r.text.trim(), url: r.url.trim() })));

const dirty = computed(() => snapshot(rows.value) !== savedSnapshot.value);
watch(dirty, (v) => emit('dirty', v), { immediate: true });
watch(saving, (v) => emit('busy', v));

const applyItems = (items: WishlistItem[]) => {
  rows.value = items.map((i) => ({ id: i.id, text: i.text, url: i.url }));
  savedSnapshot.value = snapshot(rows.value);
};

const load = async () => {
  loading.value = true;
  formError.value = '';
  try {
    const data = await $fetch<{ items: WishlistItem[] }>('/api/profile/wishlist');
    applyItems(Array.isArray(data.items) ? data.items : []);
  } catch {
    applyItems([]);
    formError.value = 'Не получилось загрузить вишлист — попробуй открыть настройки ещё раз.';
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  void load();
});

const rowUrlError = (row: Row) => normalizeWishUrl(row.url) === null;
const rowDomain = (row: Row) => {
  const url = normalizeWishUrl(row.url);
  return url ? wishUrlDomain(url) : '';
};
const normalizeRowUrl = (row: Row) => {
  const url = normalizeWishUrl(row.url);
  if (url) row.url = url;
};

const addRow = (text = '') => {
  if (rows.value.length >= WISHLIST_MAX_ITEMS) return;
  formOk.value = '';
  rows.value.push({ id: newWishId(), text, url: '' });
};

const remove = (index: number) => {
  formOk.value = '';
  rows.value.splice(index, 1);
};

const move = (index: number, delta: number) => {
  const target = index + delta;
  if (target < 0 || target >= rows.value.length) return;
  const list = [...rows.value];
  const [item] = list.splice(index, 1);
  list.splice(target, 0, item!);
  rows.value = list;
  formOk.value = '';
};

const reset = () => {
  formError.value = '';
  formOk.value = '';
  rows.value = (JSON.parse(savedSnapshot.value) as Row[]).map((r) => ({ ...r }));
};

const save = async () => {
  formError.value = '';
  formOk.value = '';
  let items: WishlistItem[];
  try {
    items = validateWishlistInput(rows.value);
  } catch (err) {
    formError.value = err instanceof Error ? err.message : 'Проверь пункты вишлиста';
    return;
  }
  saving.value = true;
  try {
    const res = await $fetch<{ items: WishlistItem[] }>('/api/profile/wishlist', {
      method: 'PUT',
      body: { items }
    });
    applyItems(Array.isArray(res.items) ? res.items : []);
    formOk.value = res.items?.length ? 'Сохранено! Коллеги увидят вишлист в твоей визитке 🎉' : 'Вишлист очищен';
  } catch (err: unknown) {
    const e = err as { data?: { statusMessage?: string }; statusMessage?: string };
    formError.value = e.data?.statusMessage || e.statusMessage || 'Не удалось сохранить';
  } finally {
    saving.value = false;
  }
};
</script>

<style scoped>
.wish-editor {
  display: grid;
  gap: 14px;
}

.wish-editor__hero {
  position: relative;
  display: flex;
  gap: 14px;
  align-items: flex-start;
  padding: 34px 16px 14px;
  overflow: hidden;
  background:
    radial-gradient(circle at 92% 30%, rgba(221, 243, 101, 0.55) 0 46px, transparent 47px),
    radial-gradient(circle at 6% 92%, rgba(253, 129, 255, 0.18) 0 40px, transparent 41px),
    #fff6e8;
  border: 2px solid #202020;
  border-radius: 18px;
}

.wish-editor__garland {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
}

.wish-editor__gift {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 46px;
  height: 46px;
  font-size: 24px;
  background: #ddf365;
  border: 2px solid #202020;
  border-radius: 14px;
  transform: rotate(-6deg);
}

.wish-editor__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.05rem;
}

.wish-editor__lead {
  margin: 4px 0 0;
  font-size: 0.86rem;
  line-height: 1.45;
  color: #565656;
}

.wish-editor__status {
  margin: 0;
  color: #565656;
}

.wish-editor__list {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.wish-editor__row {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: start;
  padding: 12px;
  background: #fffdf6;
  border: 2px solid #202020;
  border-radius: 16px;
  box-shadow: 3px 3px 0 var(--wish-tone, #ddf365);
}

.wish-editor__num {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  margin-top: 18px;
  font-size: 0.8rem;
  font-weight: 800;
  background: var(--wish-tone, #ddf365);
  border: 1.5px solid #202020;
  border-radius: 50%;
}

.wish-editor__fields {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.wish-editor__field {
  position: relative;
  display: grid;
  gap: 4px;
}

.wish-editor__label {
  font-size: 0.78rem;
  font-weight: 700;
}

.wish-editor__text {
  width: 100%;
  min-height: 52px;
  resize: vertical;
  font: inherit;
  font-size: 0.9rem;
  line-height: 1.4;
  box-sizing: border-box;
}

.wish-editor__url {
  width: 100%;
  box-sizing: border-box;
}

.wish-editor__url.is-invalid {
  border-color: var(--danger, #c44a36);
}

.wish-editor__count {
  justify-self: end;
  font-size: 0.72rem;
  color: #838383;
}

.wish-editor__count.is-near {
  color: var(--warning, #c47a12);
}

.wish-editor__field-error {
  font-size: 0.76rem;
  color: var(--danger, #c44a36);
}

.wish-editor__domain {
  font-size: 0.76rem;
  font-weight: 600;
  color: #7451f4;
}

.wish-editor__tools {
  display: grid;
  gap: 4px;
  margin-top: 18px;
}

.wish-editor__tool {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1;
  color: #202020;
  background: #fff;
  border: 1.5px solid #202020;
  border-radius: 8px;
  cursor: pointer;
}

.wish-editor__tool:hover:not(:disabled) {
  background: #ddf365;
}

.wish-editor__tool:disabled {
  opacity: 0.3;
  cursor: default;
}

.wish-editor__tool--remove:hover:not(:disabled) {
  color: #fff;
  background: var(--danger, #c44a36);
}

.wish-editor__empty {
  display: grid;
  justify-items: center;
  gap: 4px;
  padding: 18px 12px;
  text-align: center;
  color: #565656;
  background: #fffdf6;
  border: 1.5px dashed #202020;
  border-radius: 16px;
}

.wish-editor__empty span {
  font-size: 28px;
}

.wish-editor__empty p {
  margin: 0;
  font-size: 0.9rem;
}

.wish-editor__add-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.wish-editor__add {
  padding: 8px 16px;
  font: inherit;
  font-size: 0.88rem;
  font-weight: 700;
  color: #202020;
  background: linear-gradient(135deg, #ddf365 0%, #f3b33e 100%);
  border: 2px solid #202020;
  border-radius: 999px;
  box-shadow: 2px 2px 0 #202020;
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}

.wish-editor__add:hover:not(:disabled) {
  transform: translate(-1px, -1px) rotate(-1deg);
  box-shadow: 3px 3px 0 #202020;
}

.wish-editor__add:disabled {
  opacity: 0.45;
  cursor: default;
}

.wish-editor__limit {
  font-size: 0.8rem;
}

.wish-editor__ideas {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.wish-editor__ideas-label {
  font-size: 0.8rem;
}

.wish-editor__idea {
  padding: 4px 10px;
  font: inherit;
  font-size: 0.8rem;
  color: #202020;
  background: #fff;
  border: 1.5px dashed #202020;
  border-radius: 999px;
  cursor: pointer;
}

.wish-editor__idea:hover {
  background: #fff6e8;
  border-style: solid;
}

.wish-editor__error {
  margin: 0;
  font-size: 0.86rem;
  color: var(--danger, #c44a36);
}

.wish-editor__ok {
  margin: 0;
  font-size: 0.86rem;
  font-weight: 600;
  color: #2d6a4f;
}

/* Прилипает к низу скролла окна настроек: «Сохранить» всегда под рукой */
.wish-editor__actions {
  position: sticky;
  bottom: 0;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 0 12px;
  background: #fff;
  border-top: 1.5px solid #e4e4de;
  box-shadow: 0 -8px 12px -10px rgba(32, 32, 32, 0.25);
}

@media (max-width: 560px) {
  .wish-editor__row {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .wish-editor__num {
    display: none;
  }
}
</style>
