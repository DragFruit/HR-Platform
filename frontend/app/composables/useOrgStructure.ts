import type { OrgMember } from './useAdminData';

/** Legacy grid constants — used only when migrating old saved layouts */
export const ORG_GRID_COLS = 6;
export const ORG_GRID_ROW_PX = 60;
export const ORG_GRID_GAP_PX = 10;

export const ORG_CANVAS_EXEC_OFFSET = 76;
export const ORG_COL_WIDTH_PX = 122;
export const ORG_ROW_STEP_PX = 70;
export const ORG_GROUP_MIN_WIDTH = 160;
export const ORG_GROUP_MIN_HEIGHT = 100;
export const ORG_GROUP_DEFAULT_WIDTH = 440;
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
  /** Явный размер карточки; без него — по тексту. */
  width?: number;
  height?: number;
  employees: number;
  members: OrgMember[];
};

export type OrgUnitGroup = {
  id: string;
  executiveId: string;
  /** ФИО руководителя блока — плашка внутри рамки. */
  label: string;
  /** Локальная позиция плашки ФИО внутри .org-group-units. */
  labelX?: number;
  labelY?: number;
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
  /** Смещение средней ортогональной секции (midY / midX), px. */
  mid?: number;
};

export type OrgPlacedItem =
  | { kind: 'unit'; unit: OrgUnit }
  | { kind: 'group'; group: OrgUnitGroup; units: OrgUnit[] };

const STORAGE_KEY = 'vbi-org-structure-v1';

export type OrgStructurePayload = {
  executives: OrgExecutive[];
  units: OrgUnit[];
  groups: OrgUnitGroup[];
  links: OrgLink[];
};

