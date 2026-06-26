<template>
  <span class="emp-name emp-name--stacked">
    <span class="emp-name__line">{{ lines.line1 }}</span>
    <span v-if="lines.line2" class="emp-name__line">{{ lines.line2 }}</span>
  </span>
</template>

<script setup lang="ts">
import { splitEmployeeNameLines } from '~/utils/employeeName';

const props = defineProps<{
  name: string;
}>();

const lines = computed(() => splitEmployeeNameLines(props.name));
</script>
