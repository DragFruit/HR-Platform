import type { ServerEmployee } from '../utils/employeesStore';
import type { OrgStructureState } from '../utils/orgStructureStore';
import type {
  employees,
  orgExecutives,
  orgGroups,
  orgLinks,
  orgUnits
} from '../db/schema';

export type EmployeeRow = typeof employees.$inferInsert;
type EmployeeSelect = typeof employees.$inferSelect;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const isValidIsoDate = (v: string) => {
  if (!DATE_RE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};

/** Поле JSON ↔ колонка и проверка типа; что не прошло проверку — в extra как есть. */
type FieldSpec = { col: keyof EmployeeRow; ok: (v: unknown) => boolean };

const str = (v: unknown) => typeof v === 'string';
const int = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v);
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);

const EMPLOYEE_FIELDS: Record<string, FieldSpec> = {
  name: { col: 'name', ok: str },
  title: { col: 'title', ok: str },
  department: { col: 'department', ok: str },
  manager: { col: 'manager', ok: str },
  manager_id: { col: 'managerId', ok: int },
  hired_at: { col: 'hiredAt', ok: (v) => str(v) && isValidIsoDate(v as string) },
  birthday: { col: 'birthday', ok: str },
  platform_user_id: { col: 'platformUserId', ok: int },
  bitrix_user_id: { col: 'bitrixUserId', ok: int },
  email: { col: 'email', ok: str },
  account_role: { col: 'accountRole', ok: str },
  vacation_opening_balance: { col: 'vacationOpeningBalance', ok: num },
  legal_entity: { col: 'legalEntity', ok: str },
  contract_form: { col: 'contractForm', ok: str }
};

/** Строка сотрудника. null — нет целого id: такую запись не кладём (ключ не выдумываем). */
export function employeeToRow(item: Record<string, unknown>, position: number): EmployeeRow | null {
  const id = item.id;
  if (!int(id) || (id as number) === 0) return null;
  const row: EmployeeRow = {
    id: id as number,
    name: '',
    title: '',
    department: '',
    manager: '',
    position,
    sourceKeys: Object.keys(item)
  };
  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(item)) {
    if (key === 'id') continue;
    const spec = EMPLOYEE_FIELDS[key];
    if (!spec) {
      extra[key] = value;
      continue;
    }
    if (value === null || value === undefined) continue; // null в колонке; присутствие ключа — в sourceKeys
    if (spec.ok(value)) (row as Record<string, unknown>)[spec.col] = value;
    else extra[key] = value;
  }
  row.extra = Object.keys(extra).length ? extra : null;
  return row;
}

/** Обратно в объект JSON: те же ключи в том же порядке, отсутствующие — отсутствуют. */
export function rowToEmployee(row: EmployeeSelect | EmployeeRow): ServerEmployee {
  const extra = (row.extra ?? {}) as Record<string, unknown>;
  const hasKeys = Boolean(row.sourceKeys?.length);
  const keys = hasKeys ? row.sourceKeys! : ['id', ...Object.keys(EMPLOYEE_FIELDS)];
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (key === 'id') {
      out.id = row.id;
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(extra, key)) {
      out[key] = extra[key];
      continue;
    }
    const spec = EMPLOYEE_FIELDS[key];
    if (!spec) continue;
    const value = (row as Record<string, unknown>)[spec.col];
    if (value == null && !hasKeys) continue;
    out[key] = value ?? null;
  }
  for (const [key, value] of Object.entries(extra)) {
    if (!(key in out)) out[key] = value;
  }
  return out as ServerEmployee;
}

/** Поля, которые сравниваем для истории назначений. */
export function assignmentOf(row: Pick<EmployeeRow, 'department' | 'title' | 'manager' | 'managerId'>) {
  return {
    department: row.department ?? '',
    title: row.title ?? '',
    manager: row.manager ?? '',
    managerId: row.managerId ?? null
  };
}

export function sameAssignment(a: ReturnType<typeof assignmentOf>, b: ReturnType<typeof assignmentOf>) {
  return a.department === b.department && a.title === b.title && a.manager === b.manager && a.managerId === b.managerId;
}

