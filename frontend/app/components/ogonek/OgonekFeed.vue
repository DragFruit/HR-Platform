<template>
  <aside class="og-feed">
    <h2 class="og-feed__title">{{ title }}</h2>
    <p v-if="!items.length" class="og-feed__empty">{{ empty }}</p>
    <TransitionGroup v-else name="og-feed" tag="ul" class="og-feed__list">
      <li v-for="item in items" :key="item.id" class="og-feed__item">
        <span class="og-feed__dot" :class="`og-feed__dot--${item.kind}`" aria-hidden="true" />
        <span class="og-feed__text">
          <template v-if="item.name">
            <strong>{{ item.name }}</strong>
            <span v-if="item.department" class="og-feed__dep"> · {{ item.department }}</span>
            <span> — {{ item.text }}</span>
          </template>
          <template v-else>{{ item.text }}</template>
        </span>
        <time class="og-feed__ago" :datetime="item.at">{{ ago(item.at) }}</time>
      </li>
    </TransitionGroup>
  </aside>
</template>

<script setup lang="ts">
/**
 * Живая лента: главное, что перенесено с «Охотников за привидениями» —
 * постоянно видимая чужая активность (спека, раздел 4b).
 *
 * «Спасибо» приходит без имени: открытка анонимна, и это решается на сервере.
 */
import type { OgonekFeedItem } from '~/events/ogonek/types';

const props = withDefaults(
  defineProps<{ items: OgonekFeedItem[]; title?: string; empty?: string; nowMs?: number }>(),
  { title: 'Прямо сейчас', empty: 'Пока тихо.', nowMs: 0 }
);

function ago(iso: string): string {
  const base = props.nowMs || Date.now();
  const mins = Math.max(0, Math.round((base - Date.parse(iso)) / 60000));
  if (mins < 1) return 'только что';
  if (mins < 60) return `${mins} мин назад`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} ч назад`;
  return `${Math.round(hours / 24)} дн назад`;
}
</script>

<style scoped>
.og-feed {
  background: var(--og-bg-2, #5a0e1a);
  border: 2px solid var(--og-line, #a02a36);
  box-shadow: 4px 4px 0 var(--og-shade, #1c0307);
  padding: 12px 14px;
  color: var(--og-muted, #e7b9bd);
}

.og-feed__title {
  margin: 0 0 10px;
  font-family: var(--og-pixel, monospace);
  font-size: 10px;
  font-weight: 400;
  letter-spacing: 0.04em;
  color: var(--og-gold, #ffcf4a);
}

.og-feed__empty { margin: 0; font-size: 13px; opacity: 0.7; }

.og-feed__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 420px;
  overflow-y: auto;
}

.og-feed__item {
  display: grid;
  grid-template-columns: 10px 1fr auto;
  gap: 8px;
  align-items: baseline;
  font-size: 14px;
  line-height: 1.4;
}

.og-feed__item strong { color: var(--og-snow, #fbf7f4); }

.og-feed__dot {
  width: 8px;
  height: 8px;
  background: #d99a2b;
  align-self: center;
}

.og-feed__dot--toy { background: #7d1f28; }
.og-feed__dot--snowflake { background: #f5efe3; }
.og-feed__dot--thanks { background: #e8a87c; }
.og-feed__dot--window { background: #2f7f7a; }
.og-feed__dot--letter { background: #e8d7b4; }

.og-feed__dep { opacity: 0.65; }
.og-feed__ago { font-size: 11px; opacity: 0.55; white-space: nowrap; }

/* Новое событие въезжает сверху, а не возникает рывком. */
.og-feed-enter-active { transition: opacity 0.4s ease, transform 0.4s ease; }
.og-feed-enter-from { opacity: 0; transform: translateY(-6px); }
.og-feed-move { transition: transform 0.4s ease; }

@media (prefers-reduced-motion: reduce) {
  .og-feed-enter-active,
  .og-feed-move { transition: none; }
}
</style>
