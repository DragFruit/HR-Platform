import type { OrgMember } from './useAdminData';

export const ORG_GRID_COLS = 6;
export const ORG_GRID_ROW_PX = 60;
export const ORG_GRID_GAP_PX = 10;

export type OrgExecutive = {
  id: string;
  title: string;
  person: string;
  order: number;
  gridCol?: number;
  gridRow?: number;
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
};

export type OrgStatsFact = {
  id: string;
  text: string;
};

export type OrgPlacedItem =
  | { kind: 'unit'; unit: OrgUnit }
  | { kind: 'group'; group: OrgUnitGroup; units: OrgUnit[] };

const STORAGE_KEY = 'vbi-org-structure-v1';

const defaultExecutives: OrgExecutive[] = [
  { id: 'exe-fin', title: 'Финансовый директор', person: 'Сергей', order: 0, gridCol: 0, gridRow: 0 },
  { id: 'exe-ceo', title: 'Генеральный директор', person: 'Вадим', order: 1, gridCol: 0, gridRow: 0 },
  { id: 'exe-comm', title: 'Коммерческий директор', person: 'Владислав', order: 2, gridCol: 0, gridRow: 0 }
];

const defaultGroups: OrgUnitGroup[] = [
  { id: 'grp-anna', executiveId: 'exe-ceo', label: 'Анна Трубицына', order: 30, gridCol: 2, gridRow: 0 }
];

const defaultUnits: OrgUnit[] = [
  { id: 'u-acc', executiveId: 'exe-fin', name: 'Бухгалтерия', head: '', order: 10, stackId: null, groupId: null, gridCol: 0, gridRow: 0, employees: 0, members: [] },
  { id: 'u-sales', executiveId: 'exe-comm', name: 'Отдел продаж', head: '', order: 10, stackId: null, groupId: null, gridCol: 0, gridRow: 0, employees: 0, members: [] },
  { id: 'u-digital', executiveId: 'exe-ceo', name: 'Digital отдел', head: '', order: 10, stackId: null, groupId: null, gridCol: 0, gridRow: 0, employees: 0, members: [] },
  {
    id: 'u-context',
    executiveId: 'exe-ceo',
    name: 'Отдел контекстной и медийной рекламы',
    head: '',
    order: 11,
    stackId: null,
    groupId: null,
    gridCol: 0,
    gridRow: 1,
    employees: 0,
    members: []
  },
  {
    id: 'u-smm',
    executiveId: 'exe-ceo',
    name: 'Отдел SMM & Influence & таргета',
    head: '',
    order: 12,
    stackId: null,
    groupId: null,
    gridCol: 0,
    gridRow: 2,
    employees: 0,
    members: []
  },
  { id: 'u-analytics', executiveId: 'exe-ceo', name: 'Отдел аналитики', head: '', order: 13, stackId: null, groupId: null, gridCol: 0, gridRow: 3, employees: 0, members: [] },
  { id: 'u-dev', executiveId: 'exe-ceo', name: 'Отдел разработки', head: '', order: 20, stackId: null, groupId: null, gridCol: 1, gridRow: 0, employees: 0, members: [] },
  { id: 'u-orm', executiveId: 'exe-ceo', name: 'ORM отдел', head: '', order: 31, stackId: null, groupId: 'grp-anna', employees: 0, members: [] },
  { id: 'u-seo', executiveId: 'exe-ceo', name: 'SEO отдел', head: '', order: 32, stackId: null, groupId: 'grp-anna', employees: 0, members: [] },
  {
    id: 'u-accounting',
    executiveId: 'exe-ceo',
    name: 'Отдел аккаунтинга',
    head: '',
    order: 33,
    stackId: null,
    groupId: 'grp-anna',
    employees: 0,
    members: []
  },
  { id: 'u-marketing', executiveId: 'exe-ceo', name: 'Отдел маркетинга', head: '', order: 40, stackId: null, groupId: null, gridCol: 3, gridRow: 0, employees: 0, members: [] },
  { id: 'u-hr', executiveId: 'exe-ceo', name: 'HR-отдел', head: '', order: 41, stackId: null, groupId: null, gridCol: 3, gridRow: 1, employees: 0, members: [] },
  { id: 'u-office', executiveId: 'exe-ceo', name: 'Офис-менеджер', head: '', order: 42, stackId: null, groupId: null, gridCol: 3, gridRow: 2, employees: 0, members: [] },
  { id: 'u-legal', executiveId: 'exe-ceo', name: 'Юристы', head: '', order: 43, stackId: null, groupId: null, gridCol: 3, gridRow: 3, employees: 0, members: [] }
];

const defaultStats: OrgStatsFact[] = [
  { id: 's1', text: '12 лет на рынке' },
  { id: 's2', text: '80+ сотрудников' },
  { id: 's3', text: '70% работают из офиса' }
];

