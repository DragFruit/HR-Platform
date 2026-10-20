<template>
  <section class="wish-editor" aria-labelledby="wish-editor-title">
    <div class="wish-editor__hero">
      <WishlistGarland class="wish-editor__garland" />
      <span class="wish-editor__gift" aria-hidden="true">🎁</span>
      <div class="wish-editor__hero-copy">
        <h3 id="wish-editor-title" class="wish-editor__title">Мой вишлист</h3>
        <p class="wish-editor__lead">
          Что тебя порадует? Опиши словами или вставь ссылочку. Коллеги увидят твой вишлист
          и не будут гадать с подарком.
        </p>
      </div>
    </div>

    <p v-if="loading" class="wish-editor__status">Достаём коробки с подарками…</p>

    <template v-else>
      <ol v-if="rows.length" class="wish-editor__list">
        <li
          v-for="(row, index) in rows"
          :key="row.id"
          :data-wish-row="row.id"
          class="wish-editor__row"
          :class="{ 'is-editing': isEditing(row) }"
          :style="{ '--wish-tone': tones[index % tones.length] }"
        >
          <!-- Компактный вид: название, под ним ссылка; карандаш — редактировать -->
          <template v-if="!isEditing(row)">
            <div class="wish-editor__view">
              <p v-if="row.text.trim()" class="wish-editor__view-text">{{ row.text.trim() }}</p>
              <a
                v-if="viewUrl(row)"
                class="wish-editor__view-link"
                :href="viewUrl(row)"
                target="_blank"
                rel="noopener noreferrer nofollow"
                :title="viewUrl(row)"
              >↗ {{ rowDomain(row) }}</a>
            </div>
            <div class="wish-editor__view-tools">
              <button
                type="button"
                class="wish-editor__pencil"
                aria-label="Редактировать желание"
                title="Редактировать"
                @click="startEdit(row)"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
                  <path
                    d="M14.5 5.5 18.5 9.5M4 20l.8-3.7L16.2 5 20 8.8 8.7 20.1 5 20.9 4 20Z"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
            </div>
          </template>

          <!-- Редактирование пункта -->
          <div v-else class="wish-editor__fields">
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

            <div v-if="confirmDeleteId === row.id" class="wish-editor__confirm" role="alertdialog" aria-label="Удалить желание?">
              <span class="wish-editor__confirm-text">Удалить желание?</span>
              <button type="button" class="button ghost wish-editor__small-btn" @click="confirmDeleteId = null">
                Отмена
              </button>
              <button type="button" class="button wish-editor__small-btn wish-editor__danger" @click="remove(index)">
                Да, удалить
              </button>
            </div>
            <div v-else class="wish-editor__row-foot">
              <button type="button" class="wish-editor__delete" @click="askRemove(row, index)">
                Удалить
              </button>
              <button
                type="button"
                class="button wish-editor__small-btn wish-editor__done"
                :disabled="rowUrlError(row)"
                @click="finishEdit(row, index)"
              >
                Готово
              </button>
            </div>
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
          :key="idea.text"
          type="button"
          class="wish-editor__idea"
          @click="addIdea(idea)"
        >
          {{ idea.text }}
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
/** Быстрые идеи: текст пункта; у «Ozon» сразу фокус в поле ссылки. */
const ideas = [
  { text: '📚 Книга', focus: 'text' },
  { text: '💆 Массаж', focus: 'text' },
  { text: '🎨 Мастер-класс', focus: 'text' },
  { text: '🪴 Цветок в горшке', focus: 'text' },
  { text: '🔋 Повербанк', focus: 'text' },
  { text: '🛍️ Ozon', focus: 'url' }
] as const;

const rows = ref<Row[]>([]);
const savedSnapshot = ref('[]');
const loading = ref(true);
const saving = ref(false);
const formError = ref('');
const formOk = ref('');
/** Пункты в режиме редактирования (новые открываются сразу); остальные — компактно. */
const editingIds = ref<string[]>([]);
/** Пункт, для которого показано «Удалить желание?». */
const confirmDeleteId = ref<string | null>(null);

const isEditing = (row: Row) => editingIds.value.includes(row.id);
const startEdit = (row: Row) => {
  if (!isEditing(row)) editingIds.value = [...editingIds.value, row.id];
};
const stopEdit = (row: Row) => {
  editingIds.value = editingIds.value.filter((id) => id !== row.id);
  if (confirmDeleteId.value === row.id) confirmDeleteId.value = null;
};
const isBlank = (row: Row) => !row.text.trim() && !row.url.trim();

const snapshot = (list: Row[]) =>
  JSON.stringify(list.map((r) => ({ id: r.id, text: r.text.trim(), url: r.url.trim() })));

const dirty = computed(() => snapshot(rows.value) !== savedSnapshot.value);
watch(dirty, (v) => emit('dirty', v), { immediate: true });
watch(saving, (v) => emit('busy', v));