const isOrgPayloadEmpty = (data: OrgStructurePayload) =>
  data.executives.length === 0 && data.units.length === 0 && data.groups.length === 0;

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
let persistTimer: ReturnType<typeof setTimeout> | null = null;

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

  // Локальные координаты отделов внутри групп (свободный layout)
  for (const group of groups) {
    const gUnits = units
      .filter((u) => u.groupId === group.id)
      .sort((a, b) => a.order - b.order);
    if (gUnits.length) {
      const allAtOrigin = gUnits.every((u) => (u.x ?? 0) === 0 && (u.y ?? 0) === 0);
      if (!allAtOrigin) {
        gUnits.forEach((unit) => {
          if (unit.x == null) unit.x = 12;
          if (unit.y == null) unit.y = 12;
        });
      } else {
        gUnits.forEach((unit, index) => {
          const col = index % 2;
          const row = Math.floor(index / 2);
          unit.x = 12 + col * 200;
          unit.y = 12 + row * 88;
        });
      }
    }
    // Плашка ФИО руководителя — свободная позиция внутри рамки
    if (group.labelX == null || group.labelY == null) {
      const maxUnitBottom = gUnits.reduce((max, u) => Math.max(max, (u.y ?? 0) + 88), 12);
      if (group.labelX == null) group.labelX = 24;
      if (group.labelY == null) group.labelY = maxUnitBottom + 8;
    }
  }

  // Высота без ФИО руководителя — только по тексту (сброс артефакта ресайза)
  for (const unit of units) {
    if (unit.height != null && !String(unit.head ?? '').trim()) {
      delete unit.height;
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

  const snapshot = (): OrgStructurePayload => ({
    executives: orgExecutives.value,
    units: orgUnits.value,
    groups: orgGroups.value,
    links: orgLinks.value
  });

  const applyPayload = (data: OrgStructurePayload) => {
    persistSuspended = true;
    try {
      orgExecutives.value = data.executives;
      orgUnits.value = data.units;
      orgGroups.value = data.groups;
      orgLinks.value = sanitizeLinks(data.links);
      ensureCanvasLayout(orgExecutives.value, orgUnits.value, orgGroups.value);
    } finally {
      persistSuspended = false;
    }
  };

  const cacheLocal = (data: OrgStructurePayload) => {
    if (!import.meta.client) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* quota / private mode */
    }
  };

  const readLocalCache = (): OrgStructurePayload | null => {
    if (!import.meta.client) return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw) as Partial<OrgStructurePayload>;
      return {
        executives: Array.isArray(data.executives) ? data.executives : [],
        units: Array.isArray(data.units) ? data.units : [],
        groups: Array.isArray(data.groups) ? data.groups : [],
        links: sanitizeLinks(data.links ?? [])
      };
    } catch {
      return null;
    }
  };

  const canWriteServer = () => {
    const { user } = useAuth();
    return user.value?.role === 'admin' || user.value?.role === 'hr';
  };

  const syncToServer = async (data: OrgStructurePayload) => {
    if (!import.meta.client || !canWriteServer()) return;
    try {
      const saved = await $fetch<OrgStructurePayload>('/api/org-structure', {
        method: 'PUT',
        body: data
      });
      cacheLocal(saved);
    } catch {
      /* нет прав / сеть — локальный кэш уже есть */
    }
  };

  const persist = () => {
    if (!import.meta.client || persistSuspended) return;
    const data = snapshot();
    cacheLocal(data);
    if (!canWriteServer()) return;
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      persistTimer = null;
      void syncToServer(snapshot());
    }, 400);
  };

  const hydrate = async () => {
    if (!import.meta.client || orgHydrated.value) return;
    orgHydrated.value = true;

    let fromServer: OrgStructurePayload | null = null;
    try {
      fromServer = await $fetch<OrgStructurePayload>('/api/org-structure');
    } catch {
      fromServer = null;
    }

    const local = readLocalCache();

    if (fromServer && !isOrgPayloadEmpty(fromServer)) {
      applyPayload(fromServer);
      cacheLocal(fromServer);
      return;
    }

    if (local && !isOrgPayloadEmpty(local)) {
      applyPayload(local);
      // Одноразовая миграция: ноут → сервер
      await syncToServer(local);
      return;
    }

    if (fromServer) {
      applyPayload(fromServer);
      cacheLocal(fromServer);
      return;
    }

    ensureCanvasLayout(orgExecutives.value, orgUnits.value, orgGroups.value);
  };

  const syncLinksFromStorage = () => {
    /* legacy no-op: схема на сервере */
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

  /** Размер карточки отдела; оси независимо. height: null — снова по тексту. */
  const setUnitSize = (
    unitId: string,
    size: { width?: number; height?: number | null }
  ) => {
    const unit = orgUnits.value.find((u) => u.id === unitId);
    if (!unit) return;
    if (size.width != null) unit.width = Math.max(72, Math.round(size.width));
    if (size.height === null) delete unit.height;
    else if (size.height != null) unit.height = Math.max(36, Math.round(size.height));
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
    let pos = inGroup ? { x: 0, y: 0 } : findFreePosition(execId);
    if (inGroup) {
      const siblings = orgUnits.value.filter((u) => u.groupId === inGroup);
      const col = siblings.length % 2;
      const row = Math.floor(siblings.length / 2);
      pos = { x: 12 + col * 200, y: 12 + row * 88 };
    }
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
      label: 'ФИО руководителя',
      labelX: 24,
      labelY: 100,
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

  /** Позиция отдела внутри группы (локальные x/y относительно .org-group-units). */
  const setUnitLocalPosition = (unitId: string, x: number, y: number) => {
    const unit = orgUnits.value.find((u) => u.id === unitId);
    if (!unit || !unit.groupId) return;
    unit.x = Math.max(0, Math.round(x));
    unit.y = Math.max(0, Math.round(y));
    persist();
  };

  /** Позиция плашки ФИО руководителя внутри группы. */
  const setGroupLabelPosition = (groupId: string, x: number, y: number) => {
    const group = orgGroups.value.find((g) => g.id === groupId);
    if (!group) return;
    group.labelX = Math.max(0, Math.round(x));
    group.labelY = Math.max(0, Math.round(y));
    persist();
  };

  /** Переставить отдел внутри группы: beforeUnitId = null → в конец. */
  const reorderUnitInGroup = (
    groupId: string,
    draggedUnitId: string,
    beforeUnitId: string | null
  ) => {
    const list = orgUnits.value
      .filter((u) => u.groupId === groupId)
      .sort((a, b) => a.order - b.order);
    const dragged = list.find((u) => u.id === draggedUnitId);
    if (!dragged) return;
    if (beforeUnitId === draggedUnitId) return;

    const rest = list.filter((u) => u.id !== draggedUnitId);
    let idx = rest.length;
    if (beforeUnitId) {
      const i = rest.findIndex((u) => u.id === beforeUnitId);
      if (i >= 0) idx = i;
    }
    const next = [...rest.slice(0, idx), dragged, ...rest.slice(idx)];
    let changed = false;
    next.forEach((u, i) => {
      const order = (i + 1) * 10;
      if (u.order !== order) {
        u.order = order;
        changed = true;
      }
    });
    if (changed) persist();
  };

  const setLinkMid = (linkId: string, mid: number) => {
    const link = orgLinks.value.find((l) => l.id === linkId);
    if (!link) return;
    link.mid = Math.round(mid);
    persist();
  };

  const ensureLayout = () => {
    ensureCanvasLayout(orgExecutives.value, orgUnits.value, orgGroups.value);
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
    ensureLayout,
    syncLinksFromStorage,
    addExecutive,
    addUnit,
    addGroup,
    setUnitPosition,
    setUnitSize,
    setUnitLocalPosition,
    setGroupLabelPosition,
    setGroupPosition,
    setGroupSize,
    setExecutivePosition,
    removeExecutive,
    removeUnit,
    removeGroup,
    reorderUnitInGroup,
    addLink,
    removeLink,
    setLinkMid,
    buildPlacedItems,
    canvasMinHeight,
    globalCanvasMinHeight
  };
}