export function buildPlacedItems(executiveId: string, units: OrgUnit[], groups: OrgUnitGroup[]): OrgPlacedItem[] {
  const execUnits = units.filter((u) => u.executiveId === executiveId);
  const execGroups = groups.filter((g) => g.executiveId === executiveId).sort((a, b) => a.order - b.order);
  const items: OrgPlacedItem[] = [];

  for (const group of execGroups) {
    const gUnits = execUnits.filter((u) => u.groupId === group.id).sort((a, b) => a.order - b.order);
    if (gUnits.length) items.push({ kind: 'group', group, units: gUnits });
  }

  const solo = execUnits
    .filter((u) => !u.groupId)
    .sort((a, b) => a.order - b.order);

  for (const unit of solo) {
    items.push({ kind: 'unit', unit });
  }

  return items.sort((a, b) => {
    const ga = gridOf(a);
    const gb = gridOf(b);
    if (ga.row !== gb.row) return ga.row - gb.row;
    return ga.col - gb.col;
  });
}

function gridOf(item: OrgPlacedItem): { col: number; row: number } {
  if (item.kind === 'group') {
    return { col: item.group.gridCol ?? 0, row: item.group.gridRow ?? 0 };
  }
  return { col: item.unit.gridCol ?? 0, row: item.unit.gridRow ?? 0 };
}

export function snapGridCell(container: HTMLElement, clientX: number, clientY: number): { col: number; row: number } {
  const rect = container.getBoundingClientRect();
  const style = getComputedStyle(container);
  const gap = Number.parseFloat(style.gap) || ORG_GRID_GAP_PX;
  const cols = ORG_GRID_COLS;
  const colWidth = (rect.width - gap * (cols - 1)) / cols;
  const rowHeight = ORG_GRID_ROW_PX;

  const x = Math.max(0, clientX - rect.left);
  const y = Math.max(0, clientY - rect.top);

  const col = Math.min(cols - 1, Math.max(0, Math.floor(x / (colWidth + gap))));
  const row = Math.max(0, Math.floor(y / (rowHeight + gap)));

  return { col, row };
}

const nextId = (prefix: string) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

let persistWatchRegistered = false;

function ensureGridLayout(
  executives: OrgExecutive[],
  units: OrgUnit[],
  groups: OrgUnitGroup[]
) {
  executives.forEach((exec, index) => {
    if (exec.gridCol == null) exec.gridCol = 0;
    if (exec.gridRow == null) exec.gridRow = 0;
    if (exec.order !== index) exec.order = index;
  });

  const execIds = [...new Set(units.map((u) => u.executiveId).concat(groups.map((g) => g.executiveId)))];

  for (const executiveId of execIds) {
    const keys = new Set<string>();
    const mark = (col: number, row: number) => keys.add(`${col}:${row}`);
    const findFree = () => {
      for (let row = 0; row < 24; row++) {
        for (let col = 0; col < ORG_GRID_COLS; col++) {
          if (!keys.has(`${col}:${row}`)) return { col, row };
        }
      }
      return { col: 0, row: 0 };
    };

    units
      .filter((u) => u.executiveId === executiveId && !u.groupId && u.gridCol != null && u.gridRow != null)
      .forEach((u) => mark(u.gridCol!, u.gridRow!));

    groups
      .filter((g) => g.executiveId === executiveId && g.gridCol != null && g.gridRow != null)
      .forEach((g) => mark(g.gridCol!, g.gridRow!));

    const solo = units
      .filter((u) => u.executiveId === executiveId && !u.groupId)
      .sort((a, b) => a.order - b.order);

    const stackCols = new Map<string, number>();
    let fallbackCol = 0;

    for (const unit of solo) {
      if (unit.gridCol != null && unit.gridRow != null) {
        unit.stackId = null;
        continue;
      }

      if (unit.stackId) {
        let col = stackCols.get(unit.stackId);
        if (col == null) {
          col = fallbackCol++;
          stackCols.set(unit.stackId, col);
        }
        let row = 0;
        while (keys.has(`${col}:${row}`)) row++;
        unit.gridCol = col;
        unit.gridRow = row;
        mark(col, row);
      } else {
        const slot = findFree();
        unit.gridCol = slot.col;
        unit.gridRow = slot.row;
        mark(slot.col, slot.row);
      }
      unit.stackId = null;
    }

    for (const group of groups.filter((g) => g.executiveId === executiveId)) {
      if (group.gridCol != null && group.gridRow != null) continue;
      const slot = findFree();
      group.gridCol = slot.col;
      group.gridRow = slot.row;
      mark(slot.col, slot.row);
    }
  }
}

