import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type {
  OrgExecutive,
  OrgLink,
  OrgLinkAnchor,
  OrgNodeKind,
  OrgPortSide,
  OrgUnit,
  OrgUnitGroup
} from '../../app/composables/useOrgStructure';

export type OrgStructureState = {
  executives: OrgExecutive[];
  units: OrgUnit[];
  groups: OrgUnitGroup[];
  links: OrgLink[];
};

const DATA_FILE = join(process.cwd(), 'server/data/org-structure.json');

const PORT_SIDES = new Set<OrgPortSide>(['top', 'right', 'bottom', 'left']);
const NODE_KINDS = new Set<OrgNodeKind>(['executive', 'unit', 'group']);

export const defaultOrgStructureState = (): OrgStructureState => ({
  executives: [],
  units: [],
  groups: [],
  links: []
});

const isPortSide = (side: unknown): side is OrgPortSide =>
  typeof side === 'string' && PORT_SIDES.has(side as OrgPortSide);

const isNodeKind = (kind: unknown): kind is OrgNodeKind =>
  typeof kind === 'string' && NODE_KINDS.has(kind as OrgNodeKind);

const isValidAnchor = (anchor: unknown): anchor is OrgLinkAnchor => {
  if (!anchor || typeof anchor !== 'object') return false;
  const a = anchor as Partial<OrgLinkAnchor>;
  return isNodeKind(a.kind) && typeof a.id === 'string' && Boolean(a.id) && isPortSide(a.side);
};

const asFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return value;
};

const normalizeExecutive = (raw: Partial<OrgExecutive>): OrgExecutive | null => {
  if (!raw || typeof raw.id !== 'string' || !raw.id.trim()) return null;
  return {
    id: raw.id.trim(),
    title: String(raw.title ?? ''),
    person: String(raw.person ?? ''),
    order: typeof raw.order === 'number' && Number.isFinite(raw.order) ? raw.order : 0,
    ...(asFiniteNumber(raw.gridCol) != null ? { gridCol: asFiniteNumber(raw.gridCol) } : {}),
    ...(asFiniteNumber(raw.gridRow) != null ? { gridRow: asFiniteNumber(raw.gridRow) } : {}),
    ...(asFiniteNumber(raw.x) != null ? { x: asFiniteNumber(raw.x) } : {}),
    ...(asFiniteNumber(raw.y) != null ? { y: asFiniteNumber(raw.y) } : {})
  };
};

const normalizeUnit = (raw: Partial<OrgUnit>): OrgUnit | null => {
  if (!raw || typeof raw.id !== 'string' || !raw.id.trim()) return null;
  if (typeof raw.executiveId !== 'string' || !raw.executiveId.trim()) return null;
  const unit: OrgUnit = {
    id: raw.id.trim(),
    executiveId: raw.executiveId.trim(),
    name: String(raw.name ?? ''),
    head: String(raw.head ?? ''),
    order: typeof raw.order === 'number' && Number.isFinite(raw.order) ? raw.order : 0,
    stackId: typeof raw.stackId === 'string' ? raw.stackId : null,
    groupId: typeof raw.groupId === 'string' ? raw.groupId : null,
    employees: typeof raw.employees === 'number' && raw.employees >= 0 ? raw.employees : 0,
    members: Array.isArray(raw.members) ? raw.members : []
  };
  if (asFiniteNumber(raw.gridCol) != null) unit.gridCol = asFiniteNumber(raw.gridCol);
  if (asFiniteNumber(raw.gridRow) != null) unit.gridRow = asFiniteNumber(raw.gridRow);
  if (asFiniteNumber(raw.x) != null) unit.x = asFiniteNumber(raw.x);
  if (asFiniteNumber(raw.y) != null) unit.y = asFiniteNumber(raw.y);
  if (asFiniteNumber(raw.width) != null) unit.width = asFiniteNumber(raw.width);
  if (asFiniteNumber(raw.height) != null) unit.height = asFiniteNumber(raw.height);
  return unit;
};

