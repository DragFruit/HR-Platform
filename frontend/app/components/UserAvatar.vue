<template>
  <span
    class="user-avatar"
    :class="{
      'user-avatar--interactive': interactive,
      'user-avatar--character': Boolean(src),
      'user-avatar--fallback': !src
    }"
    :style="containerStyle"
    :title="title"
  >
    <img v-if="src" :src="src" :alt="alt" class="user-avatar__img" />
    <span v-else class="user-avatar__fallback">{{ initials }}</span>
  </span>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    userId?: number | null;
    name?: string;
    size?: number;
    interactive?: boolean;
  }>(),
  {
    userId: null,
    name: '',
    size: 40,
    interactive: false
  }
);

const { getAvatarUrl } = useAvatars();

const src = computed(() => getAvatarUrl(props.userId));

const initials = computed(() => {
  const parts = props.name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
});

const alt = computed(() => (props.name ? `Аватар: ${props.name}` : 'Аватар'));

const title = computed(() => props.name || undefined);

const containerStyle = computed(() => {
  if (src.value) {
    return { height: `${props.size}px`, width: 'auto' };
  }
  return { width: `${props.size}px`, height: `${props.size}px` };
});
</script>
