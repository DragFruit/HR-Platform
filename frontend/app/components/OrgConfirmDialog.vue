<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="org-confirm-overlay"
      role="presentation"
      @click.self="emit('cancel')"
    >
      <div class="org-confirm-card card" role="alertdialog" aria-modal="true" :aria-labelledby="titleId">
        <h3 :id="titleId" class="org-confirm-title">Подтверждение</h3>
        <p class="org-confirm-message">{{ message }}</p>
        <div class="org-confirm-actions row">
          <button type="button" class="button ghost" @click="emit('cancel')">Отмена</button>
          <button type="button" class="button primary" @click="emit('confirm')">Удалить</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
defineProps<{
  open: boolean;
  message: string;
}>();

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();

const titleId = 'org-confirm-title';
</script>
