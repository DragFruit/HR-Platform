<template>
  <div v-if="!authReady" class="auth-loading">Загрузка...</div>
  <!-- Тот же UI, что у руководителя: календарь + aside (force-approve для админа). -->
  <VacationsManagerExperience v-else preview />
</template>

<script setup lang="ts">
const { authReady } = useAuth();
</script>
