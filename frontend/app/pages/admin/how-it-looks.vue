<template>
  <div v-if="!authReady" class="auth-loading">Загрузка...</div>
  <VacationsManagerExperience v-else preview />
</template>

<script setup lang="ts">
const { authReady } = useAuth();
</script>
