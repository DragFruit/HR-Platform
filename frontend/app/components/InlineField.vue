<template>
  <p
    v-if="readonly || !editing"
    class="editable-line"
    :class="[className, { 'is-empty': !modelValue }]"
    :title="readonly ? undefined : 'Нажмите для редактирования'"
    @click="startEdit"
  >
    {{ modelValue || placeholder }}
  </p>
  <input
    v-else
    ref="inputRef"
    v-model="draft"
    class="inline-edit-input"
    :class="className"
    :placeholder="placeholder"
    @blur="commit"
    @keydown.enter="commit"
    @keydown.esc="cancel"
    @pointerdown.stop
  />
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: string;
  readonly?: boolean;
  placeholder?: string;
  className?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const editing = ref(false);
const draft = ref(props.modelValue);
const inputRef = ref<HTMLInputElement | null>(null);

watch(
  () => props.modelValue,
  (value) => {
    if (!editing.value) draft.value = value;
  }
);

const startEdit = () => {
  if (props.readonly) return;
  draft.value = props.modelValue;
  editing.value = true;
  nextTick(() => inputRef.value?.focus());
};

const commit = () => {
  editing.value = false;
  emit('update:modelValue', draft.value.trim());
};

const cancel = () => {
  draft.value = props.modelValue;
  editing.value = false;
};
</script>