/** Колонки, по которым строка «изменилась» (без служебных created_at/updated_at). */
export function employeeRowsEqual(a: EmployeeRow, b: EmployeeRow): boolean {
  return JSON.stringify(rowToEmployee(a)) === JSON.stringify(rowToEmployee(b)) && a.position === b.position;
}

// ---------- оргструктура ----------

type ExecRow = typeof orgExecutives.$inferInsert;
type GroupRow = typeof orgGroups.$inferInsert;
type UnitRow = typeof orgUnits.$inferInsert;
type LinkRow = typeof orgLinks.$inferInsert;

export type OrgRows = { executives: ExecRow[]; groups: GroupRow[]; units: UnitRow[]; links: LinkRow[] };

const finite = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const text = (v: unknown): string => String(v ?? '');

function pickExtra(item: Record<string, unknown>, known: string[]): Record<string, unknown> | null {
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(item)) if (!known.includes(k)) extra[k] = v;
  return Object.keys(extra).length ? extra : null;
}

const EXEC_KEYS = ['id', 'title', 'person', 'order', 'gridCol', 'gridRow', 'x', 'y'];
const GROUP_KEYS = ['id', 'executiveId', 'label', 'order', 'labelX', 'labelY', 'gridCol', 'gridRow', 'x', 'y', 'width', 'height'];
const UNIT_KEYS = [
  'id', 'executiveId', 'name', 'head', 'order', 'stackId', 'groupId', 'employees', 'members',
  'gridCol', 'gridRow', 'x', 'y', 'width', 'height'
];
const LINK_KEYS = ['id', 'from', 'to', 'mid'];

const okId = (v: unknown): v is string => typeof v === 'string' && Boolean(v.trim());

/**
 * Состояние (уже нормализованное orgStructureStore или сырое из файла) → строки.
 * Записи без id / без executiveId пропускаются — нормализатор их и так отбрасывает.
 */
export function orgStateToRows(state: Partial<OrgStructureState>): OrgRows & { skipped: number } {
  const rows: OrgRows = { executives: [], groups: [], units: [], links: [] };
  let skipped = 0;
  const seen = { e: new Set<string>(), g: new Set<string>(), u: new Set<string>(), l: new Set<string>() };

  (Array.isArray(state.executives) ? state.executives : []).forEach((raw, position) => {
    const e = raw as unknown as Record<string, unknown>;
    if (!okId(e?.id) || seen.e.has(e.id.trim())) return void (skipped += 1);
    seen.e.add(e.id.trim());
    rows.executives.push({
      id: e.id.trim(),
      title: text(e.title),
      person: text(e.person),
      sortOrder: finite(e.order) ?? 0,
      gridCol: finite(e.gridCol),
      gridRow: finite(e.gridRow),
      x: finite(e.x),
      y: finite(e.y),
      position,
      extra: pickExtra(e, EXEC_KEYS)
    });
  });

  (Array.isArray(state.groups) ? state.groups : []).forEach((raw, position) => {
    const g = raw as unknown as Record<string, unknown>;
    if (!okId(g?.id) || !okId(g.executiveId) || seen.g.has(g.id.trim())) return void (skipped += 1);
    seen.g.add(g.id.trim());
    rows.groups.push({
      id: g.id.trim(),
      executiveId: g.executiveId.trim(),
      label: text(g.label),
      sortOrder: finite(g.order) ?? 0,
      labelX: finite(g.labelX),
      labelY: finite(g.labelY),
      gridCol: finite(g.gridCol),
      gridRow: finite(g.gridRow),
      x: finite(g.x),
      y: finite(g.y),
      width: finite(g.width),
      height: finite(g.height),
      position,
      extra: pickExtra(g, GROUP_KEYS)
    });
  });

  (Array.isArray(state.units) ? state.units : []).forEach((raw, position) => {
    const u = raw as unknown as Record<string, unknown>;
    if (!okId(u?.id) || !okId(u.executiveId) || seen.u.has(u.id.trim())) return void (skipped += 1);
    seen.u.add(u.id.trim());
    const employeesCount = typeof u.employees === 'number' && u.employees >= 0 ? Math.trunc(u.employees) : 0;
    const extra = pickExtra(u, UNIT_KEYS) ?? {};
    if (typeof u.employees === 'number' && u.employees !== employeesCount) extra.employees = u.employees;
    rows.units.push({
      id: u.id.trim(),
      executiveId: u.executiveId.trim(),
      groupId: typeof u.groupId === 'string' ? u.groupId : null,
      stackId: typeof u.stackId === 'string' ? u.stackId : null,
      name: text(u.name),
      head: text(u.head),
      sortOrder: finite(u.order) ?? 0,
      employeesCount,
      members: Array.isArray(u.members) ? u.members : [],
      gridCol: finite(u.gridCol),
      gridRow: finite(u.gridRow),
      x: finite(u.x),
      y: finite(u.y),
      width: finite(u.width),
      height: finite(u.height),
      position,
      extra: Object.keys(extra).length ? extra : null
    });
  });

  (Array.isArray(state.links) ? state.links : []).forEach((raw, position) => {
    const l = raw as unknown as Record<string, unknown>;
    const from = l?.from as Record<string, unknown> | undefined;
    const to = l?.to as Record<string, unknown> | undefined;
    const anchorOk = (a?: Record<string, unknown>) => okId(a?.kind) && okId(a?.id) && okId(a?.side);
    if (!okId(l?.id) || !anchorOk(from) || !anchorOk(to) || seen.l.has(l.id.trim())) return void (skipped += 1);
    seen.l.add(l.id.trim());
    rows.links.push({
      id: l.id.trim(),
      fromKind: String(from!.kind),
      fromId: String(from!.id),
      fromSide: String(from!.side),
      toKind: String(to!.kind),
      toId: String(to!.id),
      toSide: String(to!.side),
      mid: finite(l.mid),
      position,
      extra: pickExtra(l, LINK_KEYS)
    });
  });

  return { ...rows, skipped };
}

