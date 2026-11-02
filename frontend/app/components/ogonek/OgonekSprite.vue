<template>
  <span
    class="og-sprite"
    :class="{ 'og-sprite--pending': !url }"
    :style="style"
    :role="alt ? 'img' : undefined"
    :aria-label="alt || undefined"
    :aria-hidden="alt ? undefined : 'true'"
  />
</template>

<script setup lang="ts">
/**
 * Пиксельный спрайт как фоновая картинка. Размер задаётся либо множителем
 * (`scale`), либо явной шириной — высота тогда считается из пропорций сетки,
 * чтобы пиксели оставались квадратными.
 */
import { ogonekSpriteSize, ogonekSpriteUrl, ogonekSpriteUrlByValue } from '~/utils/ogonekRender';

const props = withDefaults(
  defineProps<{
    rows: readonly string[];
    /** Во сколько раз увеличить сетку. Игнорируется, если задан width. */
    scale?: number;
    /** Ширина в px: высота подбирается по пропорциям сетки. */
    width?: number;
    /** Ширина строкой CSS («100%», «33.34%») — когда размер задаёт контейнер. */
    widthCss?: string;
    alt?: string;
    /** Сетка приходит с сервера новым массивом — кэшировать по значению. */
    byValue?: boolean;
  }>(),
  { scale: 1, width: 0, widthCss: '', alt: '', byValue: false }
);

const mounted = ref(false);
onMounted(() => { mounted.value = true; });

const url = computed(() => {
  if (!mounted.value) return '';
  return props.byValue ? ogonekSpriteUrlByValue(props.rows) : ogonekSpriteUrl(props.rows);
});

const style = computed(() => {
  const { w, h } = ogonekSpriteSize(props.rows);
  if (!w || !h) return {};
  // Высота задаётся пропорцией, а не числом: при сжатии контейнера пиксели
  // остаются квадратными, а не растягиваются.
  return {
    width: props.widthCss || `${props.width || w * props.scale}px`,
    aspectRatio: `${w} / ${h}`,
    backgroundImage: url.value ? `url(${url.value})` : 'none'
  };
});
</script>

<style scoped>
.og-sprite {
  display: block;
  background-repeat: no-repeat;
  background-size: 100% 100%;
  image-rendering: pixelated;
  max-width: 100%;
  flex: none;
}

/* До отрисовки место под спрайт уже занято — макет не прыгает. */
.og-sprite--pending {
  background-color: transparent;
}
</style>
