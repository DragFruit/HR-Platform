<template>
  <section
    class="card section-card org-page"
    :class="{
      'org-page--preview': previewAsEmployee,
      'org-page--with-roster': previewAsEmployee && Boolean(selectedUnit)
    }"
  >
    <div class="org-toolbar row">
      <button
        class="button ghost org-preview-toggle"
        type="button"
        :class="{ 'is-on': previewAsEmployee }"
        :aria-pressed="previewAsEmployee"
        :title="previewAsEmployee ? 'Вернуть редактор' : 'Превью как у сотрудников'"
        :aria-label="previewAsEmployee ? 'Вернуть редактор' : 'Превью как у сотрудников'"
        @click="togglePreview"
      >
        <svg
          v-if="previewAsEmployee"
          class="org-preview-toggle__icon"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            fill="currentColor"
            d="M12 5c-5.2 0-9.5 3.4-11 7 1.5 3.6 5.8 7 11 7s9.5-3.4 11-7c-1.5-3.6-5.8-7-11-7Zm0 11.5A4.5 4.5 0 1 1 12 7a4.5 4.5 0 0 1 0 9.5Zm0-2.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
          />
        </svg>
        <svg
          v-else
          class="org-preview-toggle__icon"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            fill="currentColor"
            d="M12 5c-5.2 0-9.5 3.4-11 7 1.5 3.6 5.8 7 11 7s9.5-3.4 11-7c-1.5-3.6-5.8-7-11-7Zm0 11.5A4.5 4.5 0 1 1 12 7a4.5 4.5 0 0 1 0 9.5Zm0-2.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
          />
          <path
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            d="M3.5 3.5l17 17"
          />
        </svg>
      </button>
      <template v-if="!previewAsEmployee">
        <button class="button ghost" type="button" @click="addExecutive">+ Директор</button>
        <button class="button ghost" type="button" @click="addUnit()">+ Отдел</button>
        <button class="button ghost" type="button" @click="addGroup()">+ Группа</button>
      </template>
    </div>

    <div class="org-page__body">
      <div class="org-page__chart">
        <OrgChart
          :readonly="previewAsEmployee"
          :selected-unit-id="previewAsEmployee ? selectedUnit?.id ?? null : null"
          :roster-open="previewAsEmployee && Boolean(selectedUnit)"
          @select-unit="onSelectUnit"
        />
      </div>
      <OrgUnitRosterAside
        v-if="previewAsEmployee && selectedUnit"
        :title="selectedUnit.name"
        :sections="rosterSections"
        @close="selectedUnit = null"
        @pick="onPickPerson"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import type { OrgRosterPerson } from '~/utils/orgUnitEmployees';
import { orgUnitOpensRoster, rosterSectionsForOrgUnitName } from '~/utils/orgUnitEmployees';

const { addExecutive, addUnit, addGroup } = useOrgStructure();
const { employees } = useEmployees();
const { openEmployeeVisitingCard } = useEmployeeVisitingCard();

const previewAsEmployee = ref(false);
const selectedUnit = ref<{ id: string; name: string } | null>(null);

const rosterSections = computed(() => {
  if (!selectedUnit.value) return [];
  return rosterSectionsForOrgUnitName(selectedUnit.value.name, employees.value);
});

const togglePreview = () => {
  previewAsEmployee.value = !previewAsEmployee.value;
  if (!previewAsEmployee.value) selectedUnit.value = null;
};

const onSelectUnit = (payload: { id: string; name: string } | null) => {
  if (!previewAsEmployee.value) return;
  if (payload && !orgUnitOpensRoster(payload.name)) {
    selectedUnit.value = null;
    return;
  }
  selectedUnit.value = payload;
};

const onPickPerson = (person: OrgRosterPerson, event: MouseEvent) => {
  if (!person.openCard || !person.employee) return;
  openEmployeeVisitingCard(person.employee, event);
};
</script>