const opt = (key: string, v: number | null | undefined) => (v == null ? {} : { [key]: v });

/** Строки → сырое состояние; дальше его прогоняет normalizeOrgStructureState, как и файл. */
export function orgRowsToState(rows: OrgRows): Partial<OrgStructureState> {
  const byPos = <T extends { position?: number | null }>(list: T[]) =>
    [...list].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  return {
    executives: byPos(rows.executives).map((e) => ({
      ...(e.extra ?? {}),
      id: e.id,
      title: e.title ?? '',
      person: e.person ?? '',
      order: e.sortOrder ?? 0,
      ...opt('gridCol', e.gridCol),
      ...opt('gridRow', e.gridRow),
      ...opt('x', e.x),
      ...opt('y', e.y)
    })),
    units: byPos(rows.units).map((u) => ({
      ...(u.extra ?? {}),
      id: u.id,
      executiveId: u.executiveId,
      name: u.name ?? '',
      head: u.head ?? '',
      order: u.sortOrder ?? 0,
      stackId: u.stackId ?? null,
      groupId: u.groupId ?? null,
      employees: typeof u.extra?.employees === 'number' ? u.extra.employees : (u.employeesCount ?? 0),
      members: (u.members ?? []) as never[],
      ...opt('gridCol', u.gridCol),
      ...opt('gridRow', u.gridRow),
      ...opt('x', u.x),
      ...opt('y', u.y),
      ...opt('width', u.width),
      ...opt('height', u.height)
    })),
    groups: byPos(rows.groups).map((g) => ({
      ...(g.extra ?? {}),
      id: g.id,
      executiveId: g.executiveId,
      label: g.label ?? '',
      order: g.sortOrder ?? 0,
      ...opt('labelX', g.labelX),
      ...opt('labelY', g.labelY),
      ...opt('gridCol', g.gridCol),
      ...opt('gridRow', g.gridRow),
      ...opt('x', g.x),
      ...opt('y', g.y),
      ...opt('width', g.width),
      ...opt('height', g.height)
    })),
    links: byPos(rows.links).map((l) => ({
      ...(l.extra ?? {}),
      id: l.id,
      from: { kind: l.fromKind, id: l.fromId, side: l.fromSide },
      to: { kind: l.toKind, id: l.toId, side: l.toSide },
      ...opt('mid', l.mid)
    })) as OrgStructureState['links']
  };
}
