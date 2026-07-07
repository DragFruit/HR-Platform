import type { OrgMember } from './useAdminData';

/** Legacy grid constants — used only when migrating old saved layouts */
export const ORG_GRID_COLS = 6;
export const ORG_GRID_ROW_PX = 60;
export const ORG_GRID_GAP_PX = 10;

export const ORG_CANVAS_EXEC_OFFSET = 76;
export const ORG_COL_WIDTH_PX = 122;
export const ORG_ROW_STEP_PX = 70;
export const ORG_GROUP_MIN_WIDTH = 168;
export const ORG_GROUP_MIN_HEIGHT = 120;
export const ORG_GROUP_DEFAULT_WIDTH = 200;
export const ORG_GROUP_DEFAULT_HEIGHT = 0;

export type OrgExecutive = {
  id: string;
  title: string;
  person: string;
  order: number;
  gridCol?: number;
  gridRow?: number;
  x?: number;
  y?: number;
};

export type OrgUnit = {
  id: string;
  executiveId: string;
  name: string;
  head: string;
  order: number;
  stackId: string | null;
  groupId: string | null;
  gridCol?: number;
  gridRow?: number;
  x?: number;
  y?: number;
  employees: number;
  members: OrgMember[];
};

export type OrgUnitGroup = {
  id: string;
  executiveId: string;
  label: string;
  order: number;
  gridCol?: number;
  gridRow?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

export type OrgNodeKind = 'executive' | 'unit' | 'group';

export type OrgPortSide = 'top' | 'right' | 'bottom' | 'left';

export type OrgLinkAnchor = {
  kind: OrgNodeKind;
  id: string;
  side: OrgPortSide;
};

export type OrgLink = {
  id: string;
  from: OrgLinkAnchor;
  to: OrgLinkAnchor;
};

export type OrgPlacedItem =
  | { kind: 'unit'; unit: OrgUnit }
  | { kind: 'group'; group: OrgUnitGroup; units: OrgUnit[] };

const STORAGE_KEY = 'vbi-org-structure-v1';

const defaultExecutives: OrgExecutive[] = [];
const defaultUnits: OrgUnit[] = [];
const defaultGroups: OrgUnitGroup[] = [];
const defaultLinks: OrgLink[] = [];

const ORG_PORT_SIDES_SET = new Set<OrgPortSide>(['top', 'right', 'bottom', 'left']);

const isValidPortSide = (side: unknown): side is OrgPortSide =>
  typeof side === 'string' && ORG_PORT_SIDES_SET.has(side as OrgPortSide);

const isValidLinkAnchor = (anchor: unknown): anchor is OrgLinkAnchor => {
  if (!anchor || typeof anchor !== 'object') return false;
  const a = anchor as Partial<OrgLinkAnchor>;
  return (
    (a.kind === 'executive' || a.kind === 'unit' || a.kind === 'group') &&
    typeof a.id === 'string' &&
    Boolean(a.id) &&
    isValidPortSide(a.side)
  );
};

const sanitizeLinks = (links: unknown): OrgLink[] => {
  if (!Array.isArray(links)) return [];
  return links.filter((link): link is OrgLink => {
    if (!link || typeof link !== 'object') return false;
    const row = link as Partial<OrgLink>;
    return (
      typeof row.id === 'string' &&
      Boolean(row.id) &&
      isValidLinkAnchor(row.from) &&
      isValidLinkAnchor(row.to)
    );
  });
};

const sameAnchor = (a: OrgLinkAnchor, b: OrgLinkAnchor) =>
  a.kind === b.kind && a.id === b.id && a.side === b.side;

function posOf(item: OrgPlacedItem): { x: number; y: number } {
  if (item.kind === 'group') {
    return { x: item.group.x ?? 0, y: item.group.y ?? ORG_CANVAS_EXEC_OFFSET };
  }
  return { x: item.unit.x ?? 0, y: item.unit.y ?? ORG_CANVAS_EXEC_OFFSET };
}

export function buildPlacedItems(executiveId: string, units: OrgUnit[], groups: OrgUnitGroup[]): OrgPlacedItem[] {
  const execUnits = units.filter((u) => u.executiveId === executiveId);
  const execGroups = groups.filter((g) => g.executiveId === executiveId).sort((a, b) => a.order - b.order);
  const items: OrgPlacedItem[] = [];

  for (const group of execGroups) {
    const gUnits = execUnits.filter((u) => u.groupId === group.id).sort((a, b) => a.order - b.order);
    items.push({ kind: 'group', group, units: gUnits });
  }

  const solo = execUnits
    .filter((u) => !u.groupId)
    .sort((a, b) => a.order - b.order);

  for (const unit of solo) {
    items.push({ kind: 'unit', unit });
  }

  return items.sort((a, b) => {
    const pa = posOf(a);
    const pb = posOf(b);
    if (pa.y !== pb.y) return pa.y - pb.y;
    return pa.x - pb.x;
  });
}

function gridToCanvas(col: number, row: number): { x: number; y: number } {
  return {
    x: col * ORG_COL_WIDTH_PX,
    y: ORG_CANVAS_EXEC_OFFSET + row * ORG_ROW_STEP_PX
  };
}

const nextId = (prefix: string) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

let persistWatchRegistered = false;
let persistSuspended = false;

function collectOccupied(
  executives: OrgExecutive[],
  units: OrgUnit[],
  groups: OrgUnitGroup[]
): { x: number; y: number }[] {
  const occupied: { x: number; y: number }[] = [];
  for (const exec of executives) {
    if (exec.x != null && exec.y != null) occupied.push({ x: exec.x, y: exec.y });
  }
  for (const unit of units.filter((u) => !u.groupId)) {
    if (unit.x != null && unit.y != null) occupied.push({ x: unit.x, y: unit.y });
  }
  for (const group of groups) {
    if (group.x != null && group.y != null) occupied.push({ x: group.x, y: group.y });
  }
  return occupied;
}

function ensureCanvasLayout(
  executives: OrgExecutive[],
  units: OrgUnit[],
  groups: OrgUnitGroup[]
) {
  executives.forEach((exec, index) => {
    if (exec.order !== index) exec.order = index;
    if (exec.x != null && exec.y != null) return;
    if (exec.gridCol != null && exec.gridRow != null) {
      const pos = gridToCanvas(exec.gridCol, exec.gridRow);
      exec.x = pos.x;
      exec.y = pos.y;
    }
  });

  const globalOccupied = collectOccupied(executives, units, groups);
  for (const exec of executives) {
    if (exec.x != null && exec.y != null) continue;
    const slot = findFreeSlot(globalOccupied, 0);
    exec.x = slot.x;
    exec.y = slot.y;
    globalOccupied.push(slot);
  }

  const execIds = [...new Set(units.map((u) => u.executiveId).concat(groups.map((g) => g.executiveId)))];

  for (const executiveId of execIds) {
    const mark = (x: number, y: number) => globalOccupied.push({ x, y });

    const migrateUnit = (unit: OrgUnit) => {
      if (unit.x != null && unit.y != null) return;
      if (unit.gridCol != null && unit.gridRow != null) {
        const pos = gridToCanvas(unit.gridCol, unit.gridRow);
        unit.x = pos.x;
        unit.y = pos.y;
        mark(pos.x, pos.y);
        return;
      }
      if (unit.stackId) {
        const stackMate = units.find(
          (u) =>
            u.executiveId === executiveId &&
            !u.groupId &&
            u.stackId === unit.stackId &&
            u.id !== unit.id &&
            u.x != null &&
            u.y != null
        );
        if (stackMate) {
          unit.x = stackMate.x;
          unit.y = (stackMate.y ?? ORG_CANVAS_EXEC_OFFSET) + ORG_ROW_STEP_PX;
          mark(unit.x, unit.y);
          return;
        }
      }
    };

    const solo = units
      .filter((u) => u.executiveId === executiveId && !u.groupId)
      .sort((a, b) => a.order - b.order);

    for (const unit of solo) {
      migrateUnit(unit);
      if (unit.x == null || unit.y == null) {
        const slot = findFreeSlot(globalOccupied);
        unit.x = slot.x;
        unit.y = slot.y;
        mark(slot.x, slot.y);
      }
      unit.stackId = null;
    }

    for (const group of groups.filter((g) => g.executiveId === executiveId)) {
      if (group.x != null && group.y != null) continue;
      if (group.gridCol != null && group.gridRow != null) {
        const pos = gridToCanvas(group.gridCol, group.gridRow);
        group.x = pos.x;
        group.y = pos.y;
        mark(pos.x, pos.y);
        continue;
      }
      const slot = findFreeSlot(globalOccupied);
      group.x = slot.x;
      group.y = slot.y;
      mark(slot.x, slot.y);
    }
  }
}

function findFreeSlot(
  occupied: { x: number; y: number }[],
  minY = ORG_CANVAS_EXEC_OFFSET
): { x: number; y: number } {
  const threshold = 80;
  const yValues: number[] = minY === 0 ? [0] : [];
  for (let row = 0; row < 32; row++) {
    yValues.push(ORG_CANVAS_EXEC_OFFSET + row * ORG_ROW_STEP_PX);
  }
  for (const y of yValues) {
    if (y < minY) continue;
    for (let col = 0; col < 12; col++) {
      const x = col * ORG_COL_WIDTH_PX;
      const clash = occupied.some(
        (p) => Math.abs(p.x - x) < threshold && Math.abs(p.y - y) < threshold
      );
      if (!clash) return { x, y };
    }
  }
  const maxY = Math.max(minY, ORG_CANVAS_EXEC_OFFSET, ...occupied.map((p) => p.y + ORG_ROW_STEP_PX));
  return { x: 0, y: maxY };
}

export function canvasMinHeight(items: OrgPlacedItem[], executive?: OrgExecutive): number {
  let max = 280;
  const execY = executive?.y ?? 0;
  max = Math.max(max, execY + 80);
  for (const item of items) {
    const pos = posOf(item);
    const itemH = item.kind === 'group' ? item.group.height ?? 160 : 72;
    max = Math.max(max, pos.y + itemH + 48);
  }
  return max;
}

export function globalCanvasMinHeight(
  placedByExecutive: Record<string, OrgPlacedItem[]>,
  executives: OrgExecutive[]
): number {
  let max = 280;
  for (const exec of executives) {
    max = Math.max(max, canvasMinHeight(placedByExecutive[exec.id] ?? [], exec));
  }
  return max;
}

export function useOrgStructure() {
  const orgExecutives = useState<OrgExecutive[]>('vbi-org-executives', () => [...defaultExecutives]);
  const orgUnits = useState<OrgUnit[]>('vbi-org-units', () => [...defaultUnits]);
  const orgGroups = useState<OrgUnitGroup[]>('vbi-org-groups', () => [...defaultGroups]);
  const orgLinks = useState<OrgLink[]>('vbi-org-links', () => [...defaultLinks]);
  const orgHydrated = useState<boolean>('vbi-org-hydrated', () => false);

  const executivesSorted = computed(() => [...orgExecutives.value].sort((a, b) => a.order - b.order));

  const placedByExecutive = computed(() => {
    const map: Record<string, OrgPlacedItem[]> = {};
    for (const exec of executivesSorted.value) {
      map[exec.id] = buildPlacedItems(exec.id, orgUnits.value, orgGroups.value);
    }
    return map;
  });

  const persist = () => {
    if (!import.meta.client || persistSuspended) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          executives: orgExecutives.value,
          units: orgUnits.value,
          groups: orgGroups.value,
          links: orgLinks.value
        })
      );
    } catch {
      /* quota / private mode */
    }
  };

  const hydrate = () => {
    if (!import.meta.client || orgHydrated.value) return;
    orgHydrated.value = true;

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      ensureCanvasLayout(orgExecutives.value, orgUnits.value, orgGroups.value);
      return;
    }

    try {
      const data = JSON.parse(raw) as {
        executives?: OrgExecutive[];
        units?: OrgUnit[];
        groups?: OrgUnitGroup[];
        links?: OrgLink[];
      };
      persistSuspended = true;
      if (data.executives?.length) orgExecutives.value = data.executives;
      if (data.units?.length) orgUnits.value = data.units;
      if (data.groups) orgGroups.value = data.groups;
      orgLinks.value = sanitizeLinks(data.links ?? []);
      ensureCanvasLayout(orgExecutives.value, orgUnits.value, orgGroups.value);
    } catch {
      /* keep defaults */
    } finally {
      persistSuspended = false;
    }
  };

  const syncLinksFromStorage = () => {
    if (!import.meta.client) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as { links?: OrgLink[] };
      if (!Array.isArray(data.links)) return;
      const stored = sanitizeLinks(data.links);
      if (stored.length > orgLinks.value.length) {
        orgLinks.value = stored;
      }
    } catch {
      /* ignore */
    }
  };

  const setExecutivePosition = (executiveId: string, x: number, y: number) => {
    const exec = orgExecutives.value.find((e) => e.id === executiveId);
    if (!exec) return;
    exec.x = Math.max(0, Math.round(x));
    exec.y = Math.max(0, Math.round(y));
    persist();
  };

  const findFreeGlobalPosition = (minY = ORG_CANVAS_EXEC_OFFSET) =>
    findFreeSlot(collectOccupied(orgExecutives.value, orgUnits.value, orgGroups.value), minY);

  const findFreePosition = (executiveId: string) => findFreeGlobalPosition();

  const setUnitPosition = (unitId: string, x: number, y: number) => {
    const unit = orgUnits.value.find((u) => u.id === unitId);
    if (!unit) return;
    unit.x = Math.max(0, Math.round(x));
    unit.y = Math.max(0, Math.round(y));
    persist();
  };

  const setGroupPosition = (groupId: string, x: number, y: number) => {
    const group = orgGroups.value.find((g) => g.id === groupId);
    if (!group) return;
    group.x = Math.max(0, Math.round(x));
    group.y = Math.max(0, Math.round(y));
    persist();
  };

  const setGroupSize = (groupId: string, width: number, height: number) => {
    const group = orgGroups.value.find((g) => g.id === groupId);
    if (!group) return;
    group.width = Math.max(ORG_GROUP_MIN_WIDTH, Math.round(width));
    group.height = Math.max(ORG_GROUP_MIN_HEIGHT, Math.round(height));
    persist();
  };

  const addExecutive = () => {
    const order = Math.max(...orgExecutives.value.map((e) => e.order), -1) + 1;
    const { x, y } = findFreeGlobalPosition(0);
    orgExecutives.value.push({
      id: nextId('exe'),
      title: 'Директор',
      person: '',
      order,
      x,
      y
    });
    persist();
  };

  const addUnit = (executiveId?: string, groupId?: string | null) => {
    const execId = executiveId ?? orgExecutives.value[0]?.id;
    if (!execId) return;

    const inGroup = groupId ?? null;
    const order = Math.max(...orgUnits.value.filter((u) => u.executiveId === execId).map((u) => u.order), 0) + 10;
    const pos = inGroup ? { x: 0, y: 0 } : findFreePosition(execId);
    orgUnits.value.push({
      id: nextId('u'),
      executiveId: execId,
      name: 'Новый отдел',
      head: '',
      order,
      stackId: null,
      groupId: inGroup,
      x: pos.x,
      y: pos.y,
      employees: 0,
      members: []
    });
    persist();
  };

  const addGroup = (executiveId?: string) => {
    const execId = executiveId ?? orgExecutives.value[0]?.id;
    if (!execId) return;
    const order = Math.max(...orgGroups.value.filter((g) => g.executiveId === execId).map((g) => g.order), 0) + 10;
    const { x, y } = findFreePosition(execId);
    const groupId = nextId('grp');
    orgGroups.value.push({
      id: groupId,
      executiveId: execId,
      label: 'Руководитель блока',
      order,
      x,
      y,
      width: ORG_GROUP_DEFAULT_WIDTH
    });
    persist();
    return groupId;
  };

  const removeLinksForNode = (kind: OrgNodeKind, id: string) => {
    orgLinks.value = orgLinks.value.filter((link) => {
      const from = link.from;
      const to = link.to;
      return !((from.kind === kind && from.id === id) || (to.kind === kind && to.id === id));
    });
    persist();
  };

  const addLink = (from: OrgLinkAnchor, to: OrgLinkAnchor) => {
    if (sameAnchor(from, to)) return;
    const exists = orgLinks.value.some(
      (link) =>
        (sameAnchor(link.from, from) && sameAnchor(link.to, to)) ||
        (sameAnchor(link.from, to) && sameAnchor(link.to, from))
    );
    if (exists) return;
    orgLinks.value = [...orgLinks.value, { id: nextId('lnk'), from, to }];
    persist();
  };

  const removeLink = (linkId: string) => {
    orgLinks.value = orgLinks.value.filter((l) => l.id !== linkId);
    persist();
  };

  const removeExecutive = (id: string) => {
    removeLinksForNode('executive', id);
    orgExecutives.value = orgExecutives.value.filter((e) => e.id !== id);
    orgUnits.value = orgUnits.value.filter((u) => u.executiveId !== id);
    orgGroups.value = orgGroups.value.filter((g) => g.executiveId !== id);
    persist();
  };

  const removeUnit = (unitId: string) => {
    removeLinksForNode('unit', unitId);
    orgUnits.value = orgUnits.value.filter((u) => u.id !== unitId);
    persist();
  };

  const removeGroup = (groupId: string) => {
    removeLinksForNode('group', groupId);
    orgUnits.value.forEach((u) => {
      if (u.groupId === groupId) u.groupId = null;
    });
    orgGroups.value = orgGroups.value.filter((g) => g.id !== groupId);
    persist();
  };

  if (import.meta.client && !persistWatchRegistered) {
    persistWatchRegistered = true;
    watch([orgExecutives, orgUnits, orgGroups, orgLinks], persist, { deep: true });
  }

  return {
    orgExecutives,
    orgUnits,
    orgGroups,
    orgLinks,
    executivesSorted,
    placedByExecutive,
    hydrate,
    syncLinksFromStorage,
    addExecutive,
    addUnit,
    addGroup,
    setUnitPosition,
    setGroupPosition,
    setGroupSize,
    setExecutivePosition,
    removeExecutive,
    removeUnit,
    removeGroup,
    addLink,
    removeLink,
    buildPlacedItems,
    canvasMinHeight,
    globalCanvasMinHeight
  };
}