const applyItems = (items: WishlistItem[]) => {
  rows.value = items.map((i) => ({ id: i.id, text: i.text, url: i.url }));
  savedSnapshot.value = snapshot(rows.value);
  editingIds.value = [];
  confirmDeleteId.value = null;
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
/** Ссылка для компактного вида — только проверенная. */
const viewUrl = (row: Row) => normalizeWishUrl(row.url) || '';
const normalizeRowUrl = (row: Row) => {
  const url = normalizeWishUrl(row.url);
  if (url) row.url = url;
};

const addRow = (text = '', focus: 'text' | 'url' = 'text') => {
  if (rows.value.length >= WISHLIST_MAX_ITEMS) return;
  formOk.value = '';
  const row = { id: newWishId(), text, url: '' };
  rows.value.push(row);
  startEdit(row);
  if (!import.meta.client) return;
  nextTick(() => {
    const sel = focus === 'url' ? '.wish-editor__url' : '.wish-editor__text';
    const el = document.querySelector<HTMLElement>(`[data-wish-row="${row.id}"] ${sel}`);
    el?.focus({ preventScroll: true });
    // по центру панели, чтобы поле не пряталось под липкими кнопками «Сохранить»
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
};

const addIdea = (idea: (typeof ideas)[number]) => addRow(idea.text, idea.focus);

/** Пустой пункт убираем сразу, заполненный — только после «Да, удалить». */
const askRemove = (row: Row, index: number) => {
  if (isBlank(row)) {
    remove(index);
    return;
  }
  confirmDeleteId.value = row.id;
};

const remove = (index: number) => {
  formOk.value = '';
  const [row] = rows.value.splice(index, 1);
  if (row) stopEdit(row);
  confirmDeleteId.value = null;
};

/** «Готово»: свернуть пункт; пустой просто исчезает. */
const finishEdit = (row: Row, index: number) => {
  if (rowUrlError(row)) return;
  normalizeRowUrl(row);
  if (isBlank(row)) {
    remove(index);
    return;
  }
  stopEdit(row);
};

const reset = () => {
  formError.value = '';
  formOk.value = '';
  rows.value = (JSON.parse(savedSnapshot.value) as Row[]).map((r) => ({ ...r }));
  editingIds.value = [];
  confirmDeleteId.value = null;
};

const save = async () => {
  formError.value = '';
  formOk.value = '';
  let items: WishlistItem[];
  try {
    items = validateWishlistInput(rows.value);
  } catch (err) {
    formError.value = err instanceof Error ? err.message : 'Проверь пункты вишлиста';
    // открыть пункты с плохой ссылкой, чтобы было видно, что править
    for (const row of rows.value) if (rowUrlError(row)) startEdit(row);
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
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  padding: 10px 12px 10px 16px;
  background: #fffdf6;
  border: 2px solid #202020;
  border-radius: 16px;
  box-shadow: 3px 3px 0 var(--wish-tone, #ddf365);
}

.wish-editor__row.is-editing {
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  padding: 12px;
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

/* Компактный вид пункта */
.wish-editor__view {
  display: grid;
  gap: 3px;
  min-width: 0;
  align-self: center;
}

.wish-editor__view-text {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 600;
  line-height: 1.4;
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.wish-editor__view-link {
  justify-self: start;
  max-width: 100%;
  overflow: hidden;
  font-size: 0.8rem;
  font-weight: 600;
  color: #7451f4;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wish-editor__view-link:hover {
  text-decoration: underline;
}

.wish-editor__view-tools {
  display: flex;
  align-items: center;
  gap: 4px;
}

.wish-editor__pencil {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  color: #565656;
  background: transparent;
  border: 0;
  border-radius: 9px;
  cursor: pointer;
  transition: background-color 0.12s ease, color 0.12s ease;
}

.wish-editor__pencil:hover {
  color: #202020;
  background: rgba(221, 243, 101, 0.6);
}

.wish-editor__pencil:focus-visible,
.wish-editor__delete:focus-visible {
  outline: 2px solid #7451f4;
  outline-offset: 2px;
}

/* Низ пункта в редактировании: «Удалить» слева, «Готово» справа */
.wish-editor__row-foot,
.wish-editor__confirm {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px dashed #d8d8d0;
}

.wish-editor__row-foot {
  justify-content: space-between;
}

.wish-editor__delete {
  padding: 4px 2px;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--danger, #c44a36);
  background: none;
  border: 0;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.wish-editor__confirm {
  justify-content: flex-end;
  padding: 8px 10px;
  background: #fff1ee;
  border: 1.5px solid var(--danger, #c44a36);
  border-radius: 12px;
}

.wish-editor__confirm-text {
  margin-right: auto;
  font-size: 0.86rem;
  font-weight: 700;
}

.wish-editor__small-btn {
  min-height: 0;
  padding: 5px 12px;
  font-size: 0.8rem;
}

.wish-editor__done {
  color: #202020;
  background: #ddf365;
  border: 1.5px solid #202020;
}

.wish-editor__danger {
  color: #fff;
  background: var(--danger, #c44a36);
  border: 1.5px solid var(--danger, #c44a36);
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
    padding-left: 12px;
  }
}
</style>