export function useOrgStructure() {
  const orgExecutives = useState<OrgExecutive[]>('vbi-org-executives', () => [...defaultExecutives]);
  const orgUnits = useState<OrgUnit[]>('vbi-org-units', () => [...defaultUnits]);
  const orgGroups = useState<OrgUnitGroup[]>('vbi-org-groups', () => [...defaultGroups]);
  const orgStats = useState<OrgStatsFact[]>('vbi-org-stats', () => [...defaultStats]);
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
    if (!import.meta.client) return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        executives: orgExecutives.value,
        units: orgUnits.value,
        groups: orgGroups.value,
        stats: orgStats.value
      })
    );
  };

  const hydrate = () => {
    if (!import.meta.client || orgHydrated.value) return;
    orgHydrated.value = true;

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      ensureGridLayout(orgExecutives.value, orgUnits.value, orgGroups.value);
      return;
    }

    try {
      const data = JSON.parse(raw) as {
        executives?: OrgExecutive[];
        units?: OrgUnit[];
        groups?: OrgUnitGroup[];
        stats?: OrgStatsFact[];
      };
      if (data.executives?.length) orgExecutives.value = data.executives;
      if (data.units?.length) orgUnits.value = data.units;
      if (data.groups) orgGroups.value = data.groups;
      if (data.stats?.length) orgStats.value = data.stats;
      ensureGridLayout(orgExecutives.value, orgUnits.value, orgGroups.value);
    } catch {
      /* keep defaults */
    }
  };

  const findFreeCell = (executiveId: string) => {
    const keys = new Set<string>();
    orgUnits.value
      .filter((u) => u.executiveId === executiveId && !u.groupId)
      .forEach((u) => keys.add(`${u.gridCol ?? 0}:${u.gridRow ?? 0}`));
    orgGroups.value
      .filter((g) => g.executiveId === executiveId)
      .forEach((g) => keys.add(`${g.gridCol ?? 0}:${g.gridRow ?? 0}`));

    for (let row = 0; row < 24; row++) {
      for (let col = 0; col < ORG_GRID_COLS; col++) {
        if (!keys.has(`${col}:${row}`)) return { col, row };
      }
    }
    return { col: 0, row: 0 };
  };

  const setUnitGrid = (unitId: string, col: number, row: number) => {
    const unit = orgUnits.value.find((u) => u.id === unitId);
    if (!unit) return;
    unit.gridCol = Math.min(ORG_GRID_COLS - 1, Math.max(0, col));
    unit.gridRow = Math.max(0, row);
    persist();
  };

  const setGroupGrid = (groupId: string, col: number, row: number) => {
    const group = orgGroups.value.find((g) => g.id === groupId);
    if (!group) return;
    group.gridCol = Math.min(ORG_GRID_COLS - 1, Math.max(0, col));
    group.gridRow = Math.max(0, row);
    persist();
  };

  const addExecutive = () => {
    const order = Math.max(...orgExecutives.value.map((e) => e.order), -1) + 1;
    orgExecutives.value.push({
      id: nextId('exe'),
      title: 'Директор',
      person: '',
      order,
      gridCol: 0,
      gridRow: 0
    });
    persist();
  };

  const addUnit = (executiveId?: string) => {
    const execId = executiveId ?? orgExecutives.value.find((e) => e.id === 'exe-ceo')?.id ?? orgExecutives.value[0]?.id;
    if (!execId) return;

    const order = Math.max(...orgUnits.value.filter((u) => u.executiveId === execId).map((u) => u.order), 0) + 10;
    const { col, row } = findFreeCell(execId);
    orgUnits.value.push({
      id: nextId('u'),
      executiveId: execId,
      name: 'Новый отдел',
      head: '',
      order,
      stackId: null,
      groupId: null,
      gridCol: col,
      gridRow: row,
      employees: 0,
      members: []
    });
    persist();
  };

  const addGroup = (executiveId?: string) => {
    const execId = executiveId ?? 'exe-ceo';
    const order = Math.max(...orgGroups.value.filter((g) => g.executiveId === execId).map((g) => g.order), 0) + 10;
    const { col, row } = findFreeCell(execId);
    const groupId = nextId('grp');
    orgGroups.value.push({
      id: groupId,
      executiveId: execId,
      label: 'Руководитель блока',
      order,
      gridCol: col,
      gridRow: row
    });
    persist();
    return groupId;
  };

  const addStatsFact = () => {
    orgStats.value.push({ id: nextId('s'), text: 'Новый факт' });
    persist();
  };

  const removeExecutive = (id: string) => {
    if (orgExecutives.value.length <= 1) return;
    orgExecutives.value = orgExecutives.value.filter((e) => e.id !== id);
    orgUnits.value = orgUnits.value.filter((u) => u.executiveId !== id);
    orgGroups.value = orgGroups.value.filter((g) => g.executiveId !== id);
    persist();
  };

  const removeUnit = (unitId: string) => {
    orgUnits.value = orgUnits.value.filter((u) => u.id !== unitId);
    persist();
  };

  const removeGroup = (groupId: string) => {
    orgUnits.value.forEach((u) => {
      if (u.groupId === groupId) u.groupId = null;
    });
    orgGroups.value = orgGroups.value.filter((g) => g.id !== groupId);
    persist();
  };

  if (import.meta.client && !persistWatchRegistered) {
    persistWatchRegistered = true;
    watch([orgExecutives, orgUnits, orgGroups, orgStats], persist, { deep: true });
  }

  return {
    orgExecutives,
    orgUnits,
    orgGroups,
    orgStats,
    executivesSorted,
    placedByExecutive,
    hydrate,
    addExecutive,
    addUnit,
    addGroup,
    setUnitGrid,
    setGroupGrid,
    addStatsFact,
    removeExecutive,
    removeUnit,
    removeGroup,
    snapGridCell,
    buildPlacedItems
  };
}