const normalizeGroup = (raw: Partial<OrgUnitGroup>): OrgUnitGroup | null => {
  if (!raw || typeof raw.id !== 'string' || !raw.id.trim()) return null;
  if (typeof raw.executiveId !== 'string' || !raw.executiveId.trim()) return null;
  const group: OrgUnitGroup = {
    id: raw.id.trim(),
    executiveId: raw.executiveId.trim(),
    label: String(raw.label ?? ''),
    order: typeof raw.order === 'number' && Number.isFinite(raw.order) ? raw.order : 0
  };
  if (asFiniteNumber(raw.labelX) != null) group.labelX = asFiniteNumber(raw.labelX);
  if (asFiniteNumber(raw.labelY) != null) group.labelY = asFiniteNumber(raw.labelY);
  if (asFiniteNumber(raw.gridCol) != null) group.gridCol = asFiniteNumber(raw.gridCol);
  if (asFiniteNumber(raw.gridRow) != null) group.gridRow = asFiniteNumber(raw.gridRow);
  if (asFiniteNumber(raw.x) != null) group.x = asFiniteNumber(raw.x);
  if (asFiniteNumber(raw.y) != null) group.y = asFiniteNumber(raw.y);
  if (asFiniteNumber(raw.width) != null) group.width = asFiniteNumber(raw.width);
  if (asFiniteNumber(raw.height) != null) group.height = asFiniteNumber(raw.height);
  return group;
};

const normalizeLink = (raw: Partial<OrgLink>): OrgLink | null => {
  if (!raw || typeof raw.id !== 'string' || !raw.id.trim()) return null;
  if (!isValidAnchor(raw.from) || !isValidAnchor(raw.to)) return null;
  const link: OrgLink = {
    id: raw.id.trim(),
    from: raw.from,
    to: raw.to
  };
  if (asFiniteNumber(raw.mid) != null) link.mid = asFiniteNumber(raw.mid);
  return link;
};

export function normalizeOrgStructureState(raw: Partial<OrgStructureState>): OrgStructureState {
  return {
    executives: Array.isArray(raw.executives)
      ? raw.executives
          .map((item) => normalizeExecutive(item as Partial<OrgExecutive>))
          .filter((item): item is OrgExecutive => Boolean(item))
      : [],
    units: Array.isArray(raw.units)
      ? raw.units
          .map((item) => normalizeUnit(item as Partial<OrgUnit>))
          .filter((item): item is OrgUnit => Boolean(item))
      : [],
    groups: Array.isArray(raw.groups)
      ? raw.groups
          .map((item) => normalizeGroup(item as Partial<OrgUnitGroup>))
          .filter((item): item is OrgUnitGroup => Boolean(item))
      : [],
    links: Array.isArray(raw.links)
      ? raw.links
          .map((item) => normalizeLink(item as Partial<OrgLink>))
          .filter((item): item is OrgLink => Boolean(item))
      : []
  };
}

export function isOrgStructureEmpty(state: OrgStructureState): boolean {
  return state.executives.length === 0 && state.units.length === 0 && state.groups.length === 0;
}

async function ensureFile() {
  await mkdir(dirname(DATA_FILE), { recursive: true });
  try {
    await readFile(DATA_FILE, 'utf8');
  } catch {
    await writeFile(DATA_FILE, JSON.stringify(defaultOrgStructureState(), null, 2), 'utf8');
  }
}

export async function readOrgStructure(): Promise<OrgStructureState> {
  await ensureFile();
  const raw = await readFile(DATA_FILE, 'utf8');
  return normalizeOrgStructureState(JSON.parse(raw) as Partial<OrgStructureState>);
}

export async function writeOrgStructure(state: OrgStructureState): Promise<OrgStructureState> {
  await ensureFile();
  const normalized = normalizeOrgStructureState(state);
  await writeFile(DATA_FILE, JSON.stringify(normalized, null, 2), 'utf8');
  return normalized;
}

let mutationQueue: Promise<unknown> = Promise.resolve();

export async function mutateOrgStructure(
  mutator: (state: OrgStructureState) => OrgStructureState | Promise<OrgStructureState>
): Promise<OrgStructureState> {
  const run = mutationQueue.then(async () => {
    const current = await readOrgStructure();
    const next = await mutator(current);
    return writeOrgStructure(next);
  });
  mutationQueue = run.catch(() => {});
  return run;
}
