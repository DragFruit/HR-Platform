<template>
  <div ref="rootRef" class="vac-year-tab" :class="{ 'vac-year-tab--open': open }">
    <button
      type="button"
      class="vac-year-tab__btn"
      :aria-expanded="open"
      aria-haspopup="listbox"
      aria-label="Год календаря"
      @click="open = !open"
    >
      <span class="vac-year-tab__label">{{ modelValue }}</span>
      <span class="vac-year-tab__chevron" aria-hidden="true" />
    </button>
    <ul
      v-if="open"
      class="vac-year-tab__menu"
      role="listbox"
      :aria-activedescendant="`vac-year-${modelValue}`"
    >
      <li
        v-for="year in years"
        :id="`vac-year-${year}`"
        :key="year"
        role="option"
        class="vac-year-tab__option"
        :class="{ 'vac-year-tab__option--active': year === modelValue }"
        :aria-selected="year === modelValue"
        @click="selectYear(year)"
      >
        {{ year }}
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: number;
  years: number[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: number];
}>();

const open = ref(false);
const rootRef = ref<HTMLElement | null>(null);

const selectYear = (year: number) => {
  open.value = false;
  if (year !== props.modelValue) emit('update:modelValue', year);
};

const onDocumentClick = (event: MouseEvent) => {
  if (!open.value) return;
  const target = event.target as Node;
  if (rootRef.value?.contains(target)) return;
  open.value = false;
};

onMounted(() => document.addEventListener('click', onDocumentClick));
onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick));
</script>
