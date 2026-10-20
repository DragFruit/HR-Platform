<template>
  <ol class="wish-list" :aria-label="ariaLabel">
    <li
      v-for="(item, index) in items"
      :key="item.id"
      class="wish-list__item"
      :style="{ '--wish-tone': tones[index % tones.length], '--wish-tilt': `${tilts[index % tilts.length]}deg` }"
    >
      <span class="wish-list__icon" aria-hidden="true">{{ icons[index % icons.length] }}</span>
      <div class="wish-list__body">
        <p v-if="item.text" class="wish-list__text">{{ item.text }}</p>
        <a
          v-if="safeUrl(item.url)"
          class="wish-list__link"
          :href="item.url"
          target="_blank"
          rel="noopener noreferrer nofollow"
          :title="item.url"
        >
          <svg viewBox="0 0 16 16" width="12" height="12" fill="none" aria-hidden="true">
            <path
              d="M5 3.5h7.5V11M12.5 3.5 3.5 12.5"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span>{{ item.text ? domainOf(item.url) : `Посмотреть на ${domainOf(item.url)}` }}</span>
        </a>
      </div>
    </li>
  </ol>
</template>

<script setup lang="ts">
import { isSafeWishUrl, wishUrlDomain, type WishlistItem } from '~/utils/wishlist';

withDefaults(defineProps<{ items: WishlistItem[]; ariaLabel?: string }>(), {
  ariaLabel: 'Вишлист'
});

const icons = ['🎁', '🎈', '🧸', '🌷', '☕', '🎀', '📚', '🍰'];
const tones = ['#ddf365', '#fd81ff', '#f3b33e', '#b9a6ff', '#ee815a', '#9fd6c9'];
const tilts = [-4, 3, -2, 4, -3, 2];

const safeUrl = (url: string) => isSafeWishUrl(url);
const domainOf = (url: string) => wishUrlDomain(url) || 'ссылка';
</script>

<style scoped>
.wish-list {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.wish-list__item {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
  padding: 12px 14px;
  background: #fffdf6;
  border: 2px solid #202020;
  border-radius: 16px;
  box-shadow: 3px 3px 0 var(--wish-tone, #ddf365);
}

.wish-list__icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  font-size: 22px;
  line-height: 1;
  background: color-mix(in srgb, var(--wish-tone, #ddf365) 45%, #fff);
  border: 1.5px solid #202020;
  border-radius: 12px;
  transform: rotate(var(--wish-tilt, 0deg));
}

.wish-list__body {
  display: grid;
  gap: 6px;
  min-width: 0;
  padding-top: 2px;
}

.wish-list__text {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.45;
  color: #202020;
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.wish-list__link {
  justify-self: start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 4px 10px;
  font-size: 0.82rem;
  font-weight: 600;
  color: #202020;
  text-decoration: none;
  background: #fff;
  border: 1.5px solid #202020;
  border-radius: 999px;
  transition: background 0.15s ease, transform 0.15s ease;
}

.wish-list__link span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wish-list__link:hover {
  background: var(--wish-tone, #ddf365);
  transform: translateY(-1px);
}

.wish-list__link:focus-visible {
  outline: 2px solid #7451f4;
  outline-offset: 2px;
}
</style>
