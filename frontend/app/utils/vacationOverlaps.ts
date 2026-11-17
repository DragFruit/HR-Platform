/**
 * Пересечения отпусков для руководителя и админа (карточки согласования + полоса загрузки).
 *
 * Правила (решение заказчика, см. docs/PRODUCT.md):
 * - учитываются согласованные (`approved`) и ожидающие (`pending`) заявки, отклонённые/отменённые нет;
 * - даты сравниваются включительно (общий хотя бы один день);
 * - сама заявка и другие заявки того же сотрудника не считаются «пересечением с коллегой»;
 * - круг людей: руководитель видит свою команду/отдел (имена из его календаря),
 *   админ/HR видит отдел заявителя.
 */
import { employeeNamesMatch } from '~/utils/employeeName';
import { vacationBelongsToEmployee } from '~/utils/vacationEmployeeRef';

export type OverlapStatus = 'approved' | 'pending';

export const OVERLAP_STATUSES: readonly OverlapStatus[] = ['approved', 'pending'];

export type OverlapRequestLike = {
  id: number;
  employee: string;
  employee_id?: number | null;
  start: string;
  end: string;
  status: string;
};

export type VacationOverlapEntry = {
  id: number;
  employee: string;
  status: OverlapStatus;
  start: string;
  end: string;
  overlapStart: string;
  overlapEnd: string;
};

export type OverlapEmployeeLike = { name: string; department?: string | null };

const isOverlapStatus = (status: string): status is OverlapStatus =>
  status === 'approved' || status === 'pending';

const sortRange = (a: string, b: string): [string, string] => (a <= b ? [a, b] : [b, a]);

/** Пересекаются ли два диапазона ISO-дат (включительно). */
export const rangesOverlapInclusive = (
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean => {
  const [a0, a1] = sortRange(aStart, aEnd);
  const [b0, b1] = sortRange(bStart, bEnd);
  return a0 <= b1 && b0 <= a1;
};

const inScope = (name: string, scope: string[] | null): boolean => {
  if (!scope) return true;
  return scope.some((s) => s === name || employeeNamesMatch(s, name));
};

/**
 * Чужие отпуска/заявки, пересекающиеся с `request`.
 * `scopeNames` = null/undefined — без фильтра по людям.
 */
export const findRequestOverlaps = (
  request: Omit<OverlapRequestLike, 'status'> & { status?: string },
  all: OverlapRequestLike[],
  scopeNames?: Iterable<string> | null
): VacationOverlapEntry[] => {
  const scope = scopeNames ? [...scopeNames] : null;
  const [reqStart, reqEnd] = sortRange(request.start, request.end);
  // Не передаём саму заявку: её `id` — номер заявки, а не id сотрудника.
  const requester = { employee_id: request.employee_id ?? null, name: request.employee };
  const out: VacationOverlapEntry[] = [];
  for (const other of all) {
    if (other.id === request.id) continue;
    if (vacationBelongsToEmployee(other, requester)) continue;
    if (!isOverlapStatus(other.status)) continue;
    if (!inScope(other.employee, scope)) continue;
    const [oStart, oEnd] = sortRange(other.start, other.end);
    if (!rangesOverlapInclusive(reqStart, reqEnd, oStart, oEnd)) continue;
    out.push({
      id: other.id,
      employee: other.employee,
      status: other.status,
      start: oStart,
      end: oEnd,
      overlapStart: reqStart > oStart ? reqStart : oStart,
      overlapEnd: reqEnd < oEnd ? reqEnd : oEnd
    });
  }
  return out.sort(
    (a, b) => a.employee.localeCompare(b.employee, 'ru') || a.start.localeCompare(b.start)
  );
};

/** Сколько разных людей пересекается (у одного человека может быть 2 заявки). */
export const countOverlapPeople = (entries: Pick<VacationOverlapEntry, 'employee'>[]): number => {
  const names: string[] = [];
  for (const e of entries) {
    if (!names.some((n) => employeeNamesMatch(n, e.employee))) names.push(e.employee);
  }
  return names.length;
};

/** Сотрудники отдела (по полю `department`, без учёта регистра/пробелов). */
export const departmentMemberNames = (
  employees: OverlapEmployeeLike[],
  department: string | null | undefined
): string[] => {
  const key = String(department ?? '').trim().toLowerCase();
  if (!key) return [];
  return employees
    .filter((e) => String(e.department ?? '').trim().toLowerCase() === key)
    .map((e) => e.name);
};

/**
 * Круг людей для подсчёта пересечений.
 * - `team`: руководитель, имена его команды/отдела (как в его календаре);
 * - `requester-department`: админ/HR, отдел заявителя. Если отдел заявителя не найден, фильтра нет
 *   (null), чтобы не скрыть реальные пересечения.
 */
export const resolveOverlapScope = (
  options:
    | { mode: 'team'; teamNames: string[] }
    | { mode: 'requester-department'; requesterName: string; employees: OverlapEmployeeLike[] }
): string[] | null => {
  if (options.mode === 'team') return options.teamNames;
  const requester = options.employees.find((e) =>
    employeeNamesMatch(e.name, options.requesterName)
  );
  const names = departmentMemberNames(options.employees, requester?.department);
  return names.length ? names : null;
};

export type DayAbsence = { employee: string; status: OverlapStatus };

const addDaysIso = (iso: string, days: number): string => {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d! + days));
  return dt.toISOString().slice(0, 10);
};

/** Список ISO-дней от start до end включительно. */
export const isoDaysBetween = (start: string, end: string): string[] => {
  const [lo, hi] = sortRange(start, end);
  const out: string[] = [];
  for (let iso = lo; iso <= hi; iso = addDaysIso(iso, 1)) out.push(iso);
  return out;
};

/**
 * Кто отсутствует в каждый день диапазона `[from, to]` (approved + pending, в пределах scope).
 * Один человек в день считается один раз (approved важнее pending).
 */
export const dailyAbsences = (
  requests: OverlapRequestLike[],
  from: string,
  to: string,
  scopeNames?: Iterable<string> | null
): Map<string, DayAbsence[]> => {
  const scope = scopeNames ? [...scopeNames] : null;
  const map = new Map<string, DayAbsence[]>();
  for (const iso of isoDaysBetween(from, to)) map.set(iso, []);
  const [lo, hi] = sortRange(from, to);
  for (const r of requests) {
    if (!isOverlapStatus(r.status)) continue;
    if (!inScope(r.employee, scope)) continue;
    const [rs, re] = sortRange(r.start, r.end);
    if (!rangesOverlapInclusive(rs, re, lo, hi)) continue;
    const start = rs < lo ? lo : rs;
    const end = re > hi ? hi : re;
    for (let iso = start; iso <= end; iso = addDaysIso(iso, 1)) {
      const list = map.get(iso)!;
      const existing = list.find((a) => employeeNamesMatch(a.employee, r.employee));
      if (existing) {
        if (r.status === 'approved') existing.status = 'approved';
        continue;
      }
      list.push({ employee: r.employee, status: r.status });
    }
  }
  for (const list of map.values()) list.sort((a, b) => a.employee.localeCompare(b.employee, 'ru'));
  return map;
};

/** Уровень загрузки клетки: 0 / 1 / 2 / 3+ человек. */
export const absenceLoadLevel = (count: number): 0 | 1 | 2 | 3 =>
  count <= 0 ? 0 : count >= 3 ? 3 : (count as 1 | 2);
