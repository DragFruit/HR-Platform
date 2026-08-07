<template>
  <section
    class="card section-card org-page org-page--employee"
    :class="{ 'org-page--with-roster': Boolean(selectedUnit) }"
  >
    <div class="org-page__body">
      <div class="org-page__chart">
        <OrgChart
          :readonly="true"
          :selected-unit-id="selectedUnit?.id ?? null"
          :roster-open="Boolean(selectedUnit)"
          @select-unit="onSelectUnit"
        />
      </div>
      <OrgUnitRosterAside
        v-if="selectedUnit"
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

const { employees } = useEmployees();
const { openEmployeeVisitingCard } = useEmployeeVisitingCard();

const selectedUnit = ref<{ id: string; name: string } | null>(null);

const rosterSections = computed(() => {
  if (!selectedUnit.value) return [];
  return rosterSectionsForOrgUnitName(selectedUnit.value.name, employees.value);
});

const onSelectUnit = (payload: { id: string; name: string } | null) => {
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
