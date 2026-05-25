<template>
  <section class="card section-card org-page">
    <div class="section-head row">
      <h2 class="section-title">Структура компании</h2>
      <div class="row org-admin-actions">
        <button class="button ghost" type="button" @click="addExecutive">+ Директор</button>
        <button class="button ghost" type="button" @click="addUnit()">+ Отдел</button>
        <button class="button ghost" type="button" @click="addGroup()">+ Группа</button>
      </div>
    </div>

    <OrgChart :readonly="false" />
  </section>
</template>

<script setup lang="ts">
const { addExecutive, addUnit, addGroup } = useOrgStructure();
</script>
