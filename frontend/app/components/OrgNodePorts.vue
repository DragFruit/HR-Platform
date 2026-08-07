<template>
  <div v-if="!readonly" class="org-ports" aria-hidden="true">
    <button
      v-for="side in sides"
      :key="side"
      type="button"
      class="org-port"
      :class="[
        `org-port--${side}`,
        {
          'is-active': activeAnchor?.id === nodeId && activeAnchor?.kind === nodeKind && activeAnchor?.side === side,
          'is-target': linkDraft && !(activeAnchor?.id === nodeId && activeAnchor?.kind === nodeKind && activeAnchor?.side === side),
          'is-hover': hoverAnchor?.id === nodeId && hoverAnchor?.kind === nodeKind && hoverAnchor?.side === side
        }
      ]"
      :title="portTitle(side)"
      @pointerdown.stop.prevent="(e) => emitPortDown(side, e)"
    />
  </div>
</template>

<script setup lang="ts">
import type { OrgLinkAnchor, OrgNodeKind, OrgPortSide } from '~/composables/useOrgStructure';
import { ORG_PORT_SIDES } from '~/utils/orgLinkPath';

defineProps<{
  nodeKind: OrgNodeKind;
  nodeId: string;
  readonly?: boolean;
  linkDraft?: boolean;
  activeAnchor?: OrgLinkAnchor | null;
  hoverAnchor?: OrgLinkAnchor | null;
}>();

const emit = defineEmits<{
  'port-down': [side: OrgPortSide, event: PointerEvent];
}>();

const sides = ORG_PORT_SIDES;
let lastPortDownAt = 0;

const emitPortDown = (side: OrgPortSide, event: MouseEvent | PointerEvent) => {
  if ('button' in event && event.button !== 0) return;
  const now = event.timeStamp || Date.now();
  if (now - lastPortDownAt < 30) return;
  lastPortDownAt = now;
  emit('port-down', side, event as PointerEvent);
};

const portTitle = (side: OrgPortSide) => {
  const labels: Record<OrgPortSide, string> = {
    top: 'Связь сверху',
    right: 'Связь справа',
    bottom: 'Связь снизу',
    left: 'Связь слева'
  };
  return labels[side];
};
</script>
