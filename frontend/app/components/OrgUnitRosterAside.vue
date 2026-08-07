<template>
  <aside class="org-roster-aside" aria-label="Сотрудники отдела">
    <div class="org-roster-aside__head">
      <h2 class="org-roster-aside__title">{{ title }}</h2>
      <button
        type="button"
        class="org-roster-aside__close"
        title="Закрыть"
        aria-label="Закрыть список"
        @click="emit('close')"
      >
        ×
      </button>
    </div>

    <p v-if="!sections.length" class="org-roster-aside__empty">
      Пока никого не нашли по этой ноде.
    </p>
    <div v-else class="org-roster-aside__scroll">
      <section
        v-for="section in sections"
        :key="section.id"
        class="org-roster-aside__section"
      >
        <h3
          v-if="showSectionLabels"
          class="org-roster-aside__section-title"
        >
          {{ section.label }}
        </h3>
        <ul class="org-roster-aside__list">
          <li v-for="person in section.people" :key="person.key">
            <button
              v-if="person.openCard"
              type="button"
              class="org-roster-aside__person"
              @click="emit('pick', person, $event)"
            >
              <span class="org-roster-aside__name">{{ person.name }}</span>
              <span v-if="person.title" class="org-roster-aside__role">{{ person.title }}</span>
            </button>
            <div
              v-else
              class="org-roster-aside__person org-roster-aside__person--static"
            >
              <span class="org-roster-aside__name">{{ person.name }}</span>
              <span v-if="person.title" class="org-roster-aside__role">{{ person.title }}</span>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </aside>
</template>

<script setup lang="ts">
import type { OrgRosterPerson, OrgRosterSection } from '~/utils/orgUnitEmployees';

const props = defineProps<{
  title: string;
  sections: OrgRosterSection[];
}>();

const emit = defineEmits<{
  close: [];
  pick: [person: OrgRosterPerson, event: MouseEvent];
}>();

const showSectionLabels = computed(() => props.sections.length > 1);
</script>
